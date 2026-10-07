"""Playing techniques and style, from per-note pitch tracks, onsets and spectra.

No released classifier covers nylon-string techniques, so these are signal-processing detectors
that report a confidence with every label:

before fingering (string-independent)
  * vibrato — periodic 3.5–9 Hz pitch modulation of a sustained note
  * bend — a rise of ≥ 70 cents into (or after) the note
  * harmonic candidate — a pure spectrum at a natural-harmonic pitch of some open string
  * slur candidate — a weak attack right after a nearby pitch (hammer-on, pull-off or slide)

after fingering (needs strings)
  * slide vs hammer-on/pull-off on the same string; rasgueado/strum and its direction; tambora
  * percussive events with no pitch (golpe); dynamics marks; accent/staccato; tone colour
  * chords, key, accent profile (e.g. tango 3-3-2), tempo/rubato summary
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from .fingering import Assignment
from .notes import Note

DYNAMIC_MARKS = ("pp", "p", "mp", "mf", "f", "ff")
PC_NAMES = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")
KRUMHANSL_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KRUMHANSL_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


@dataclass
class Hints:
    """Per-note facts the fingering solver needs."""

    must_fret: bool = False
    harmonic_fret: int | None = None
    slur_from: int | None = None
    slide: bool = False
    techniques: list[dict[str, Any]] = field(default_factory=list)


def _clean_track(track: list[float | None]) -> np.ndarray:
    arr = np.array([np.nan if v is None else v for v in track], dtype=float)
    if np.isfinite(arr).sum() < 2:
        return arr
    idx = np.arange(len(arr))
    ok = np.isfinite(arr)
    return np.interp(idx, idx[ok], arr[ok])


def vibrato(track: list[float | None], hop: float) -> dict[str, Any] | None:
    """Periodic pitch modulation: rate 3.5–9 Hz, extent ≥ 9 cents, clear autocorrelation peak."""
    x = _clean_track(track)
    if len(x) < 20 or not np.isfinite(x).all():
        return None
    x = x[2:-2]
    win = max(3, int(round(0.3 / hop)) | 1)
    trend = np.convolve(np.pad(x, (win // 2, win // 2), mode="edge"), np.ones(win) / win, mode="valid")
    r = x - trend[: len(x)]
    rms = float(np.sqrt(np.mean(r**2)))
    if rms < 6.0:
        return None
    r = r - r.mean()
    ac = np.correlate(r, r, mode="full")[len(r) - 1 :]
    if ac[0] <= 0:
        return None
    ac = ac / ac[0]
    lo, hi = int(math.floor(1 / (9.0 * hop))), int(math.ceil(1 / (3.5 * hop)))
    hi = min(hi, len(ac) - 1)
    if hi <= lo:
        return None
    lag = lo + int(np.argmax(ac[lo : hi + 1]))
    strength = float(ac[lag])
    if strength < 0.35:
        return None
    return {
        "kind": "vibrato",
        "rateHz": round(1.0 / (lag * hop), 2),
        "extentCents": round(rms * math.sqrt(2), 1),
        "confidence": round(min(1.0, 0.4 + strength * 0.6), 2),
    }


def bend(track: list[float | None]) -> dict[str, Any] | None:
    x = _clean_track(track)
    if len(x) < 6 or not np.isfinite(x).all():
        return None
    head, tail = float(np.median(x[:3])), float(np.median(x[-4:]))
    if head <= -70 and tail - head >= 70:
        return {"kind": "bend", "direction": "up", "extentCents": round(tail - head, 1), "confidence": 0.6}
    if tail - head >= 90 and tail >= 70:
        return {"kind": "bend", "direction": "up", "extentCents": round(tail - head, 1), "confidence": 0.5}
    return None


@dataclass
class Spectral:
    """Long-window magnitude spectrogram shared by the spectral detectors."""

    mag: np.ndarray
    sr: int
    hop: int
    n_fft: int

    @classmethod
    def compute(cls, audio: np.ndarray, sr: int = 44100, n_fft: int = 4096, hop: int = 512) -> Spectral:
        import librosa

        mag = np.abs(librosa.stft(audio.astype(np.float32), n_fft=n_fft, hop_length=hop))
        return cls(mag, sr, hop, n_fft)

    def frames(self, t0: float, t1: float) -> slice:
        a = max(0, int(t0 * self.sr / self.hop))
        b = min(self.mag.shape[1], max(a + 1, int(t1 * self.sr / self.hop)))
        return slice(a, b)

    def harmonic_profile(self, midi: int, t0: float, t1: float, n: int = 6) -> np.ndarray:
        f0 = 440.0 * 2 ** ((midi - 69) / 12)
        seg = self.mag[:, self.frames(t0, t1)]
        if seg.size == 0:
            return np.zeros(n)
        spec = seg.mean(axis=1)
        out = []
        for h in range(1, n + 1):
            b = int(round(h * f0 * self.n_fft / self.sr))
            if b + 2 >= len(spec):
                out.append(0.0)
                continue
            out.append(float(spec[max(0, b - 2) : b + 3].max()))
        return np.array(out)

    def brightness(self, midi: int, t0: float, t1: float) -> float:
        """Spectral centroid in multiples of f0 over the attack."""
        f0 = 440.0 * 2 ** ((midi - 69) / 12)
        seg = self.mag[:, self.frames(t0, min(t1, t0 + 0.12))]
        if seg.size == 0:
            return float("nan")
        spec = seg.mean(axis=1)
        freqs = np.arange(len(spec)) * self.sr / self.n_fft
        band = freqs < 8000
        tot = spec[band].sum()
        return float((freqs[band] * spec[band]).sum() / tot / f0) if tot > 0 else float("nan")


NATURAL_HARMONICS = {12: 12, 7: 19, 5: 24}


def pre_fingering(notes: list[Note], spec: Spectral, open_midi: tuple[int, ...]) -> list[Hints]:
    hints = [Hints() for _ in notes]
    order = sorted(range(len(notes)), key=lambda i: notes[i].onset)
    for i, n in enumerate(notes):
        v = vibrato(n.pitch_track, n.track_hop) if n.pitch_track else None
        if v is not None:
            hints[i].techniques.append(v)
            hints[i].must_fret = True
        b = bend(n.pitch_track) if n.pitch_track else None
        if b is not None:
            hints[i].techniques.append(b)
            hints[i].must_fret = True
        # natural harmonic: a pure spectrum at open + 12/19/24 on some string, sustained
        if n.duration >= 0.25:
            for fret, interval in NATURAL_HARMONICS.items():
                if any(n.midi - o == interval for o in open_midi):
                    prof = spec.harmonic_profile(n.midi, n.onset + 0.03, n.offset)
                    if prof.sum() > 0 and prof[0] / prof.sum() >= 0.72:
                        hints[i].harmonic_fret = fret
                        hints[i].techniques.append(
                            {
                                "kind": "harmonic",
                                "harmonicFret": fret,
                                "confidence": round(float(prof[0] / prof.sum()) * 0.7, 2),
                            }
                        )
                    break
    # slur candidates: a weak attack within 50 ms of the previous note's end, 1–5 semitones away
    for k, i in enumerate(order):
        n = notes[i]
        if n.onset_strength >= 0.5:
            continue
        for j in reversed(order[max(0, k - 6) : k]):
            p = notes[j]
            if p.onset >= n.onset:
                continue
            gap = n.onset - p.offset
            if -0.08 <= gap <= 0.05 and 1 <= abs(n.midi - p.midi) <= 5:
                hints[i].slur_from = j
                glide = _glides(p, n)
                hints[i].slide = glide
                break
    return hints


def _glides(a: Note, b: Note) -> bool:
    """A slide passes through the pitches in between: the end of ``a``'s track or the start of
    ``b``'s track bends toward the other note."""
    direction = 1 if b.midi > a.midi else -1
    ta = _clean_track(a.pitch_track[-4:]) if a.pitch_track else np.array([])
    tb = _clean_track(b.pitch_track[:3]) if b.pitch_track else np.array([])
    tail_moves = ta.size >= 2 and np.isfinite(ta).all() and direction * (ta[-1] - ta[0]) >= 30
    head_moves = tb.size >= 1 and np.isfinite(tb).all() and direction * tb[0] <= -40
    return bool(tail_moves or head_moves)


