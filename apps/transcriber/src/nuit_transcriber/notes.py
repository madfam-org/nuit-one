"""Polyphonic note transcription for guitar.

Backend: Spotify's Basic Pitch (ICASSP 2022) run through ONNX Runtime. Basic Pitch is
instrument-agnostic, so its raw notes are cleaned with guitar knowledge:

1. **Harmonic ghosts.** A loud low string excites its 2nd/3rd/4th partials strongly enough that
   the model sometimes reports them as notes (A2 → A3/E4/A4). A note that starts with a lower
   note at a harmonic interval, carries clearly less energy and has no onset of its own is dropped.
2. **Re-detections.** One sustained note can be split in two; a same-pitch continuation without an
   onset peak is merged back. Genuine repeated plucks keep their own onset peak and survive.
3. **Exact pitch.** Every note's frequency is re-measured on a long-window STFT from its harmonics
   (parabolic peak interpolation), giving a per-frame pitch track in cents. That track feeds the
   tuning reference, intonation, vibrato, bends and slides.
"""

from __future__ import annotations

import logging
import math
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

HARMONIC_INTERVALS = {12: 0.80, 19: 0.65, 24: 0.55, 28: 0.45, 31: 0.45, 36: 0.40}
"""Semitone interval of a partial above its fundamental → max energy ratio for a ghost."""


@dataclass
class Note:
    onset: float
    offset: float
    midi: int
    amplitude: float
    onset_strength: float
    frame_start: int = 0
    frame_end: int = 0
    cents: float = 0.0  # deviation from the equal-tempered pitch, relative to the detected A4
    cents_a440: float = 0.0  # same, relative to A4 = 440 Hz (before the tuning reference is known)
    pitch_track: list[float] = field(default_factory=list)  # cents vs nominal, one value per STFT hop
    track_hop: float = 0.0
    flags: set[str] = field(default_factory=set)

    @property
    def duration(self) -> float:
        return self.offset - self.onset

    @property
    def confidence(self) -> float:
        """0..1 blend of the model's sustain energy and its onset evidence."""
        return float(np.clip(0.55 * self.amplitude / 0.8 + 0.45 * self.onset_strength, 0.0, 1.0))


@dataclass
class TranscriptionResult:
    notes: list[Note]
    frame_times: np.ndarray
    onset_posterior: np.ndarray  # frames × 88
    note_posterior: np.ndarray  # frames × 88
    contour: np.ndarray  # frames × 264 (3 bins per semitone from A0)
    removed: dict[str, int]


def _quiet_basic_pitch() -> None:
    # basic-pitch logs a warning per missing optional runtime at import time; we use ONNX on purpose.
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    logging.getLogger().setLevel(max(logging.getLogger().level, logging.ERROR))


def run_basic_pitch(audio_22k: np.ndarray, workdir: Path | None = None) -> dict[str, np.ndarray]:
    """Run the Basic Pitch network and return its posteriorgrams."""
    _quiet_basic_pitch()
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        from basic_pitch import FilenameSuffix, build_icassp_2022_model_path
        from basic_pitch.inference import Model, run_inference

    from .audio_io import write_wav

    model = Model(build_icassp_2022_model_path(FilenameSuffix.onnx))
    tmpdir = Path(workdir) if workdir else Path(tempfile.mkdtemp(prefix="nuit-bp-"))
    tmpdir.mkdir(parents=True, exist_ok=True)
    wav = tmpdir / "basic_pitch_input.wav"
    write_wav(wav, audio_22k.astype(np.float32), 22050)
    return run_inference(wav, model)


