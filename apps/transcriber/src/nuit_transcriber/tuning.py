"""Reference-pitch estimation: how far the whole performance sits from A4 = 440 Hz."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .notes import Note


@dataclass(frozen=True)
class Reference:
    a4_hz: float
    offset_cents: float  # performance tuning relative to A440 (+8 ≈ A442)
    spread_cents: float  # median absolute deviation of note intonation around the reference
    n_notes: int


def weighted_median(values: np.ndarray, weights: np.ndarray) -> float:
    order = np.argsort(values)
    cw = np.cumsum(weights[order])
    return float(values[order][np.searchsorted(cw, cw[-1] / 2.0)])


def estimate_reference(notes: list[Note]) -> Reference:
    """Weighted median of the stable notes' deviations; long, loud notes weigh most."""
    vals, wts = [], []
    for n in notes:
        if "pitch-unmeasured" in n.flags or n.duration < 0.12:
            continue
        vals.append(n.cents_a440)
        wts.append(max(n.amplitude, 0.05) * min(n.duration, 1.0))
    if len(vals) < 8:
        return Reference(440.0, 0.0, float("nan"), len(vals))
    v, w = np.array(vals), np.array(wts)
    ref = weighted_median(v, w)
    mad = weighted_median(np.abs(v - ref), w)
    return Reference(
        a4_hz=440.0 * 2.0 ** (ref / 1200.0), offset_cents=ref, spread_cents=mad, n_notes=len(vals)
    )


def apply_reference(notes: list[Note], ref: Reference) -> None:
    for n in notes:
        n.cents = n.cents_a440 - ref.offset_cents