def post_fingering(
    notes: list[Note],
    assign: list[Assignment],
    hints: list[Hints],
    spec: Spectral,
    percussive_onsets: np.ndarray,
) -> tuple[list[list[dict[str, Any]]], list[dict[str, Any]]]:
    """Per-note technique lists and percussive events."""
    techs: list[list[dict[str, Any]]] = [list(h.techniques) for h in hints]
    for i, h in enumerate(hints):
        j = h.slur_from
        if j is None or assign[i].course is None or assign[i].course != assign[j].course:
            continue
        up = notes[i].midi > notes[j].midi
        if h.slide:
            techs[i].append(
                {"kind": "slide", "direction": "up" if up else "down", "fromNote": j, "confidence": 0.6}
            )
        else:
            kind = "hammer-on" if up else "pull-off"
            techs[i].append(
                {"kind": kind, "direction": "up" if up else "down", "fromNote": j, "confidence": 0.65}
            )
    # strums / rasgueado and tambora, per event
    by_event: dict[int, list[int]] = {}
    for i, a in enumerate(assign):
        by_event.setdefault(a.event, []).append(i)
    note_onsets = np.array(sorted(n.onset for n in notes)) if notes else np.zeros(0)
    for idx in by_event.values():
        if len(idx) < 4:
            continue
        idx.sort(key=lambda i: notes[i].onset)
        spread = notes[idx[-1]].onset - notes[idx[0]].onset
        courses = [assign[i].course for i in idx if assign[i].course is not None]
        short = all(notes[i].duration < 0.3 for i in idx)
        near_perc = percussive_onsets.size and np.min(np.abs(percussive_onsets - notes[idx[0]].onset)) < 0.04
        if short and near_perc:
            for i in idx:
                techs[i].append({"kind": "tambora", "confidence": 0.5})
        elif spread >= 0.015 and len(courses) >= 4:
            ordered = [assign[i].course for i in idx]
            down = ordered[0] is not None and ordered[-1] is not None and ordered[0] < ordered[-1]
            kind = "rasgueado" if spread >= 0.03 else "strum"
            for i in idx:
                techs[i].append({"kind": kind, "direction": "down" if down else "up", "confidence": 0.6})
    events = []
    for t in percussive_onsets:
        if note_onsets.size and np.min(np.abs(note_onsets - t)) < 0.06:
            continue
        events.append({"time": round(float(t), 3), "kind": "golpe", "strength": 1.0, "confidence": 0.5})
    return techs, events


