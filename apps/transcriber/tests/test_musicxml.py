"""MusicXML exporter: structure, timing, TAB, techniques, fallbacks and a music21 round trip.

Expectations about the synthetic document are derived from the document itself (fingerings, techniques,
dynamics), never copied from one snapshot of the fixture. Small hand-made documents carry only the
fields the exporter reads.
"""

from __future__ import annotations

import copy
import logging
import random
import signal
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from nuit_transcriber.export.musicxml import to_musicxml, write_musicxml
from nuit_transcriber.instrument import midi_to_name
from nuit_transcriber.synthetic import performance_doc

STANDARD = (40, 45, 50, 55, 59, 64)
STEPS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
LIGADOS = ("hammer-on", "pull-off")
Logical = list[tuple[Fraction, Fraction, int, int]]  # (start, end, midi, voice) in quarter notes


# --------------------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------------------


def make_doc(
    notes: list[dict[str, Any]],
    *,
    beats: int = 4,
    unit: int = 4,
    tempo: float = 90.0,
    tuning: tuple[int, ...] = STANDARD,
    capo: int = 0,
    title: str = "Test",
    **extra: Any,
) -> dict[str, Any]:
    """A minimal document: just what the exporter reads."""
    doc: dict[str, Any] = {
        "schema": "nuit.guitar-performance/1",
        "engine": {"name": "nuit-transcriber", "version": "test"},
        "source": {"kind": "synthetic", "id": "test", "title": title},
        "instrument": {
            "family": "guitar",
            "variant": "classical",
            "tuning": {"name": "test", "openMidi": list(tuning), "referenceHz": 440.0, "capo": capo},
        },
        "timing": {"beats": [], "downbeats": [], "beatsPerBar": beats, "beatUnit": unit, "tempoBpm": tempo},
        "notes": notes,
    }
    doc.update(extra)
    return doc


def note(
    ident: int,
    measure: int,
    beat: str,
    duration: str,
    midi: int,
    *,
    voice: int = 1,
    string: int | None = None,
    fret: int | None = None,
    **extra: Any,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": ident,
        "onset": 0.0,
        "offset": 1.0,
        "midi": midi,
        "velocity": 64,
        "confidence": 1.0,
        "measure": measure,
        "beatQuantized": beat,
        "durationBeats": duration,
        "voice": voice,
        "string": string,
        "fret": fret,
        "techniques": [],
    }
    row.update(extra)
    return row


@dataclass
class Unit:
    """One written note or rest, with its position in the bar."""

    measure: int
    staff: int
    voice: int
    tick: int
    duration: int
    midi: int | None  # None for a rest
    el: ET.Element

    @property
    def ties(self) -> set[str]:
        return {t.get("type", "") for t in self.el.findall("tie")}


class Parsed:
    """A MusicXML string read back with a cursor-aware walk (``backup``/``forward``/``chord``)."""

    def __init__(self, xml: str) -> None:
        self.root = ET.fromstring(xml)
        self.divisions = int(self.root.findtext(".//divisions") or 0)
        beats = int(self.root.findtext(".//time/beats") or 0)
        unit = int(self.root.findtext(".//time/beat-type") or 1)
        self.bar = beats * self.divisions * 4 // unit
        self.measures = self.root.findall("part/measure")
        self.units: list[Unit] = []
        self.directions: list[tuple[int, int, ET.Element]] = []  # (measure, tick, element)
        self.sums: Counter[tuple[int, int, int]] = Counter()  # (measure, staff, voice) -> ticks
        for measure in self.measures:
            number = int(measure.get("number", "0"))
            cursor = start = 0
            for el in measure:
                if el.tag == "backup":
                    cursor -= int(el.findtext("duration") or 0)
                elif el.tag == "forward":
                    cursor += int(el.findtext("duration") or 0)
                elif el.tag == "direction":
                    self.directions.append((number, cursor, el))
                elif el.tag == "note":
                    duration = int(el.findtext("duration") or 0)
                    staff, voice = int(el.findtext("staff") or 0), int(el.findtext("voice") or 0)
                    if el.find("chord") is None:
                        start, cursor = cursor, cursor + duration
                        self.sums[(number, staff, voice)] += duration
                    self.units.append(Unit(number, staff, voice, start, duration, self._midi(el), el))

    @staticmethod
    def _midi(el: ET.Element) -> int | None:
        pitch = el.find("pitch")
        if pitch is None:
            return None
        alter = int(pitch.findtext("alter") or 0)
        return STEPS[pitch.findtext("step") or "C"] + alter + 12 * (int(pitch.findtext("octave") or 0) + 1)

    def pitched(self, staff: int) -> list[Unit]:
        return [u for u in self.units if u.staff == staff and u.midi is not None]

    def rests(self, staff: int) -> list[Unit]:
        return [u for u in self.units if u.staff == staff and u.midi is None]

    def find(self, staff: int, measure: int, voice: int, tick: int, midi: int) -> list[Unit]:
        written_voice = voice + (4 if staff == 2 else 0)
        return [
            u
            for u in self.pitched(staff)
            if (u.measure, u.voice, u.tick, u.midi) == (measure, written_voice, tick, midi)
        ]

    def logical(self, staff: int) -> Logical:
        """(start, end, midi, voice) in quarter notes, with tied units merged into one note."""
        merged: list[list[Any]] = []
        open_chain: dict[tuple[int, int], int] = {}
        for u in self.pitched(staff):
            start = (u.measure - 1) * self.bar + u.tick
            key = (u.voice, u.midi or 0)
            if "stop" in u.ties:
                index = open_chain.pop(key)
                assert merged[index][1] == start, (
                    "a tied note must continue exactly where the last unit ended"
                )
                merged[index][1] = start + u.duration
            else:
                merged.append([start, start + u.duration, u.midi, u.voice])
                index = len(merged) - 1
            if "start" in u.ties:
                open_chain[key] = index
        assert not open_chain, "every tie start needs a tie stop"
        d, shift = self.divisions, (4 if staff == 2 else 0)
        return sorted((Fraction(a, d), Fraction(b, d), m, v - shift) for a, b, m, v in merged)


@contextmanager
def time_limit(seconds: int) -> Iterator[None]:
    """Fail with TimeoutError instead of hanging when the body runs too long (POSIX signals)."""

    def on_alarm(signum: int, frame: Any) -> None:
        raise TimeoutError(f"took longer than {seconds} s: the exporter is looping on corrupt input")

    previous = signal.signal(signal.SIGALRM, on_alarm)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


def technique(row: dict[str, Any], kind: str) -> dict[str, Any] | None:
    return next((t for t in row.get("techniques", []) if t["kind"] == kind), None)