def _frames_to_notes(
    output: dict[str, np.ndarray],
    onset_thresh: float,
    frame_thresh: float,
    min_note_frames: int,
    min_hz: float,
    max_hz: float,
) -> tuple[list[Note], np.ndarray]:
    from basic_pitch.note_creation import model_frames_to_time, output_to_notes_polyphonic

    frames = output["note"]
    onsets = output["onset"]
    events = output_to_notes_polyphonic(
        frames,
        onsets,
        onset_thresh=onset_thresh,
        frame_thresh=frame_thresh,
        min_note_len=min_note_frames,
        infer_onsets=True,
        max_freq=max_hz,
        min_freq=min_hz,
        melodia_trick=True,
    )
    times = model_frames_to_time(frames.shape[0])
    notes: list[Note] = []
    for start, end, pitch, amp in events:
        end = min(end, len(times) - 1)
        if end <= start:
            continue
        col = int(pitch) - 21
        lo, hi = max(0, start - 2), min(onsets.shape[0], start + 3)
        onset_strength = float(onsets[lo:hi, col].max()) if 0 <= col < onsets.shape[1] else 0.0
        notes.append(
            Note(
                onset=float(times[start]),
                offset=float(times[end]),
                midi=int(pitch),
                amplitude=float(amp),
                onset_strength=onset_strength,
                frame_start=int(start),
                frame_end=int(end),
            )
        )
    notes.sort(key=lambda n: (n.onset, n.midi))
    return notes, times


def suppress_harmonic_ghosts(notes: list[Note], note_post: np.ndarray) -> int:
    """Drop notes that are most likely a partial of a lower, louder, simultaneous note."""
    removed = 0
    by_time = sorted(notes, key=lambda n: n.onset)
    keep: list[Note] = []
    for i, n in enumerate(by_time):
        ghost = False
        for j in range(max(0, i - 30), min(len(by_time), i + 30)):
            f = by_time[j]
            if f is n or f.midi >= n.midi:
                continue
            ratio_max = HARMONIC_INTERVALS.get(n.midi - f.midi)
            if ratio_max is None:
                continue
            starts_together = abs(n.onset - f.onset) <= 0.05
            inside = f.onset - 0.05 <= n.onset <= f.offset - 0.03
            if not (starts_together or inside):
                continue
            # energy over the ghost's own frames, each note in its own pitch column
            a, b = n.frame_start, max(n.frame_start + 1, n.frame_end)
            e_n = float(note_post[a:b, n.midi - 21].mean())
            e_f = float(note_post[a:b, f.midi - 21].mean())
            if e_f <= 1e-6:
                continue
            weak_onset = n.onset_strength < 0.55 or (
                starts_together and n.onset_strength < f.onset_strength * 0.8
            )
            if e_n < ratio_max * e_f and weak_onset:
                ghost = True
                break
        if ghost:
            removed += 1
        else:
            keep.append(n)
    notes[:] = keep
    return removed


def merge_redetections(notes: list[Note], max_gap: float = 0.045, onset_floor: float = 0.35) -> int:
    """Merge a same-pitch continuation that has no onset of its own into the previous note."""
    merged = 0
    by_pitch: dict[int, list[Note]] = {}
    for n in notes:
        by_pitch.setdefault(n.midi, []).append(n)
    out: list[Note] = []
    for _pitch, seq in by_pitch.items():
        seq.sort(key=lambda n: n.onset)
        cur = seq[0]
        for nxt in seq[1:]:
            if nxt.onset - cur.offset <= max_gap and nxt.onset_strength < onset_floor:
                cur.offset = max(cur.offset, nxt.offset)
                cur.frame_end = max(cur.frame_end, nxt.frame_end)
                cur.amplitude = max(cur.amplitude, nxt.amplitude)
                merged += 1
            else:
                out.append(cur)
                cur = nxt
        out.append(cur)
    out.sort(key=lambda n: (n.onset, n.midi))
    notes[:] = out
    return merged


def drop_weak(notes: list[Note], min_duration: float = 0.07) -> int:
    before = len(notes)
    notes[:] = [
        n for n in notes if not (n.duration < min_duration and n.amplitude < 0.32 and n.onset_strength < 0.45)
    ]
    return before - len(notes)