def percussive_onsets(spec: Spectral, offset: float = 0.0) -> np.ndarray:
    """Sharp broadband transients (golpe, tambora, slaps): peaks of spectral flux above 2 kHz that
    stand out from the plucked-note onsets around them."""
    from scipy.signal import find_peaks

    lo_bin = int(2000 * spec.n_fft / spec.sr)
    hf = np.log1p(spec.mag[lo_bin:])
    flux = np.maximum(np.diff(hf, axis=1), 0.0).sum(axis=0)
    if flux.size < 5:
        return np.zeros(0)
    base = np.convolve(flux, np.ones(43) / 43, mode="same")
    novelty = flux - base
    thresh = np.percentile(novelty, 99.0)
    peaks, _ = find_peaks(novelty, height=thresh, distance=int(0.1 * spec.sr / spec.hop))
    return (peaks + 1) * spec.hop / spec.sr + offset


def velocities(notes: list[Note]) -> list[int]:
    return [int(np.clip(round(20 + 107 * max(n.amplitude, 0.0) ** 0.8), 1, 127)) for n in notes]


def dynamics(
    notes: list[Note], vel: list[int], window: float = 2.0
) -> tuple[list[str], list[dict[str, Any]]]:
    """Per-note dynamic mark and change points, relative to this performance's own range."""
    if not notes:
        return [], []
    v = np.array(vel, dtype=float)
    qs = np.percentile(v, [12, 30, 50, 70, 88])
    onsets = np.array([n.onset for n in notes])
    level = np.array([float(np.median(v[np.abs(onsets - t) <= window / 2])) for t in onsets])

    def mark(x: float) -> str:
        return DYNAMIC_MARKS[int(np.searchsorted(qs, x))]

    marks = [mark(x) for x in level]
    changes: list[dict[str, Any]] = []
    order = np.argsort(onsets)
    current, since = None, -1e9
    for i in order:
        m = marks[i]
        if m != current and onsets[i] - since >= window:
            changes.append({"time": round(float(onsets[i]), 3), "mark": m})
            current, since = m, onsets[i]
    return marks, changes