def expected_rows(doc: dict[str, Any], divisions: int) -> list[dict[str, Any]]:
    """The document's notes as the exporter should place them: ticks from bar 1, strokes snapped."""
    timing = doc["timing"]
    scale = Fraction(4, timing["beatUnit"]) * divisions  # ticks per beat
    rows = []
    for n in doc["notes"]:
        start = ((n["measure"] - 1) * timing["beatsPerBar"] + Fraction(n["beatQuantized"])) * scale
        rows.append({**n, "start": start, "end": start + Fraction(n["durationBeats"]) * scale})
    strokes: dict[tuple[int, Any], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        strum = technique(row, "rasgueado") or technique(row, "strum")
        if strum:
            strokes[(row["measure"], strum.get("direction"))].append(row)
    for stroke in strokes.values():
        first = min(r["start"] for r in stroke)
        for row in stroke:
            row["start"] = first  # a stroke starts together; its notes keep their own ends
    for row in rows:
        assert row["start"].denominator == 1 and row["end"].denominator == 1, row
        row["start"], row["end"] = int(row["start"]), int(row["end"])
    return rows


def locate(parsed: Parsed, row: dict[str, Any], staff: int) -> Unit:
    """The (single) written unit of a document note on a staff."""
    measure, tick = divmod(row["start"], parsed.bar)
    found = parsed.find(staff, measure + 1, row["voice"], tick, row["midi"])
    assert len(found) == 1, f"note {row['id']} is written {len(found)} times on staff {staff}"
    return found[0]


def dynamics_written(parsed: Parsed) -> list[tuple[int, int, str]]:
    return [
        (m, tick, el.find(".//dynamics")[0].tag)  # type: ignore[index]
        for m, tick, el in parsed.directions
        if el.find(".//dynamics") is not None
    ]


def words_written(parsed: Parsed) -> list[tuple[int, int, str | None]]:
    return [
        (m, tick, el.findtext(".//words"))
        for m, tick, el in parsed.directions
        if el.find(".//words") is not None
    ]


BEAMABLE = {"eighth", "16th", "32nd", "64th"}


def beam_states(
    parsed: Parsed, *, staff: int = 1, voice: int = 1, measure: int = 1
) -> list[tuple[int, str, dict[int, str]]]:
    """(tick, note type or "rest", {beam level: state}) of each chord or rest of one voice pass."""
    rows = []
    for unit in parsed.units:
        if (unit.measure, unit.staff, unit.voice) == (measure, staff, voice) and unit.el.find(
            "chord"
        ) is None:
            beams = {int(b.get("number", "0")): b.text or "" for b in unit.el.findall("beam")}
            rows.append((unit.tick, "rest" if unit.midi is None else unit.el.findtext("type") or "", beams))
    return rows


PLAIN_VALUES = {
    "breve": Fraction(8),
    "whole": Fraction(4),
    "half": Fraction(2),
    "quarter": Fraction(1),
    "eighth": Fraction(1, 2),
    "16th": Fraction(1, 4),
    "32nd": Fraction(1, 8),
    "64th": Fraction(1, 16),
}


def passes_of(parsed: Parsed) -> dict[tuple[int, int, int], list[Unit]]:
    """The first note (or rest) of every chord, by (measure, staff, voice), in time order."""
    passes: dict[tuple[int, int, int], list[Unit]] = defaultdict(list)
    for item in parsed.units:
        if item.el.find("chord") is None:
            passes[(item.measure, item.staff, item.voice)].append(item)
    return passes


def tuplet_groups(units: list[Unit]) -> tuple[list[list[Unit]], list[int | None]]:
    """The tuplet groups of one pass (start..stop) and, for each unit, the number of its group or None."""
    groups: list[list[Unit]] = []
    ids: list[int | None] = []
    current: list[Unit] | None = None
    for item in units:
        kinds = [t.get("type") for t in item.el.findall("notations/tuplet")]
        if "start" in kinds:
            current = []
            groups.append(current)
        ids.append(None if current is None else len(groups) - 1)
        if current is not None:
            current.append(item)
        if "stop" in kinds:
            current = None
    return groups, ids


def tuplet_problems(parsed: Parsed) -> list[str]:
    """Everything wrong with the tuplets of a score: groups open and close, every member carries
    time-modification, the members share one normal-type and last twice that plain note value."""
    problems: list[str] = []
    for item in parsed.units:
        if item.el.find("chord") is not None and item.el.find("notations/tuplet") is not None:
            problems.append(
                f"({item.measure}, {item.staff}, {item.voice}) tick {item.tick}: tuplet on a chord note"
            )
    for key, units in passes_of(parsed).items():
        opened = False
        for item in units:
            where = f"{key} tick {item.tick}"
            kinds = [t.get("type") for t in item.el.findall("notations/tuplet")]
            if kinds.count("start") > 1 or kinds.count("stop") > 1:
                problems.append(f"{where}: repeated tuplet marks")
            if "start" in kinds:
                if opened:
                    problems.append(f"{where}: a group starts inside a group")
                opened = True
            if opened and item.el.find("time-modification") is None:
                problems.append(f"{where}: a group member without time-modification")
            if "stop" in kinds:
                if not opened:
                    problems.append(f"{where}: stop without start")
                opened = False
        if opened:
            problems.append(f"{key}: a tuplet group is left open")
        for group in tuplet_groups(units)[0]:
            names = {m.el.findtext("time-modification/normal-type") for m in group}
            total = sum(m.duration for m in group)
            name = next(iter(names))
            if len(names) != 1 or name not in PLAIN_VALUES:
                problems.append(f"{key}: the group at tick {group[0].tick} mixes normal-types {names}")
            elif total != 2 * PLAIN_VALUES[name] * parsed.divisions:
                problems.append(
                    f"{key}: the group at tick {group[0].tick} lasts {total} ticks, not twice {name}"
                )
    return problems


def beam_problems(parsed: Parsed) -> list[str]:
    """Everything wrong with the beams of a score: groups must open and close, never hold a rest, join only
    touching notes of one beat (one dotted quarter in compound meters) and of one tuplet group, and be as
    long as that allows."""
    unit = int(parsed.root.findtext(".//time/beat-type") or 4)
    beats = int(parsed.root.findtext(".//time/beats") or 4)
    compound = unit >= 8 and beats > 3 and beats % 3 == 0
    window = Fraction(4 * parsed.divisions, unit) * (3 if compound else 1)
    problems: list[str] = []
    for key, units in passes_of(parsed).items():
        groups = tuplet_groups(units)[1]
        open_at: dict[int, bool] = defaultdict(bool)
        first_tick = 0
        for i, item in enumerate(units):
            where = f"{key} tick {item.tick}"
            beams = {int(b.get("number", "0")): b.text or "" for b in item.el.findall("beam")}
            if item.midi is None and beams:
                problems.append(f"{where}: a rest carries beams")
            if any(level > 1 and level - 1 not in beams for level in beams):
                problems.append(f"{where}: a beam level without the one below it")
            for level in range(1, 9):
                state = beams.get(level)
                if state == "begin":
                    if open_at[level]:
                        problems.append(f"{where}: level {level} begins inside a group")
                    open_at[level] = True
                elif state in ("continue", "end"):
                    if not open_at[level]:
                        problems.append(f"{where}: level {level} {state} without begin")
                    open_at[level] = state != "end"
                else:
                    if open_at[level]:
                        problems.append(f"{where}: level {level} left open")
                    open_at[level] = False
                    if state not in (None, "forward hook", "backward hook"):
                        problems.append(f"{where}: unknown beam state {state!r}")
            if beams.get(1) == "begin":
                first_tick = item.tick
            before = units[i - 1] if i else None
            if before is not None and beams.get(1) in ("continue", "end"):
                if before.tick + before.duration != item.tick:
                    problems.append(f"{where}: the group does not touch the previous note")
                if Fraction(item.tick) // window != Fraction(first_tick) // window:
                    problems.append(f"{where}: the group crosses a beat")
                if groups[i - 1] != groups[i]:
                    problems.append(f"{where}: the group crosses a tuplet boundary")
            if (
                before is not None
            ):  # maximal groups: touching beamable notes of one beat and tuplet are joined
                beamable = all(
                    x.midi is not None and x.el.findtext("type") in BEAMABLE for x in (before, item)
                )
                touching = before.tick + before.duration == item.tick
                one_beat = Fraction(before.tick) // window == Fraction(item.tick) // window
                one_tuplet = groups[i - 1] == groups[i]
                if (
                    beamable
                    and touching
                    and one_beat
                    and one_tuplet
                    and beams.get(1) not in ("continue", "end")
                ):
                    problems.append(f"{where}: touching beamable notes are not joined")
        if any(open_at.values()):
            problems.append(f"{key}: a beam is still open at the end of the pass")
    return problems


# --------------------------------------------------------------------------------------------------
# The synthetic etude
# --------------------------------------------------------------------------------------------------


@pytest.fixture(scope="module")
def doc() -> dict[str, Any]:
    return performance_doc()


@pytest.fixture(scope="module")
def xml(doc: dict[str, Any]) -> str:
    return to_musicxml(doc)


@pytest.fixture(scope="module")
def parsed(xml: str) -> Parsed:
    return Parsed(xml)


def test_score_skeleton(doc: dict[str, Any], xml: str, parsed: Parsed) -> None:
    root = parsed.root
    assert xml.startswith('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE score-partwise PUBLIC ')
    assert root.tag == "score-partwise" and root.get("version") == "4.0"
    assert root.findtext("work/work-title") == doc["source"]["title"]
    assert len(root.findall("part")) == 1 and len(root.findall("part-list/score-part")) == 1
    assert root.findtext("part-list/score-part/part-name") in {"Classical Guitar", "Guitar"}
    assert root.findtext(".//attributes/staves") == "2"
    clef1, clef2 = root.findall(".//attributes/clef")
    assert [clef1.get("number"), clef1.findtext("sign"), clef1.findtext("line")] == ["1", "G", "2"]
    assert clef1.findtext("clef-octave-change") == "-1"
    assert [clef2.get("number"), clef2.findtext("sign")] == ["2", "TAB"]


def test_has_seven_measures_and_both_staves(doc: dict[str, Any], parsed: Parsed) -> None:
    assert len(parsed.measures) == 7 == max(n["measure"] for n in doc["notes"])
    assert [m.get("number") for m in parsed.measures] == [str(i) for i in range(1, 8)]
    assert {u.staff for u in parsed.units} == {1, 2}
    assert {u.voice for u in parsed.units if u.staff == 1} <= {1, 2, 3, 4}
    assert {u.voice for u in parsed.units if u.staff == 2} <= {5, 6, 7, 8}
    assert any(u.voice == 2 for u in parsed.units if u.staff == 1), "the bass voice is written"
    assert any(u.voice == 6 for u in parsed.units if u.staff == 2)


def test_tab_staff_details_match_the_tuning(doc: dict[str, Any], parsed: Parsed) -> None:
    tuning = doc["instrument"]["tuning"]
    open_midi = tuning["openMidi"]
    details = parsed.root.findall(".//attributes/staff-details")
    assert len(details) == 1 and details[0].get("number") == "2"
    assert details[0].findtext("staff-lines") == str(len(open_midi))
    assert (details[0].find("capo") is None) == (tuning["capo"] == 0)
    lines = details[0].findall("staff-tuning")
    assert [t.get("line") for t in lines] == [str(i) for i in range(1, len(open_midi) + 1)]
    for staff_tuning, midi in zip(lines, open_midi, strict=True):
        alter = {"1": "#", "-1": "b", "": ""}[staff_tuning.findtext("tuning-alter") or ""]
        written = staff_tuning.findtext("tuning-step") + alter + staff_tuning.findtext("tuning-octave")
        assert written == midi_to_name(midi)


def test_every_voice_sums_to_the_bar_in_every_measure(doc: dict[str, Any], parsed: Parsed) -> None:
    timing = doc["timing"]
    assert (timing["beatsPerBar"], timing["beatUnit"]) == (4, 4)
    assert parsed.bar == timing["beatsPerBar"] * parsed.divisions  # a beat is a quarter note here
    assert parsed.sums, "no voices written"
    assert all(total == parsed.bar for total in parsed.sums.values()), parsed.sums
    for number in range(1, 8):  # both staves have a voice in every measure
        assert {staff for (m, staff, _) in parsed.sums if m == number} == {1, 2}


def test_logical_notes_match_the_document_on_both_staves(doc: dict[str, Any], parsed: Parsed) -> None:
    rows = expected_rows(doc, parsed.divisions)
    d = parsed.divisions
    notation = sorted((Fraction(r["start"], d), Fraction(r["end"], d), r["midi"], r["voice"]) for r in rows)
    tab = sorted(
        (Fraction(r["start"], d), Fraction(r["end"], d), r["midi"], r["voice"])
        for r in rows
        if r["string"] is not None and r["fret"] is not None
    )
    assert parsed.logical(1) == notation
    assert parsed.logical(2) == tab


def test_every_note_with_string_and_fret_has_a_matching_tab_copy(doc: dict[str, Any], parsed: Parsed) -> None:
    rows = [
        r for r in expected_rows(doc, parsed.divisions) if r["string"] is not None and r["fret"] is not None
    ]
    assert rows and len(parsed.pitched(2)) == len(rows)
    for row in rows:
        unit = locate(parsed, row, staff=2)
        assert unit.el.findtext("notations/technical/string") == str(row["string"])
        assert unit.el.findtext("notations/technical/fret") == str(row["fret"])
        assert unit.el.findtext("staff") == "2"


def test_arpeggio_notes_carry_fingering_pluck_and_circled_string(doc: dict[str, Any], parsed: Parsed) -> None:
    rows = [r for r in expected_rows(doc, parsed.divisions) if r["measure"] <= 3 and r["rhFinger"]]
    assert {r["rhFinger"] for r in rows} == {"p", "i", "m", "a"}
    assert any(r["lhFinger"] == 0 for r in rows) and any(r["lhFinger"] for r in rows)
    for row in rows:
        technical = locate(parsed, row, staff=1).el.find("notations/technical")
        assert technical is not None
        assert technical.findtext("pluck") == row["rhFinger"]
        assert technical.findtext("string") == str(row["string"])
        if row["lhFinger"]:
            assert technical.findtext("fingering") == str(row["lhFinger"])
        else:
            assert technical.find("fingering") is None, "open strings carry no left-hand finger"
        assert technical.find("fret") is None  # the fret belongs to the TAB copy


def test_slides_and_ligados_are_start_stop_pairs_on_both_staves(doc: dict[str, Any], parsed: Parsed) -> None:
    rows = {r["id"]: r for r in expected_rows(doc, parsed.divisions)}
    pairs = [(r, t) for r in rows.values() for t in r["techniques"] if "fromNote" in t]
    assert {t["kind"] for _, t in pairs} >= {"slide", "hammer-on"}
    for staff in (1, 2):
        for row, tech in pairs:
            path = "notations/slide" if tech["kind"] == "slide" else f"notations/technical/{tech['kind']}"
            start = locate(parsed, rows[tech["fromNote"]], staff).el.find(f"{path}[@type='start']")
            stop = locate(parsed, row, staff).el.find(f"{path}[@type='stop']")
            assert start is not None and stop is not None, (staff, tech)
            assert start.get("number") == stop.get("number")
            if tech["kind"] in LIGADOS:
                assert start.text == {"hammer-on": "H", "pull-off": "P"}[tech["kind"]]
    spanners = {"slide", "hammer-on", "pull-off", "wavy-line"}  # beams reuse 1-8 as levels: not spanners
    numbers: dict[int, set[str | None]] = {1: set(), 2: set()}
    for u in parsed.units:
        numbers[u.staff].update(el.get("number") for el in u.el.iter() if el.tag in spanners)
    assert numbers[1] and not numbers[1] & numbers[2], "the staves must not share spanner numbers"


def test_vibrato_is_a_wavy_line_on_both_staves(doc: dict[str, Any], parsed: Parsed) -> None:
    rows = [r for r in expected_rows(doc, parsed.divisions) if technique(r, "vibrato")]
    assert rows
    for row in rows:
        for staff in (1, 2):
            lines = locate(parsed, row, staff).el.findall("notations/ornaments/wavy-line")
            assert sorted(w.get("type", "") for w in lines) == ["start", "stop"]
            assert len({w.get("number") for w in lines}) == 1


def test_natural_harmonics_are_written_with_the_sounding_pitch(doc: dict[str, Any], parsed: Parsed) -> None:
    rows = [r for r in expected_rows(doc, parsed.divisions) if technique(r, "harmonic")]
    assert len(rows) >= 2
    for row in rows:
        for staff in (1, 2):
            unit = locate(parsed, row, staff)  # found by the document's (sounding) midi
            assert unit.midi == row["midi"]
            assert unit.el.find("notations/technical/harmonic/natural") is not None
        tab = locate(parsed, row, staff=2).el
        assert tab.findtext("notations/technical/fret") == str(technique(row, "harmonic")["harmonicFret"])  # type: ignore[index]


def test_strum_is_one_arpeggiated_chord_per_voice(doc: dict[str, Any], parsed: Parsed) -> None:
    rows = [r for r in expected_rows(doc, parsed.divisions) if technique(r, "rasgueado")]
    assert len(rows) >= 2
    assert len({r["start"] for r in rows}) == 1, "the stroke starts together (1/48-beat staggers are removed)"
    for staff in (1, 2):
        chords: dict[int, list[Unit]] = defaultdict(list)
        for row in rows:
            unit = locate(parsed, row, staff)
            arpeggiate = unit.el.find("notations/arpeggiate")
            assert arpeggiate is not None and arpeggiate.get("direction") == "down"
            chords[unit.voice].append(unit)
        for units in chords.values():
            assert len({(u.tick, u.duration) for u in units}) == 1
            assert sum(u.el.find("chord") is None for u in units) == 1, "only the first note lacks <chord/>"


def test_tempo_dynamics_and_barre_directions(doc: dict[str, Any], parsed: Parsed) -> None:
    tempo = [el for _, _, el in parsed.directions if el.find(".//metronome") is not None]
    assert len(tempo) == 1
    assert tempo[0].findtext(".//metronome/beat-unit") == "quarter"
    assert tempo[0].findtext(".//metronome/per-minute") == "90"
    assert tempo[0].find("sound").get("tempo") == "90"  # type: ignore[union-attr]

    # a dynamic is written exactly where the effective dynamic changes
    rows = sorted(expected_rows(doc, parsed.divisions), key=lambda r: (r["start"], r["voice"], r["midi"]))
    changes: list[tuple[int, int, str]] = []
    for row in rows:
        if row["dynamic"] and (not changes or row["dynamic"] != changes[-1][2]):
            measure, tick = divmod(row["start"], parsed.bar)
            changes.append((measure + 1, tick, row["dynamic"]))
    assert len(changes) >= 4
    assert dynamics_written(parsed) == changes

    barres = [r for r in rows if r["barre"]]
    assert barres
    first = barres[0]
    measure, tick = divmod(first["start"], parsed.bar)
    assert words_written(parsed) == [(measure + 1, tick, "C I")]


def test_export_is_deterministic_and_leaves_the_document_alone(doc: dict[str, Any]) -> None:
    before = copy.deepcopy(doc)
    assert to_musicxml(doc) == to_musicxml(doc)
    assert doc == before


def test_write_musicxml_writes_utf8(tmp_path: Path, doc: dict[str, Any], xml: str) -> None:
    target = write_musicxml(doc, tmp_path / "etude.musicxml")
    assert target == tmp_path / "etude.musicxml"
    assert target.read_bytes().decode("utf-8") == xml
    assert ET.parse(target).getroot().findtext("work/work-title") == doc["source"]["title"]


def test_music21_round_trip(doc: dict[str, Any], xml: str, parsed: Parsed) -> None:
    from music21 import chord, converter

    score = converter.parseData(xml, format="musicxml")
    assert len(score.parts) == 2  # music21 reads the two staves as two parts
    notation, tab = score.parts
    assert type(next(iter(notation.recurse().getElementsByClass("Clef")))).__name__ == "Treble8vbClef"
    assert type(next(iter(tab.recurse().getElementsByClass("Clef")))).__name__ == "TabClef"

    def sounding(part: Any) -> list[int]:
        found = []
        for element in part.flatten().notes:
            pitches = element.pitches if isinstance(element, chord.Chord) else [element.pitch]
            found += [(float(element.offset), p.midi) for p in pitches]
        return [midi for _, midi in sorted(found)]

    rows = expected_rows(doc, parsed.divisions)
    expected = [r["midi"] for r in sorted(rows, key=lambda r: (r["start"], r["midi"]))]
    assert len(expected) == len(doc["notes"])
    assert sounding(notation) == expected
    assert sounding(tab) == expected


# MusicXML 4.0 fixes the order of these children (the XSD uses xs:sequence); renderers are strict about it.
# Slots that are alternatives (pitch | rest) share a position. "notations" children are an unordered choice.
SEQUENCES = {
    "score-partwise": ["work", "identification", "part-list", "part"],
    "score-part": ["part-name", "part-abbreviation", "score-instrument", "midi-instrument"],
    "attributes": ["divisions", "key", "time", "staves", "clef", "staff-details"],
    "key": ["fifths", "mode"],
    "staff-details": ["staff-lines", "staff-tuning", "capo"],
    "note": [
        "chord",
        "pitch|rest",
        "duration",
        "tie",
        "voice",
        "type",
        "dot",
        "time-modification",
        "stem",
        "staff",
        "beam",
        "notations",
    ],
    "pitch": ["step", "alter", "octave"],
    "time-modification": ["actual-notes", "normal-notes", "normal-type"],
    "direction": ["direction-type", "staff", "sound"],
    "metronome": ["beat-unit", "per-minute"],
    "measure": ["attributes", "direction|note|backup", "barline"],
}


def _in_schema_order(root: ET.Element) -> list[str]:
    problems = []
    for tag, order in SEQUENCES.items():
        slots = {name: i for i, group in enumerate(order) for name in group.split("|")}
        for el in root.iter(tag):
            positions = [slots.get(child.tag, -1) for child in el]
            if -1 in positions or positions != sorted(positions):
                problems.append(f"<{tag}> children {[c.tag for c in el]}")
    return problems


def test_beams_of_the_synthetic_etude_are_well_formed(parsed: Parsed) -> None:
    assert any(el.tag == "beam" for el in parsed.root.iter()), "the arpeggio eighths are beamed"
    assert beam_problems(parsed) == []


def test_children_follow_the_musicxml_sequence_order(parsed: Parsed) -> None:
    triplets = [note(i, 1, str(Fraction(i, 3)), "1/3", 60 + i, string=1, fret=i) for i in range(3)]
    tied = [note(0, 1, "3", "5", 62, string=2, fret=3, techniques=[{"kind": "bend", "extentCents": 100}])]
    docs = [make_doc(triplets, capo=2), make_doc(tied, beats=6, unit=8, style={"key": "Eb major"})]
    for root in [parsed.root, *(Parsed(to_musicxml(d)).root for d in docs)]:
        assert _in_schema_order(root) == []
    assert Parsed(to_musicxml(docs[0])).root.find(".//time-modification") is not None


# --------------------------------------------------------------------------------------------------
# Rhythm: ties, note values, chords, rests
# --------------------------------------------------------------------------------------------------


def test_a_note_crossing_barlines_is_split_and_tied() -> None:
    parsed = Parsed(to_musicxml(make_doc([note(0, 1, "2", "10", 64, string=1, fret=0)])))
    assert len(parsed.measures) == 3
    d = parsed.divisions
    for staff in (1, 2):
        units = parsed.pitched(staff)
        assert [(u.measure, u.tick, u.duration) for u in units] == [
            (1, 2 * d, 2 * d),
            (2, 0, 4 * d),
            (3, 0, 4 * d),
        ]
        assert [sorted(u.ties) for u in units] == [["start"], ["start", "stop"], ["stop"]]
        graphic = [sorted(t.get("type", "") for t in u.el.findall("notations/tied")) for u in units]
        assert graphic == [["start"], ["start", "stop"], ["stop"]]
        assert parsed.logical(staff) == [(Fraction(2), Fraction(12), 64, 1)]
    assert all(total == parsed.bar for total in parsed.sums.values())


def test_triplets_use_time_modification() -> None:
    notes = [note(i, 1, str(Fraction(i, 3)), "1/3", 60 + i) for i in range(3)]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    assert parsed.divisions == 3
    units = parsed.pitched(1)
    assert [u.duration for u in units] == [1, 1, 1]
    for u in units:
        assert u.el.findtext("type") == "eighth"
        modification = u.el.find("time-modification")
        assert modification is not None
        keys = ("actual-notes", "normal-notes", "normal-type")
        assert [modification.findtext(k) for k in keys] == ["3", "2", "eighth"]
    assert all(total == parsed.bar for total in parsed.sums.values())


def test_dotted_and_double_dotted_values() -> None:
    notes = [note(0, 1, "0", "3/2", 60), note(1, 1, "3/2", "1/2", 62), note(2, 1, "2", "7/4", 64)]
    units = Parsed(to_musicxml(make_doc(notes))).pitched(1)
    assert [(u.el.findtext("type"), len(u.el.findall("dot"))) for u in units] == [
        ("quarter", 1),
        ("eighth", 0),
        ("quarter", 2),
    ]


def test_a_span_that_is_not_one_note_value_becomes_tied_values() -> None:
    parsed = Parsed(to_musicxml(make_doc([note(0, 1, "0", "5/4", 67)])))
    units = parsed.pitched(1)
    assert [(u.el.findtext("type"), u.ties) for u in units] == [("quarter", {"start"}), ("16th", {"stop"})]
    assert parsed.logical(1) == [(Fraction(0), Fraction(5, 4), 67, 1)]


def test_chord_notes_share_a_duration_and_only_the_first_lacks_chord() -> None:
    chord_notes = [(52, 4, 2), (57, 3, 2), (64, 1, 0)]
    notes = [note(i, 1, "0", "2", p, string=s, fret=f) for i, (p, s, f) in enumerate(chord_notes)]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    for staff in (1, 2):
        units = parsed.pitched(staff)
        assert [u.midi for u in units] == [52, 57, 64], "lowest note first"
        assert [u.el.find("chord") is None for u in units] == [True, False, False]
        assert len({(u.tick, u.duration) for u in units}) == 1


def test_a_chord_with_unequal_durations_splits_at_the_shortest_with_ties() -> None:
    notes = [
        note(0, 1, "0", "1", 60, string=2, fret=1),
        note(1, 1, "0", "2", 64, string=1, fret=0),
        note(2, 1, "0", "4", 48, string=5, fret=3),
    ]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    d = parsed.divisions
    for staff in (1, 2):
        chords: dict[int, list[Unit]] = defaultdict(list)
        for u in parsed.pitched(staff):
            chords[u.tick].append(u)
        assert {tick: sorted(u.midi or 0 for u in units) for tick, units in chords.items()} == {
            0: [48, 60, 64],  # the chord is as long as the shortest note ...
            d: [48, 64],  # ... the longer notes continue, tied
            2 * d: [48],
        }
        assert {u.midi: sorted(u.ties) for u in chords[0]} == {48: ["start"], 60: [], 64: ["start"]}
        assert parsed.logical(staff) == [
            (Fraction(0), Fraction(1), 60, 1),
            (Fraction(0), Fraction(2), 64, 1),
            (Fraction(0), Fraction(4), 48, 1),
        ]


def test_partly_overlapping_notes_in_one_voice_keep_their_length() -> None:
    parsed = Parsed(to_musicxml(make_doc([note(0, 1, "0", "2", 60), note(1, 1, "1", "2", 64)])))
    assert parsed.logical(1) == [(Fraction(0), Fraction(2), 60, 1), (Fraction(1), Fraction(3), 64, 1)]
    assert all(total == parsed.bar for total in parsed.sums.values())


def test_gaps_are_rests_and_tab_rests_are_hidden() -> None:
    parsed = Parsed(to_musicxml(make_doc([note(0, 1, "2", "1", 60, string=2, fret=1)])))
    d = parsed.divisions
    notation, tab = parsed.rests(1), parsed.rests(2)
    assert [(r.tick, r.duration, r.el.findtext("type")) for r in notation] == [
        (0, 2 * d, "half"),
        (3 * d, d, "quarter"),
    ]
    assert [(r.tick, r.duration) for r in tab] == [(r.tick, r.duration) for r in notation]
    assert all(r.el.get("print-object") is None for r in notation)
    assert all(r.el.get("print-object") == "no" for r in tab)


def test_an_empty_first_voice_is_a_measure_rest_and_voice_two_only_appears_where_used() -> None:
    notes = [note(0, 1, "0", "4", 45, voice=2, string=5, fret=0), note(1, 2, "0", "4", 60, voice=1)]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    first_voice = [u for u in parsed.rests(1) if u.measure == 1]
    assert len(first_voice) == 1
    assert first_voice[0].el.find("rest").get("measure") == "yes"  # type: ignore[union-attr]
    assert first_voice[0].el.find("type") is None
    assert {(u.measure, u.voice) for u in parsed.units if u.staff == 1} == {(1, 1), (1, 2), (2, 1)}
    assert {(u.measure, u.voice) for u in parsed.units if u.staff == 2} == {(1, 5), (1, 6), (2, 5)}
    assert all(u.el.get("print-object") == "no" for u in parsed.rests(2))


def test_notes_without_string_or_fret_are_notation_only() -> None:
    notes = [
        note(0, 1, "0", "1", 60, string=2, fret=1),
        note(1, 1, "1", "1", 62),
        note(2, 1, "2", "1", 64, string=1, fret=None),
        note(3, 1, "3", "1", 65, string=None, fret=1),
    ]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    assert [u.midi for u in parsed.pitched(1)] == [60, 62, 64, 65]
    assert [u.midi for u in parsed.pitched(2)] == [60]
    assert all(total == parsed.bar for total in parsed.sums.values())
    # a string alone still gets its circled number on the notation staff, but there is no TAB entry
    assert parsed.pitched(1)[2].el.findtext("notations/technical/string") == "1"


def test_capo_and_flat_tuning_are_written_in_staff_details() -> None:
    half_step_down = (39, 44, 49, 54, 58, 63)
    doc = make_doc([note(0, 1, "0", "1", 62, string=2, fret=3)], tuning=half_step_down, capo=2)
    parsed = Parsed(to_musicxml(doc))
    details = parsed.root.find(".//staff-details")
    assert details is not None and details.findtext("capo") == "2"
    spelled = [
        (t.findtext("tuning-step"), t.findtext("tuning-alter"), t.findtext("tuning-octave"))
        for t in details.findall("staff-tuning")
    ]
    assert spelled == [
        ("E", "-1", "2"),
        ("A", "-1", "2"),
        ("D", "-1", "3"),
        ("G", "-1", "3"),
        ("B", "-1", "3"),
        ("E", "-1", "4"),
    ]
    assert parsed.pitched(2)[0].el.findtext("notations/technical/fret") == "3"  # frets count from the capo


def test_six_eight_uses_the_beat_unit_for_bars_and_tempo() -> None:
    notes = [
        note(0, 1, "0", "2", 60),
        note(1, 1, "2", "1", 62),
        note(2, 1, "3", "3", 64),
        note(3, 2, "0", "6", 65),
    ]
    parsed = Parsed(to_musicxml(make_doc(notes, beats=6, unit=8, tempo=120.0)))
    assert (parsed.root.findtext(".//time/beats"), parsed.root.findtext(".//time/beat-type")) == ("6", "8")
    assert parsed.bar == 3 * parsed.divisions  # six eighths are three quarter notes
    assert all(total == parsed.bar for total in parsed.sums.values())
    assert [(u.el.findtext("type"), len(u.el.findall("dot"))) for u in parsed.pitched(1)] == [
        ("quarter", 0),
        ("eighth", 0),
        ("quarter", 1),
        ("half", 1),
    ]
    tempo = parsed.root.find(".//direction")
    assert tempo is not None
    assert tempo.findtext(".//metronome/beat-unit") == "eighth"
    assert tempo.findtext(".//metronome/per-minute") == "120"
    assert tempo.find("sound").get("tempo") == "60"  # type: ignore[union-attr]  # quarter notes per minute


def test_off_grid_fractions_fall_back_to_the_one_forty_eighth_grid() -> None:
    notes = [note(i, 1, str(Fraction(i, 5)), "1/5", 60 + i, string=1, fret=i) for i in range(4)]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    assert parsed.divisions == 48
    assert all(total == parsed.bar for total in parsed.sums.values())
    starts = [int(start * 48) for start, _, _, _ in parsed.logical(1)]  # tied units merged back
    assert starts == [round(i * 48 / 5) for i in range(4)]


def test_eighths_are_beamed_per_beat_and_a_lone_note_keeps_its_flag() -> None:
    notes = [note(0, 1, "1/2", "1/2", 60), note(1, 1, "1", "1/2", 62), note(2, 1, "3/2", "1/2", 64)]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    assert beam_states(parsed) == [
        (0, "rest", {}),
        (1, "eighth", {}),  # alone in its beat
        (2, "eighth", {1: "begin"}),
        (3, "eighth", {1: "end"}),
        (4, "rest", {}),
    ]
    assert beam_problems(parsed) == []


def test_sixteenths_carry_two_beams_and_odd_values_get_hooks() -> None:
    spec = [("0", "1/4"), ("1/4", "1/4"), ("1/2", "1/2"), ("1", "1/2"), ("3/2", "1/4"), ("7/4", "1/4")]
    spec += [("2", "3/4"), ("11/4", "1/4"), ("3", "1/4")]  # dotted eighth + 16th, then a lone 16th
    parsed = Parsed(to_musicxml(make_doc([note(i, 1, b, d, 60 + i) for i, (b, d) in enumerate(spec)])))
    assert parsed.divisions == 4
    assert beam_states(parsed)[:9] == [
        (0, "16th", {1: "begin", 2: "begin"}),
        (1, "16th", {1: "continue", 2: "end"}),
        (2, "eighth", {1: "end"}),
        (4, "eighth", {1: "begin"}),
        (6, "16th", {1: "continue", 2: "begin"}),
        (7, "16th", {1: "end", 2: "end"}),
        (8, "eighth", {1: "begin"}),
        (11, "16th", {1: "end", 2: "backward hook"}),
        (12, "16th", {}),
    ]
    assert beam_problems(parsed) == []


def test_compound_meter_beams_dotted_quarter_groups() -> None:
    parsed = Parsed(
        to_musicxml(make_doc([note(i, 1, str(i), "1", 60 + i) for i in range(6)], beats=6, unit=8))
    )
    assert [states for _, _, states in beam_states(parsed)] == [
        {1: "begin"},
        {1: "continue"},
        {1: "end"},
        {1: "begin"},
        {1: "continue"},
        {1: "end"},
    ]
    assert beam_problems(parsed) == []


def test_triplet_eighths_are_beamed_together_and_quarters_are_not_beamed() -> None:
    notes = [note(i, 1, str(Fraction(i, 3)), "1/3", 60 + i) for i in range(3)] + [note(3, 1, "1", "1", 65)]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    assert [(typ, states) for _, typ, states in beam_states(parsed)[:4]] == [
        ("eighth", {1: "begin"}),
        ("eighth", {1: "continue"}),
        ("eighth", {1: "end"}),
        ("quarter", {}),
    ]
    assert beam_problems(parsed) == []


def test_every_note_of_a_beamed_chord_carries_the_same_beams() -> None:
    notes = [note(0, 1, "0", "1/2", 60), note(1, 1, "0", "1/2", 64), note(2, 1, "1/2", "1/2", 62)]
    units = Parsed(to_musicxml(make_doc(notes))).pitched(1)
    first_chord = [[(b.get("number"), b.text) for b in u.el.findall("beam")] for u in units if u.tick == 0]
    assert first_chord == [[("1", "begin")], [("1", "begin")]]


def test_the_beam_checker_rejects_broken_groups() -> None:
    parsed = Parsed(to_musicxml(make_doc([note(0, 1, "0", "1/2", 60), note(1, 1, "1/2", "1/2", 62)])))
    assert beam_problems(parsed) == []
    first, second = (u.el.find("beam") for u in parsed.pitched(1))
    assert first is not None and second is not None
    first.text = "continue"  # a continue with no begin
    assert beam_problems(parsed)
    first.text, second.text = "begin", "continue"  # a group that never ends
    assert beam_problems(parsed)
    first.text, second.text = "begin", "end"
    assert beam_problems(parsed) == []
    second.set("number", "2")  # a second-level beam without a first-level one
    assert beam_problems(parsed)


# --------------------------------------------------------------------------------------------------
# Techniques and directions on hand-made documents
# --------------------------------------------------------------------------------------------------


def test_bend_tambora_let_ring_and_articulations_appear_on_both_staves() -> None:
    bend = [{"kind": "bend", "direction": "up", "extentCents": 200}]
    notes = [
        note(0, 1, "0", "1", 60, string=2, fret=1, techniques=bend),
        note(1, 1, "1", "1", 62, string=2, fret=3, articulation="staccato"),
        note(2, 1, "2", "1", 64, string=1, fret=0, techniques=[{"kind": "accent"}, {"kind": "tambora"}]),
        note(3, 1, "3", "1", 65, string=1, fret=1, techniques=[{"kind": "let-ring"}, {"kind": "staccato"}]),
    ]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    for staff in (1, 2):
        bent, staccato, accent_tambora, ring = (u.el for u in parsed.pitched(staff))
        assert bent.findtext("notations/technical/bend/bend-alter") == "2"
        assert [e.tag for e in staccato.find("notations/articulations")] == ["staccato"]  # type: ignore[union-attr]
        assert [e.tag for e in accent_tambora.find("notations/articulations")] == ["accent"]  # type: ignore[union-attr]
        assert accent_tambora.findtext("notations/technical/other-technical") == "tamb."
        assert ring.findtext("notations/technical/other-technical") == "let ring"
        assert [e.tag for e in ring.find("notations/articulations")] == ["staccato"]  # type: ignore[union-attr]


def test_pull_off_and_down_bend_follow_the_technique_kind() -> None:
    notes = [
        note(0, 1, "0", "1", 65, string=1, fret=1),
        note(1, 1, "1", "1", 64, string=1, fret=0, techniques=[{"kind": "pull-off", "fromNote": 0}]),
        note(
            2,
            1,
            "2",
            "1",
            62,
            string=2,
            fret=3,
            techniques=[{"kind": "bend", "direction": "down", "extentCents": 50}],
        ),
    ]
    units = Parsed(to_musicxml(make_doc(notes))).pitched(1)
    assert units[0].el.find("notations/technical/pull-off[@type='start']").text == "P"  # type: ignore[union-attr]
    assert units[1].el.find("notations/technical/pull-off[@type='stop']") is not None
    assert units[2].el.findtext("notations/technical/bend/bend-alter") == "-0.5"


def test_harmonic_tab_fret_is_the_touched_fret_while_the_pitch_sounds() -> None:
    harmonic = [{"kind": "harmonic", "harmonicFret": 7}]
    notes = [note(0, 1, "0", "4", 74, string=3, fret=19, techniques=harmonic, flags=["harmonic-node"])]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    notation, tab = parsed.pitched(1)[0], parsed.pitched(2)[0]
    assert notation.midi == tab.midi == 74
    assert tab.el.findtext("notations/technical/fret") == "7"
    assert tab.el.findtext("notations/technical/string") == "3"
    assert notation.el.find("notations/technical/harmonic/natural") is not None


def test_a_tied_note_carries_its_marks_once_and_its_vibrato_from_first_to_last_unit() -> None:
    techniques = [{"kind": "harmonic", "harmonicFret": 12}, {"kind": "vibrato"}]
    units = Parsed(
        to_musicxml(make_doc([note(0, 1, "0", "6", 76, string=1, fret=12, techniques=techniques)]))
    ).pitched(1)
    assert len(units) == 2
    assert [u.el.find("notations/technical/harmonic") is not None for u in units] == [True, False]
    waves = [[w.get("type") for w in u.el.findall("notations/ornaments/wavy-line")] for u in units]
    assert waves == [["start"], ["stop"]]


def test_strokes_are_separate_chords_and_a_lone_stroke_gets_no_arpeggiate() -> None:
    def strum(direction: str) -> list[dict[str, str]]:
        return [{"kind": "rasgueado", "direction": direction}]

    notes = [
        note(0, 1, "0", "1/4", 40, string=6, fret=0, techniques=strum("down")),
        note(1, 1, "0", "1/4", 45, string=5, fret=0, techniques=strum("down")),
        note(2, 1, "1/4", "1/4", 45, string=5, fret=0, techniques=strum("up")),
        note(3, 1, "1/4", "1/4", 50, string=4, fret=0, techniques=strum("up")),
        note(4, 1, "1", "1", 52, string=4, fret=2, techniques=strum("down")),
        note(5, 1, "2", "1", 59, string=2, fret=0, techniques=strum("down")),
        note(6, 1, "2", "1", 64, string=1, fret=0, techniques=strum("down")),
    ]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    assert parsed.divisions == 4  # sixteenths
    written = []
    for u in parsed.pitched(1):
        arpeggiate = u.el.find("notations/arpeggiate")
        written.append((u.tick, u.midi, None if arpeggiate is None else arpeggiate.get("direction")))
    assert written == [
        (0, 40, "down"),
        (0, 45, "down"),
        (1, 45, "up"),
        (1, 50, "up"),
        (4, 52, None),
        (8, 59, "down"),
        (8, 64, "down"),
    ]


def test_slides_with_an_unknown_source_note_are_skipped_with_a_warning(
    caplog: pytest.LogCaptureFixture,
) -> None:
    notes = [
        note(0, 1, "0", "1", 60, string=2, fret=1),
        note(1, 1, "1", "1", 62, string=2, fret=3, techniques=[{"kind": "slide", "fromNote": 99}]),
        note(2, 1, "2", "1", 64, string=1, fret=0, techniques=[{"kind": "hammer-on"}]),
    ]
    with caplog.at_level(logging.WARNING, logger="nuit_transcriber.export.musicxml"):
        root = ET.fromstring(to_musicxml(make_doc(notes)))
    assert root.find(".//slide") is None and root.find(".//hammer-on") is None
    assert sum("ignored" in r.getMessage() for r in caplog.records) == 2


def test_barre_words_are_full_or_half_and_repeat_only_after_a_gap() -> None:
    full = {"fret": 5, "fromString": 6, "toString": 1}
    half = {"fret": 5, "fromString": 4, "toString": 1}
    notes = [
        note(0, 1, "0", "1", 69, barre=full),
        note(1, 1, "0", "1", 64, barre=full),  # same onset and barre: still one sign
        note(2, 1, "1", "1", 69, barre=full),  # held barre, no new sign
        note(3, 1, "2", "1", 72, barre=half),  # a different barre
        note(4, 2, "0", "1", 72, barre=half),  # released in between (a gap), put down again
    ]
    parsed = Parsed(to_musicxml(make_doc(notes)))
    d = parsed.divisions
    assert words_written(parsed) == [(1, 0, "C V"), (1, 2 * d, "½C V"), (2, 0, "½C V")]
    assert all(
        el.findtext("staff") == "1" and el.get("placement") == "above" for _, _, el in parsed.directions
    )


def test_dynamics_come_from_the_timeline_when_notes_carry_none() -> None:
    notes = [note(i, 1, str(i), "1", 60 + i, onset=float(i), offset=i + 0.9, dynamic=None) for i in range(4)]
    timeline = [{"time": 0.0, "mark": "p"}, {"time": 2.0, "mark": "f"}]
    parsed = Parsed(to_musicxml(make_doc(notes, tempo=60.0, dynamics=timeline)))
    assert dynamics_written(parsed) == [(1, 0, "p"), (1, 2 * parsed.divisions, "f")]


def test_a_notes_own_dynamic_wins_over_the_timeline() -> None:
    notes = [
        note(0, 1, "0", "2", 60, onset=0.0, offset=1.0, dynamic="mf"),
        note(1, 1, "2", "2", 62, onset=2.0, offset=3.0, dynamic=None),
    ]
    parsed = Parsed(to_musicxml(make_doc(notes, tempo=60.0, dynamics=[{"time": 0.0, "mark": "pp"}])))
    assert [mark for _, _, mark in dynamics_written(parsed)] == ["mf", "pp"]


def test_corrupt_optional_fields_are_ignored_not_fatal() -> None:
    row = note(
        0,
        1,
        "0",
        "1",
        60,
        string=2,
        fret=1,
        dynamic=["f"],
        rhFinger={"p": 1},
        lhFinger="2",
        articulation=["staccato"],
        barre={"fret": "five"},
        techniques=[
            {"kind": {"x": 1}},
            {"kind": ["slide"]},
            "vibrato",
            None,
            {"kind": "bend", "extentCents": "lots"},
        ],
    )
    junk_timeline = [{"time": 0.0, "mark": {"a": 1}}, "junk", {"time": "now", "mark": "p"}]
    parsed = Parsed(to_musicxml(make_doc([row], dynamics=junk_timeline)))
    technical = parsed.pitched(1)[0].el.find("notations/technical")
    assert technical is not None
    assert technical.find("pluck") is None and technical.find("fingering") is None
    assert technical.findtext("bend/bend-alter") == "1"  # an unreadable extent falls back to a half step
    assert dynamics_written(parsed) == [] and words_written(parsed) == []
    assert parsed.pitched(1)[0].el.find("notations/articulations") is None


# --------------------------------------------------------------------------------------------------
# Key, spelling, text
# --------------------------------------------------------------------------------------------------


def _line(pitches: list[tuple[int, int, int]], **extra: Any) -> dict[str, Any]:
    """(midi, start beat, beats) triples laid out in 4/4."""
    return make_doc(
        [note(i, 1 + b // 4, str(b % 4), str(d), p) for i, (p, b, d) in enumerate(pitches)], **extra
    )


def _spelled(parsed: Parsed) -> set[tuple[str, int]]:
    return {
        (p.findtext("step") or "", int(p.findtext("alter") or 0))
        for p in parsed.root.iterfind(".//note/pitch")
    }


F_MAJOR = [(65, 0, 2), (69, 2, 1), (72, 3, 1), (70, 4, 1), (69, 5, 1), (67, 6, 1), (65, 7, 1), (65, 8, 4)]
G_MAJOR = [(67, 0, 2), (71, 2, 1), (74, 3, 1), (66, 4, 1), (64, 5, 1), (62, 6, 1), (67, 7, 1), (67, 8, 4)]
E_MINOR = [(64, 0, 2), (67, 2, 1), (71, 3, 1), (66, 4, 1), (69, 5, 1), (67, 6, 1), (64, 7, 1), (64, 8, 4)]


@pytest.mark.parametrize(
    ("melody", "fifths", "mode", "accidental"),
    [
        pytest.param(F_MAJOR, "-1", "major", ("B", -1), id="F major spells B-flat"),
        pytest.param(G_MAJOR, "1", "major", ("F", 1), id="G major spells F-sharp"),
        pytest.param(E_MINOR, "1", "minor", ("F", 1), id="E minor spells F-sharp"),
    ],
)
def test_the_key_is_estimated_and_pitches_are_spelled_in_it(
    melody: list[tuple[int, int, int]], fifths: str, mode: str, accidental: tuple[str, int]
) -> None:
    parsed = Parsed(to_musicxml(_line(melody)))  # no style.key in this document
    assert parsed.root.findtext(".//key/fifths") == fifths
    assert parsed.root.findtext(".//key/mode") == mode
    assert accidental in _spelled(parsed)


@pytest.mark.parametrize(
    ("name", "fifths", "mode"),
    [
        ("A minor", "0", "minor"),
        ("Bb major", "-2", "major"),
        ("F#m", "3", "minor"),
        ("Eb", "-3", "major"),
        ("C# minor", "4", "minor"),
        ("D minor", "-1", "minor"),
        ("G", "1", "major"),
    ],
)
def test_style_key_names_are_understood(name: str, fifths: str, mode: str) -> None:
    parsed = Parsed(to_musicxml(make_doc([note(0, 1, "0", "1", 60)], style={"key": name})))
    assert (parsed.root.findtext(".//key/fifths"), parsed.root.findtext(".//key/mode")) == (fifths, mode)


def test_an_unreadable_style_key_falls_back_to_the_estimate() -> None:
    parsed = Parsed(to_musicxml(_line(F_MAJOR, style={"key": "A dorian"})))
    assert parsed.root.findtext(".//key/fifths") == "-1"


def test_title_is_escaped_and_cleaned_of_characters_xml_cannot_hold(tmp_path: Path) -> None:
    title = "Rock & Roll <live> \x00\x0b" + chr(0xD800) + "é"
    doc = make_doc([note(0, 1, "0", "1", 60)], title=title)
    assert Parsed(to_musicxml(doc)).root.findtext("work/work-title") == "Rock & Roll <live> é"
    assert ET.parse(write_musicxml(doc, tmp_path / "t.musicxml")).getroot().tag == "score-partwise"


def test_part_name_follows_the_instrument_variant() -> None:
    nylon = make_doc([note(0, 1, "0", "1", 60)])
    steel = copy.deepcopy(nylon)
    steel["instrument"]["variant"] = "steel-string"
    assert Parsed(to_musicxml(nylon)).root.findtext(".//part-name") == "Classical Guitar"
    assert Parsed(to_musicxml(steel)).root.findtext(".//part-name") == "Guitar"


# --------------------------------------------------------------------------------------------------
# Raw engine output (no quantised fields) and in-memory documents
# --------------------------------------------------------------------------------------------------


def _strip_quantised(doc: dict[str, Any]) -> dict[str, Any]:
    raw = copy.deepcopy(doc)
    for n in raw["notes"]:
        for key in ("measure", "beat", "beatQuantized", "durationBeats", "timingDeviationBeats"):
            n.pop(key, None)
    return raw


def test_raw_notes_export_exactly_like_quantised_ones(doc: dict[str, Any], xml: str) -> None:
    assert to_musicxml(_strip_quantised(doc)) == xml


def test_raw_notes_survive_timing_jitter_and_a_missing_first_bar_start(doc: dict[str, Any], xml: str) -> None:
    rng = random.Random(7)
    raw = _strip_quantised(doc)
    for n in raw["notes"]:
        n["onset"] += rng.uniform(-0.025, 0.025)
        n["offset"] += rng.uniform(-0.025, 0.025)
    assert to_musicxml(raw) == xml
    del raw["timing"]["firstBarStart"]
    assert to_musicxml(raw) == xml


def test_raw_notes_without_a_beat_grid_use_the_tempo() -> None:
    # 120 bpm without any tracked beats: a beat is 0.5 s; each note lasts 0.375 s = 3/4 of a beat
    notes = [
        {
            "id": i,
            "onset": 0.5 * i,
            "offset": 0.5 * i + 0.375,
            "midi": 60 + i,
            "velocity": 64,
            "confidence": 1.0,
        }
        for i in range(8)
    ]
    doc = make_doc(notes, tempo=120.0)
    del doc["timing"]["beats"], doc["timing"]["downbeats"]
    parsed = Parsed(to_musicxml(doc))
    d = parsed.divisions
    assert [(u.measure, u.tick) for u in parsed.pitched(1)] == [(1 + i // 4, (i % 4) * d) for i in range(8)]
    assert all(end - start == Fraction(3, 4) for start, end, _, _ in parsed.logical(1))


def test_a_partly_quantised_note_mixes_both_sources() -> None:
    row = note(0, 2, "1/2", "1", 60)
    row.update(onset=0.0, offset=2.0)
    del row["durationBeats"]  # recovered from the times: 2 s at 60 bpm is 2 beats
    parsed = Parsed(to_musicxml(make_doc([row], tempo=60.0)))
    assert parsed.logical(1) == [(Fraction(9, 2), Fraction(13, 2), 60, 1)]


def test_numpy_typed_documents_export_like_plain_ones(doc: dict[str, Any], xml: str) -> None:
    def arrayify(value: Any) -> Any:
        if isinstance(value, dict):
            return {k: arrayify(v) for k, v in value.items()}
        if isinstance(value, bool):
            return value
        if isinstance(value, int):
            return np.int64(value)
        if isinstance(value, float):
            return np.float64(value)
        if isinstance(value, list):
            if value and all(isinstance(i, float) for i in value):
                return np.array(value)
            return [arrayify(i) for i in value]
        return value

    typed = arrayify(copy.deepcopy(doc))
    assert isinstance(typed["timing"]["beats"], np.ndarray)
    assert to_musicxml(typed) == xml
    assert to_musicxml(_strip_quantised(typed)) == xml


# --------------------------------------------------------------------------------------------------
# Bad input
# --------------------------------------------------------------------------------------------------

DELETE = object()


@pytest.mark.parametrize(
    ("path", "value", "message"),
    [
        pytest.param(
            ("schema",), "nuit.guitar-performance/2", "unsupported document schema", id="wrong schema"
        ),
        pytest.param(("timing",), DELETE, "no 'timing' object", id="no timing"),
        pytest.param(("timing", "beatUnit"), 3, "beatUnit must be a power of two", id="beat unit 3"),
        pytest.param(
            ("timing", "beatsPerBar"), 0, "beatsPerBar must be an integer from 1 to", id="zero beats"
        ),
        pytest.param(
            ("timing", "beatsPerBar"), 10**6, "beatsPerBar must be an integer from 1 to", id="huge bar"
        ),
        pytest.param(("notes",), "not a list", "'notes' must be a list", id="notes not a list"),
        pytest.param(
            ("instrument", "tuning", "openMidi"), [], "must hold 1 to 24 MIDI pitches", id="no strings"
        ),
        pytest.param(
            ("instrument", "tuning", "openMidi"), [40] * 25, "must hold 1 to 24 MIDI", id="25 strings"
        ),
        pytest.param(("notes", 0, "midi"), 200, "'midi' must be an integer", id="midi too high"),
        pytest.param(("notes", 0, "midi"), None, "'midi' must be an integer", id="no midi"),
        pytest.param(("notes", 0, "measure"), 10**9, "would exceed", id="absurd measure"),
        pytest.param(("notes", 0, "durationBeats"), "1/0", "divides by zero", id="zero denominator"),
        pytest.param(("notes", 0, "beatQuantized"), "one", "not an exact fraction", id="word for a fraction"),
    ],
)
def test_unusable_documents_raise_value_error(path: tuple[Any, ...], value: Any, message: str) -> None:
    doc = make_doc([note(0, 1, "0", "1", 60), note(1, 1, "1", "1", 62)])
    target: Any = doc
    for key in path[:-1]:
        target = target[key]
    if value is DELETE:
        del target[path[-1]]
    else:
        target[path[-1]] = value
    with time_limit(10), pytest.raises(ValueError, match=message):
        to_musicxml(doc)


def test_a_note_with_neither_quantised_fields_nor_times_is_rejected() -> None:
    bare = {"id": 0, "midi": 60, "velocity": 64, "confidence": 1.0}
    with pytest.raises(ValueError, match="finite onset/offset"):
        to_musicxml(make_doc([bare]))


def test_a_corrupt_document_cannot_make_the_exporter_run_away(monkeypatch: pytest.MonkeyPatch) -> None:
    from nuit_transcriber.export import musicxml

    monkeypatch.setattr(musicxml, "_MAX_UNITS", 500)
    chord = [note(i, 1, "0", "4", 40 + i % 40, string=1 + i % 6, fret=i % 12) for i in range(600)]
    with pytest.raises(ValueError, match="too dense"):
        to_musicxml(make_doc(chord))  # one 600-note chord
    long_notes = [note(i, 1, "0", "4000", 60 + i) for i in range(20)]  # 20 notes x 1000 bars each
    with pytest.raises(ValueError, match="too dense"):
        to_musicxml(make_doc(long_notes))
    # staggered notes that all last to the end of the bar: few pieces, but many written segments
    staggered = [note(i, 1, str(Fraction(i, 48)), str(4 - Fraction(i, 48)), 60 + i % 12) for i in range(190)]
    with pytest.raises(ValueError, match="too dense"):
        to_musicxml(make_doc(staggered))
    assert Parsed(to_musicxml(make_doc(chord[:40]))).pitched(1)  # a sane chord is still fine


def test_impossible_fret_numbers_are_dropped_instead_of_looped_over() -> None:
    giant = {"fret": 10**30, "fromString": 6, "toString": 1}
    notes = [
        note(0, 1, "0", "1", 60, string=2, fret=1, barre=giant),
        note(1, 1, "1", "1", 62, string=2, fret=99),  # there is no 99th fret
        note(2, 1, "2", "1", 76, string=1, fret=12, techniques=[{"kind": "harmonic", "harmonicFret": 99}]),
    ]
    with time_limit(10):
        parsed = Parsed(to_musicxml(make_doc(notes)))
    assert words_written(parsed) == []  # the unusable barre is ignored
    assert [u.midi for u in parsed.pitched(1)] == [60, 62, 76]
    assert [u.midi for u in parsed.pitched(2)] == [60, 76]  # fret 99: notation only
    assert parsed.pitched(2)[1].el.findtext("notations/technical/fret") == "12"  # harmonic falls back to fret


def test_the_largest_accepted_bar_still_exports() -> None:
    parsed = Parsed(
        to_musicxml(make_doc([note(0, 1, "0", "128", 60), note(1, 2, "127", "1", 62)], beats=128))
    )
    assert len(parsed.measures) == 2
    assert all(total == parsed.bar for total in parsed.sums.values())


def test_a_non_mapping_is_a_type_error() -> None:
    with pytest.raises(TypeError, match="mapping"):
        to_musicxml([])  # type: ignore[arg-type]


def test_a_document_without_notes_is_one_empty_bar() -> None:
    parsed = Parsed(to_musicxml(make_doc([])))
    assert len(parsed.measures) == 1 and not parsed.pitched(1)
    assert [u.el.find("rest").get("measure") for u in parsed.units] == ["yes", "yes"]  # type: ignore[union-attr]


# --------------------------------------------------------------------------------------------------
# Randomised check of the layout engine
# --------------------------------------------------------------------------------------------------

METERS = [(4, 4), (3, 4), (6, 8), (7, 8), (5, 4), (2, 2), (12, 8)]
FRACTIONS = [Fraction(1, 4), Fraction(1, 3), Fraction(1, 6), Fraction(1, 2), Fraction(1)]


def _random_doc(seed: int) -> tuple[dict[str, Any], Logical, Logical]:
    """A random multi-voice document on the 16th/triplet grid plus the notes it must export to."""
    rng = random.Random(seed)
    beats, unit = rng.choice(METERS)
    measures = rng.randint(1, 4)
    beat = Fraction(4, unit)
    notes: list[dict[str, Any]] = []
    spans: list[tuple[int, int, Fraction, Fraction]] = []
    for _ in range(rng.randint(3, 22)):
        step = rng.choice(FRACTIONS)
        start = step * rng.randint(0, int(measures * beats / step) - 1)
        length = min(rng.choice(FRACTIONS) * rng.randint(1, 8), measures * beats - start)
        voice, midi = rng.randint(1, 3), rng.choice([40, 45, 52, 57, 60, 64, 67, 71, 72, 76])
        if any(v == voice and m == midi and s < start + length and start < e for v, m, s, e in spans):
            continue  # the same pitch twice in one voice at once would make the ties ambiguous
        spans.append((voice, midi, start, start + length))
        on_tab = rng.random() < 0.7
        bar, within = divmod(start, beats)
        string, fret = (rng.randint(1, 6), rng.randint(0, 12)) if on_tab else (None, None)
        notes.append(
            note(
                len(notes),
                int(bar) + 1,
                str(within),
                str(length),
                midi,
                voice=voice,
                string=string,
                fret=fret,
            )
        )
    notation = sorted((s * beat, e * beat, m, v) for v, m, s, e in spans)
    tab = sorted(
        (s * beat, e * beat, m, v) for (v, m, s, e), n in zip(spans, notes, strict=True) if n["string"]
    )
    return make_doc(notes, beats=beats, unit=unit), notation, tab


@pytest.mark.parametrize("seed", range(40))
def test_random_documents_keep_every_note_and_fill_every_bar(seed: int) -> None:
    doc, notation, tab = _random_doc(seed)
    parsed = Parsed(to_musicxml(doc))
    assert all(total == parsed.bar for total in parsed.sums.values()), parsed.sums
    assert parsed.logical(1) == notation
    assert parsed.logical(2) == tab
    assert beam_problems(parsed) == []
