from fractions import Fraction

import numpy as np

from nuit_transcriber.notes import Note
from nuit_transcriber.rhythm import Rhythm, quantise_beat
from nuit_transcriber.tuning import apply_reference, estimate_reference


def test_quantise_prefers_binary_subdivisions():
    q, dev = quantise_beat(2.26)
    assert q == Fraction(9, 4)
    assert abs(dev - 0.01) < 1e-9


def test_quantise_takes_triplets_when_clearly_closer():
    q, _ = quantise_beat(1.334)
    assert q == Fraction(4, 3)


def test_bar_and_beat_with_lead_in():
    beats = np.arange(0.0, 20.0, 0.5)  # 120 bpm
    r = Rhythm(beats=beats, downbeats=beats[2::4], beats_per_bar=4, tempo_bpm=120.0, source="test")
    r.set_lead_for(0.0)  # first note before the first tracked downbeat (t = 1.0)
    assert r.lead_bars == 1
    bar, beat = r.bar_and_beat(1.0)
    assert (bar, beat) == (2, 0.0)
    bar, beat = r.bar_and_beat(0.0)
    assert bar == 1 and abs(beat - 2.0) < 1e-9


def _note(cents: float, dur: float = 0.5, amp: float = 0.6) -> Note:
    return Note(onset=0.0, offset=dur, midi=60, amplitude=amp, onset_strength=0.8, cents_a440=cents)


def test_reference_is_the_weighted_median_deviation():
    notes = [_note(8.0 + d) for d in (-3, -1, 0, 0, 1, 2, 3, 0, 1, -2)] + [_note(45.0, dur=0.13, amp=0.1)]
    ref = estimate_reference(notes)
    assert abs(ref.offset_cents - 8.0) <= 1.0
    assert abs(ref.a4_hz - 442.0) < 0.6  # +8 cents above A440 is A442
    apply_reference(notes, ref)
    assert abs(notes[2].cents) <= 1.0


def test_reference_needs_enough_notes():
    ref = estimate_reference([_note(10.0)] * 3)
    assert ref.a4_hz == 440.0
