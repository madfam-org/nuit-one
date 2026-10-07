from nuit_transcriber import fingering as F
from nuit_transcriber.instrument import Guitar
from nuit_transcriber.synthetic import performance_doc


def _kinds(n):
    return {t["kind"] for t in n["techniques"]}


def _etude():
    doc = performance_doc()
    notes = doc["notes"]
    fn = [
        F.FingerNote(
            n["onset"],
            n["offset"],
            n["midi"],
            1.0,
            must_fret=bool(_kinds(n) & {"vibrato", "bend"}),
            plucked=not (_kinds(n) & {"slide", "hammer-on", "pull-off"}),
            harmonic_fret=12 if "harmonic" in _kinds(n) else None,
            slide="slide" in _kinds(n),
        )
        for n in notes
    ]
    return notes, fn, F.solve(fn, Guitar())


def test_events_keep_a_strum_together_but_split_an_arpeggio():
    strum = [F.FingerNote(0.014 * k, 1.0, 40 + 5 * k) for k in range(6)]
    assert len(F.group_events(strum)) == 1
    arpeggio = [F.FingerNote(0.25 * k, 1.0, 45 + 3 * k) for k in range(4)]
    assert len(F.group_events(arpeggio)) == 4


def test_every_assignment_uses_distinct_strings():
    for opt in F._assignments((45, 57, 60, 64), (40, 45, 50, 55, 59, 64), 19, (False,) * 4):
        assert len({c for c, _ in opt}) == 4


def test_synthetic_etude_accuracy():
    notes, _, sol = _etude()
    truth = [(n["string"], n["fret"]) for n in notes]
    assert F.accuracy(sol.notes, truth) >= 0.9
    lh = sum(a.lh_finger == n["lhFinger"] for a, n in zip(sol.notes, notes, strict=True)) / len(notes)
    rh = sum(a.rh_finger == n["rhFinger"] for a, n in zip(sol.notes, notes, strict=True)) / len(notes)
    assert lh >= 0.8
    assert rh >= 0.85


def test_first_position_arpeggio_uses_the_open_strings():
    notes, _, sol = _etude()
    bar1 = [
        (a.string, a.fret, a.lh_finger, a.rh_finger)
        for a, n in zip(sol.notes, notes, strict=True)
        if n["measure"] == 1
    ]
    assert (5, 0, 0, "p") in bar1  # open A bass with the thumb
    assert (3, 2, 2, "i") in bar1
    assert (2, 1, 1, "m") in bar1
    assert (1, 0, 0, "a") in bar1


def test_barre_and_rasgueado_on_the_f_chord():
    notes, _, sol = _etude()
    f_chord = [a for a, n in zip(sol.notes, notes, strict=True) if n["measure"] == 6]
    assert len(f_chord) == 6
    assert all(a.barre == {"fret": 1, "fromString": 6, "toString": 1} for a in f_chord)
    assert all(a.rh_finger == "i" for a in f_chord)
    fingers = {a.string: a.lh_finger for a in f_chord}
    assert fingers == {6: 1, 5: 3, 4: 4, 3: 2, 2: 1, 1: 1}


def test_harmonics_are_touched_not_pressed_and_vibrato_is_fretted():
    notes, _, sol = _etude()
    for a, n in zip(sol.notes, notes, strict=True):
        if "harmonic" in _kinds(n):
            assert a.fret == 12 and a.lh_finger == 0
        if "vibrato" in _kinds(n):
            assert (a.fret or 0) > 0
        if _kinds(n) & {"slide", "hammer-on"}:
            assert a.rh_finger is None


def test_video_prior_moves_the_hand():
    # E4 alone can be the open 1st string; a confident video position at fret 9 puts it on string 3
    notes = [F.FingerNote(0.0, 0.5, 64, must_fret=True), F.FingerNote(0.5, 1.0, 66, must_fret=True)]
    sol = F.solve(notes, Guitar(), prior=lambda t: (9.0, 1.0))
    assert [(a.string, a.fret) for a in sol.notes] == [(3, 9), (3, 11)]
    plain = F.solve(notes, Guitar())
    assert plain.notes[0].string == 2  # without the video: 5th fret of the 2nd string
