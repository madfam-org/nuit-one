import math

from nuit_transcriber.instrument import (
    TUNINGS,
    Guitar,
    InstrumentGeometry,
    Position,
    Tuning,
    from_geometry,
    geometry_to_doc,
    infer_tuning,
    midi_to_name,
)


def test_twelfth_fret_is_half_the_scale():
    g = InstrumentGeometry(scale_length_mm=650.0)
    assert math.isclose(g.fret_distance_mm(12), 325.0)
    assert math.isclose(g.fret_distance_mm(24), 487.5)


def test_first_fret_matches_equal_temperament():
    g = InstrumentGeometry(scale_length_mm=650.0)
    # 650 * (1 - 2^(-1/12)) = 36.4817 mm, the value luthiers approximate with 650 / 17.817
    assert math.isclose(g.fret_distance_mm(1), 36.4817, abs_tol=1e-3)


def test_distance_and_fret_are_inverse():
    g = InstrumentGeometry(scale_length_mm=648.0)
    for fret in (0.5, 3.0, 7.25, 12.0, 18.9):
        assert math.isclose(g.fret_from_distance_mm(g.fret_distance_mm(fret)), fret, abs_tol=1e-9)


def test_strings_fan_from_nut_to_saddle():
    g = InstrumentGeometry()
    lo_nut, hi_nut = g.string_y_mm(0, 6, 0.0), g.string_y_mm(5, 6, 0.0)
    lo_sad, hi_sad = g.string_y_mm(0, 6, g.scale_length_mm), g.string_y_mm(5, 6, g.scale_length_mm)
    assert math.isclose(hi_nut - lo_nut, g.string_spread_nut_mm)
    assert math.isclose(hi_sad - lo_sad, g.string_spread_saddle_mm)
    assert lo_nut < 0 < hi_nut


def test_candidates_cover_every_playable_position():
    guitar = Guitar()
    # E4 (64): open 1st string, 5th fret of the 2nd, 9th of the 3rd, 14th of the 4th, 19th of the 5th
    got = {(guitar.string_number(p.course), p.fret) for p in guitar.candidates(64)}
    assert got == {(1, 0), (2, 5), (3, 9), (4, 14), (5, 19)}
    assert guitar.candidates(39) == []  # below the open low E


def test_capo_shifts_sounding_pitches_and_limits_frets():
    guitar = Guitar(tuning=Tuning("standard", TUNINGS["standard"], capo=2))
    assert guitar.lowest_midi == 42
    pos = guitar.candidates(42)
    assert pos == [Position(course=0, fret=0)]
    assert guitar.absolute_fret(Position(0, 3)) == 5


def test_geometry_round_trip_through_the_document():
    guitar = Guitar(
        geometry=InstrumentGeometry(
            variant="steel-string", scale_length_mm=645.0, fret_count=20, frets_to_body=14
        ),
        tuning=Tuning("drop-d", TUNINGS["drop-d"], a4_hz=442.0),
    )
    doc = geometry_to_doc(guitar)
    back = from_geometry(doc)
    assert back.geometry.scale_length_mm == 645.0
    assert back.geometry.frets_to_body == 14
    assert back.tuning.open_midi == TUNINGS["drop-d"]
    assert math.isclose(back.tuning.a4_hz, 442.0)
    assert len(doc["geometry"]["fretPositionsMm"]) == 21
    assert doc["geometry"]["strings"][0]["stringNumber"] == 6


def test_tuning_inference():
    assert infer_tuning([40, 45, 52, 57] * 10).name == "standard"
    assert infer_tuning([38, 38, 45, 50, 57] * 10).name == "drop-d"
    assert infer_tuning([]).name == "standard"


def test_note_names():
    assert midi_to_name(60) == "C4"
    assert midi_to_name(40) == "E2"
