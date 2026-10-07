"""Beats, downbeats, meter, tempo map and grid quantisation.

Primary tracker: Beat This! (Foscarin, Schlüter, Widmer — ISMIR 2024; MIT-licensed code, checkpoint
fetched from JKU on first use). Fallback: librosa's dynamic-programming beat tracker with a
downbeat guess from onset-strength periodicity, used offline or when the checkpoint is unavailable.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from fractions import Fraction

import numpy as np

log = logging.getLogger(__name__)


@dataclass
class Rhythm:
    beats: np.ndarray
    downbeats: np.ndarray
    beats_per_bar: int
    tempo_bpm: float
    source: str
    tempo_curve: list[tuple[float, float]] = field(default_factory=list)
    first_bar_start: float = 0.0  # time of beat 0 of measure 1 (may precede the first tracked beat)
    lead_bars: int = 0  # whole bars prepended before the first downbeat so every note is in bar >= 1

    def beat_index(self, t: float) -> float:
        """Continuous beat coordinate of time ``t`` (0 = first tracked beat), extrapolated at the ends."""
        b = self.beats
        if len(b) < 2:
            ibi = 60.0 / max(self.tempo_bpm, 1.0)
            return (t - (b[0] if len(b) else 0.0)) / ibi
        if t <= b[0]:
            return (t - b[0]) / (b[1] - b[0])
        if t >= b[-1]:
            return (len(b) - 1) + (t - b[-1]) / (b[-1] - b[-2])
        i = int(np.searchsorted(b, t) - 1)
        return i + (t - b[i]) / (b[i + 1] - b[i])

    def time_of_beat(self, x: float) -> float:
        b = self.beats
        if len(b) < 2:
            return float(b[0] if len(b) else 0.0) + x * 60.0 / max(self.tempo_bpm, 1.0)
        if x <= 0:
            return float(b[0] + x * (b[1] - b[0]))
        if x >= len(b) - 1:
            return float(b[-1] + (x - (len(b) - 1)) * (b[-1] - b[-2]))
        i = int(np.floor(x))
        return float(b[i] + (x - i) * (b[i + 1] - b[i]))

    @property
    def downbeat_offset(self) -> int:
        """Index (in ``beats``) of the first downbeat modulo the bar length."""
        if len(self.downbeats) == 0 or len(self.beats) == 0:
            return 0
        first = int(np.argmin(np.abs(self.beats - self.downbeats[0])))
        return first % self.beats_per_bar

    def bar_and_beat(self, t: float) -> tuple[int, float]:
        """(1-based measure number, 0-based beat within the bar) for time ``t``."""
        x = self.measure_beat(t)
        bar = int(np.floor(x / self.beats_per_bar))
        return bar + 1, x - bar * self.beats_per_bar

    def measure_beat(self, t: float) -> float:
        """Continuous beat coordinate counted from beat 0 of measure 1."""
        return self.beat_index(t) - self.downbeat_offset + self.beats_per_bar * self.lead_bars

    def set_lead_for(self, first_note_time: float) -> None:
        """Prepend whole bars when the first note precedes the first tracked downbeat."""
        x = self.beat_index(first_note_time) - self.downbeat_offset
        self.lead_bars = int(np.ceil(-x / self.beats_per_bar)) if x < 0 else 0
        self.first_bar_start = self.time_of_beat(self.downbeat_offset - self.lead_bars * self.beats_per_bar)


def _meter_from(beats: np.ndarray, downbeats: np.ndarray) -> int:
    if len(downbeats) < 3:
        return 4
    idx = [int(np.argmin(np.abs(beats - d))) for d in downbeats]
    gaps = np.diff(idx)
    gaps = gaps[(gaps >= 2) & (gaps <= 7)]
    if gaps.size == 0:
        return 4
    values, counts = np.unique(gaps, return_counts=True)
    return int(values[np.argmax(counts)])


def _tempo_curve(beats: np.ndarray, smooth: int = 4) -> list[tuple[float, float]]:
    if len(beats) < 3:
        return []
    ibi = np.diff(beats)
    bpm = 60.0 / ibi
    if smooth > 1 and len(bpm) > smooth:
        kernel = np.ones(smooth) / smooth
        bpm = np.convolve(bpm, kernel, mode="same")
    return [(round(float(t), 3), round(float(v), 2)) for t, v in zip(beats[:-1], bpm, strict=True)]


def track_beat_this(audio: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    from beat_this.inference import Audio2Beats

    a2b = Audio2Beats(
        checkpoint_path=os.environ.get("NUIT_BEAT_THIS_CHECKPOINT", "final0"), device="cpu", dbn=False
    )
    beats, downbeats = a2b(audio.astype(np.float32), sr)
    return np.asarray(beats, dtype=float), np.asarray(downbeats, dtype=float)


def track_librosa(audio: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    import librosa

    onset_env = librosa.onset.onset_strength(y=audio, sr=sr)
    _, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, units="frames")
    beats = librosa.frames_to_time(beat_frames, sr=sr)
    if len(beats) < 8:
        return beats, beats[:1]
    strength = onset_env[np.clip(beat_frames, 0, len(onset_env) - 1)]
    best_phase, best = 0, -1.0
    for phase in range(4):
        s = float(strength[phase::4].mean())
        if s > best:
            best_phase, best = phase, s
    return beats, beats[best_phase::4]


def analyse(audio: np.ndarray, sr: int, prefer: str = "beat_this") -> Rhythm:
    beats = downbeats = None
    source = "librosa"
    if prefer == "beat_this" and os.environ.get("NUIT_OFFLINE") != "1":
        try:
            beats, downbeats = track_beat_this(audio, sr)
            source = "beat_this"
        except Exception as exc:  # network, checkpoint or model failure → documented fallback
            log.warning("beat_this unavailable (%s); falling back to librosa", exc)
    if beats is None or len(beats) < 4:
        beats, downbeats = track_librosa(audio, sr)
        source = "librosa"
    beats = np.asarray(beats, dtype=float)
    downbeats = np.asarray(downbeats, dtype=float)
    meter = _meter_from(beats, downbeats)
    tempo = float(60.0 / np.median(np.diff(beats))) if len(beats) > 1 else 120.0
    return Rhythm(
        beats=beats,
        downbeats=downbeats,
        beats_per_bar=meter,
        tempo_bpm=tempo,
        source=source,
        tempo_curve=_tempo_curve(beats),
    )


BINARY_GRID = (Fraction(0), Fraction(1, 4), Fraction(1, 2), Fraction(3, 4))
TERNARY_GRID = (Fraction(0), Fraction(1, 3), Fraction(2, 3), Fraction(1, 6), Fraction(1, 2), Fraction(5, 6))


def quantise_beat(x: float, ternary_bias: float = 0.025) -> tuple[Fraction, float]:
    """Snap a continuous beat coordinate to the nearest 16th or triplet subdivision.

    Returns the snapped coordinate as an exact Fraction and the timing deviation in beats
    (positive = played late). Binary subdivisions win ties unless a triplet fits clearly better.
    """
    whole = int(np.floor(x))
    frac = x - whole
    best_q, best_err = Fraction(0), 9.0
    for grid, bias in ((BINARY_GRID, 0.0), (TERNARY_GRID, ternary_bias)):
        for g in (*grid, Fraction(1)):
            err = abs(frac - float(g)) + bias
            if err < best_err:
                best_q, best_err = g, err
    q = whole + best_q
    return Fraction(q), x - float(q)