def articulation(notes: list[Note], vel: list[int]) -> list[tuple[str | None, list[dict[str, Any]]]]:
    onsets = np.array(sorted({round(n.onset, 3) for n in notes}))
    v = np.array(vel, dtype=float)
    out = []
    for i, n in enumerate(notes):
        later = onsets[onsets > n.onset + 0.03]
        ioi = float(later[0] - n.onset) if later.size else None
        extra: list[dict[str, Any]] = []
        art: str | None = "legato"
        if ioi is not None and ioi >= 0.2 and n.duration < 0.45 * ioi:
            art = "staccato"
            extra.append({"kind": "staccato", "confidence": 0.55})
        near = v[[k for k, m in enumerate(notes) if abs(m.onset - n.onset) <= 1.0]]
        if near.size >= 4 and v[i] >= np.median(near) + 18:
            art = "accent"
            extra.append({"kind": "accent", "confidence": 0.55})
        out.append((art, extra))
    return out


def timbre(notes: list[Note], spec: Spectral) -> list[str | None]:
    bright = np.array([spec.brightness(n.midi, n.onset, n.offset) for n in notes])
    out: list[str | None] = []
    for i, n in enumerate(notes):
        same = [k for k, m in enumerate(notes) if abs(m.midi - n.midi) <= 6 and np.isfinite(bright[k])]
        if len(same) < 8 or not np.isfinite(bright[i]):
            out.append(None)
            continue
        ref = bright[same]
        z = (bright[i] - np.median(ref)) / (np.std(ref) + 1e-6)
        out.append("ponticello" if z > 1.5 else "tasto" if z < -1.5 else "ordinario")
    return out


CHORD_TEMPLATES = {
    "": (0, 4, 7),
    "m": (0, 3, 7),
    "7": (0, 4, 7, 10),
    "m7": (0, 3, 7, 10),
    "maj7": (0, 4, 7, 11),
    "dim": (0, 3, 6),
    "m7b5": (0, 3, 6, 10),
}