def refine_pitch(
    notes: list[Note],
    audio_44k: np.ndarray,
    sr: int = 44100,
    n_fft: int = 8192,
    hop: int = 512,
    max_harmonic: int = 6,
) -> None:
    """Measure each note's frequency from its harmonics on a long-window STFT.

    Sets ``cents_a440`` (median deviation from 12-TET at A4=440, stable middle of the note) and
    ``pitch_track`` (per-hop deviation in cents) on every note.
    """
    import librosa

    spec = np.abs(librosa.stft(audio_44k.astype(np.float32), n_fft=n_fft, hop_length=hop, center=True))
    logmag = np.log(spec + 1e-9)
    n_bins, n_frames = spec.shape
    bin_hz = sr / n_fft
    noise_floor = np.percentile(logmag, 60)
    bins_all = np.arange(n_bins)
    for note in notes:
        f_nom = 440.0 * 2.0 ** ((note.midi - 69) / 12.0)
        fa = int(math.floor((note.onset + 0.035) * sr / hop))
        fb = int(math.ceil((note.offset - 0.015) * sr / hop))
        fa, fb = max(0, fa), min(n_frames, max(fa + 1, fb))
        if fb <= fa:
            note.flags.add("pitch-unmeasured")
            continue
        harmonics = [h for h in range(1, max_harmonic + 1) if f_nom * h <= 6000.0]
        cents_rows, weight_rows = [], []
        seg = logmag[:, fa:fb]
        lin = spec[:, fa:fb]
        for h in harmonics:
            fh = f_nom * h
            lo = max(1, int(math.floor(fh * 2 ** (-60 / 1200) / bin_hz)))
            hi = min(n_bins - 2, int(math.ceil(fh * 2 ** (60 / 1200) / bin_hz)))
            if hi <= lo:
                continue
            k = lo + np.argmax(seg[lo : hi + 1], axis=0)  # peak bin per frame
            cols = np.arange(seg.shape[1])
            a, b, c = seg[k - 1, cols], seg[k, cols], seg[k + 1, cols]
            denom = a - 2 * b + c
            delta = np.where(np.abs(denom) > 1e-9, 0.5 * (a - c) / np.where(denom == 0, 1, denom), 0.0)
            freq = (k + np.clip(delta, -0.5, 0.5)) * bin_hz
            cents = 1200.0 * np.log2(np.maximum(freq / h, 1e-6) / f_nom)
            valid = (b >= noise_floor + 2.0) & (b >= a) & (b >= c) & (np.abs(cents) <= 60.0)
            cents_rows.append(np.where(valid, cents, np.nan))
            weight_rows.append(np.where(valid, lin[k, cols], 0.0))
        if not cents_rows:
            note.flags.add("pitch-unmeasured")
            continue
        cm = np.vstack(cents_rows)
        wm = np.vstack(weight_rows)
        track = np.full(cm.shape[1], np.nan)
        for t in range(cm.shape[1]):
            ok = np.isfinite(cm[:, t]) & (wm[:, t] > 0)
            if ok.any():
                vals, w = cm[ok, t], wm[ok, t]
                order = np.argsort(vals)
                cw = np.cumsum(w[order])
                track[t] = vals[order][np.searchsorted(cw, cw[-1] / 2.0)]
        note.pitch_track = [round(float(x), 1) if np.isfinite(x) else None for x in track]  # type: ignore[misc]
        note.track_hop = hop / sr
        finite = track[np.isfinite(track)]
        if finite.size:
            mid = finite[len(finite) // 5 : max(len(finite) // 5 + 1, len(finite) - len(finite) // 5)]
            note.cents_a440 = float(np.median(mid if mid.size else finite))
        else:
            note.flags.add("pitch-unmeasured")
    del bins_all


def transcribe(
    audio_22k: np.ndarray,
    audio_44k: np.ndarray,
    lowest_midi: int = 38,
    highest_midi: int = 88,
    workdir: Path | None = None,
    onset_thresh: float = 0.5,
    frame_thresh: float = 0.3,
) -> TranscriptionResult:
    output = run_basic_pitch(audio_22k, workdir)
    min_hz = 440.0 * 2 ** ((lowest_midi - 0.5 - 69) / 12)
    max_hz = 440.0 * 2 ** ((highest_midi + 0.5 - 69) / 12)
    # 5 frames ≈ 58 ms: guitar ornaments (ligados, grace notes) are shorter than the 128 ms default.
    notes, times = _frames_to_notes(output, onset_thresh, frame_thresh, 5, min_hz, max_hz)
    removed = {
        "harmonicGhosts": suppress_harmonic_ghosts(notes, output["note"]),
        "mergedRedetections": merge_redetections(notes),
        "weak": drop_weak(notes),
    }
    refine_pitch(notes, audio_44k)
    return TranscriptionResult(
        notes=notes,
        frame_times=times,
        onset_posterior=output["onset"],
        note_posterior=output["note"],
        contour=output["contour"],
        removed=removed,
    )