def chords(notes: list[Note], beats: np.ndarray) -> list[dict[str, Any]]:
    """Beat-level chord labels from the sounding pitch classes (template matching), merged."""
    if len(beats) < 2 or not notes:
        return []
    labels = []
    for a, b in zip(beats[:-1], beats[1:], strict=True):
        hist = np.zeros(12)
        for n in notes:
            overlap = min(n.offset, b) - max(n.onset, a)
            if overlap > 0:
                hist[n.midi % 12] += overlap * (1.5 if n.midi < 52 else 1.0)
        if hist.sum() <= 0:
            labels.append((a, b, None, 0.0))
            continue
        best, best_s = None, -1.0
        for root in range(12):
            for suffix, tpl in CHORD_TEMPLATES.items():
                mask = np.zeros(12)
                mask[[(root + x) % 12 for x in tpl]] = 1
                s = (hist * mask).sum() / hist.sum() - 0.06 * len(tpl)
                if s > best_s:
                    best, best_s = PC_NAMES[root] + suffix, s
        labels.append((a, b, best, best_s))
    merged: list[dict[str, Any]] = []
    for a, b, lab, s in labels:
        if lab is None or s < 0.45:
            continue
        if merged and merged[-1]["label"] == lab and abs(merged[-1]["end"] - a) < 1e-6:
            merged[-1]["end"] = round(float(b), 3)
        else:
            merged.append(
                {
                    "start": round(float(a), 3),
                    "end": round(float(b), 3),
                    "label": lab,
                    "confidence": round(float(min(1.0, s + 0.3)), 2),
                }
            )
    return merged


def key_estimate(notes: list[Note]) -> tuple[str, float]:
    hist = np.zeros(12)
    for n in notes:
        hist[n.midi % 12] += n.duration
    if hist.sum() == 0:
        return "unknown", 0.0
    best, best_r = "unknown", -2.0
    for root in range(12):
        for mode, prof in (("major", KRUMHANSL_MAJOR), ("minor", KRUMHANSL_MINOR)):
            r = float(np.corrcoef(hist, np.roll(prof, root))[0, 1])
            if r > best_r:
                best, best_r = f"{PC_NAMES[root]} {mode}", r
    return best, best_r


def accent_profile(
    notes: list[Note], vel: list[int], measure_beat: list[float], beats_per_bar: int
) -> list[float]:
    """Mean velocity per eighth-note position within the bar (normalised to its maximum)."""
    slots = beats_per_bar * 2
    acc = np.zeros(slots)
    cnt = np.zeros(slots)
    for _n, v, mb in zip(notes, vel, measure_beat, strict=True):
        pos = (mb % beats_per_bar) * 2
        k = int(round(pos))
        if abs(pos - k) <= 0.2:
            acc[k % slots] += v
            cnt[k % slots] += 1
    prof = np.divide(acc, np.maximum(cnt, 1))
    return [round(float(x), 3) for x in (prof / prof.max() if prof.max() > 0 else prof)]


def style_summary(
    notes: list[Note],
    vel: list[int],
    measure_beat: list[float],
    beats_per_bar: int,
    beats: np.ndarray,
    techs: list[list[dict[str, Any]]],
    positions: list[int | None],
) -> dict[str, Any]:
    key, key_r = key_estimate(notes)
    prof = accent_profile(notes, vel, measure_beat, beats_per_bar)
    top3 = sorted(np.argsort(prof)[-3:].tolist()) if len(prof) >= 8 else []
    pattern = "3-3-2" if top3 == [0, 3, 6] else None
    ibi = np.diff(beats) if len(beats) > 2 else np.array([])
    counts: dict[str, int] = {}
    for ts in techs:
        for t in ts:
            counts[t["kind"]] = counts.get(t["kind"], 0) + 1
    used = [p for p in positions if p is not None]
    pos_hist: dict[str, int] = {}
    for p in used:
        pos_hist[str(p)] = pos_hist.get(str(p), 0) + 1
    v = np.array(vel) if vel else np.array([0])
    return {
        "key": key,
        "keyCorrelation": round(key_r, 3),
        "accentProfileEighths": prof,
        "accentPattern": pattern,
        "tempoMedianBpm": round(float(60.0 / np.median(ibi)), 2) if ibi.size else None,
        "rubatoIndex": round(float(np.std(ibi) / np.mean(ibi)), 3) if ibi.size else None,
        "techniqueCounts": counts,
        "handPositionsUsed": pos_hist,
        "velocityRange": [int(np.percentile(v, 5)), int(np.percentile(v, 95))],
        "pitchRange": [min(n.midi for n in notes), max(n.midi for n in notes)] if notes else None,
    }
