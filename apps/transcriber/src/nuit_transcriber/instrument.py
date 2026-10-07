"""Guitar instrument model: tuning, equal-tempered fret geometry, and pitch → (string, fret) candidates.

Geometry follows the equal-tempered fret rule. The distance from the nut to fret ``n`` is

    d(n) = L * (1 - 2 ** (-n / 12))

where ``L`` is the scale length (nut to saddle). The luthier's "rule of 17.817" is a shop
approximation of the same series. Fret 12 sits at exactly ``L / 2``.

String indexing: ``course`` 0 is the LOWEST-pitched string (the 6th string on a six-string
guitar); ``string_number(course)`` converts to the player's numbering, where string 1 is the
highest-pitched string. The instrument can be built from a guitar-twin geometry document (see
``from_geometry``) so that the same numbers drive transcription, video fitting and rendering.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

NOTE_NAMES_SHARP = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")

#: Open-string MIDI pitches, lowest string first.
TUNINGS: dict[str, tuple[int, ...]] = {
    "standard": (40, 45, 50, 55, 59, 64),  # E2 A2 D3 G3 B3 E4
    "drop-d": (38, 45, 50, 55, 59, 64),
    "half-step-down": (39, 44, 49, 54, 58, 63),
    "whole-step-down": (38, 43, 48, 53, 57, 62),
    "dadgad": (38, 45, 50, 55, 57, 62),
    "open-g": (38, 43, 50, 55, 59, 62),
    "open-d": (38, 45, 50, 54, 57, 62),
    "open-e": (40, 47, 52, 56, 59, 64),
    "drop-c": (36, 43, 48, 53, 57, 62),
    "standard-7": (35, 40, 45, 50, 55, 59, 64),  # B1 + standard
}


def midi_to_name(midi: int) -> str:
    """MIDI pitch → scientific pitch name (C4 = 60)."""
    return f"{NOTE_NAMES_SHARP[midi % 12]}{midi // 12 - 1}"


def midi_to_hz(midi: float, a4_hz: float = 440.0) -> float:
    return a4_hz * 2.0 ** ((midi - 69.0) / 12.0)


def hz_to_midi(hz: float, a4_hz: float = 440.0) -> float:
    return 69.0 + 12.0 * math.log2(hz / a4_hz)


@dataclass(frozen=True)
class InstrumentGeometry:
    """Physical geometry of a fretted instrument, in millimetres.

    Defaults describe a concert classical guitar (650 mm scale, 19 frets, 12 to the body,
    52 mm nut, flat fingerboard). Steel-string and electric twins override these values.
    """

    variant: str = "classical"
    scale_length_mm: float = 650.0
    fret_count: int = 19
    frets_to_body: int = 12
    nut_width_mm: float = 52.0
    width_at_body_joint_mm: float = 62.0
    string_spread_nut_mm: float = 43.0  # centre-to-centre, outermost strings
    string_spread_saddle_mm: float = 58.0
    fingerboard_radius_mm: float | None = None  # None = flat (classical)
    inlay_frets: tuple[int, ...] = ()  # classical boards carry no inlays
    twin_ref: str | None = None  # id of the twin/type shell this geometry came from

    def fret_distance_mm(self, fret: float) -> float:
        """Distance from the nut to fret ``fret`` (fractional frets allowed)."""
        return self.scale_length_mm * (1.0 - 2.0 ** (-fret / 12.0))

    def fret_from_distance_mm(self, distance_mm: float) -> float:
        """Inverse of ``fret_distance_mm``: continuous fret coordinate of a point on the neck."""
        ratio = 1.0 - distance_mm / self.scale_length_mm
        if ratio <= 0.0:
            return float("inf")
        return -12.0 * math.log2(ratio)

    def fret_positions_mm(self) -> list[float]:
        """Nut (fret 0) through the last fret."""
        return [self.fret_distance_mm(n) for n in range(self.fret_count + 1)]

    def string_y_mm(self, course: int, n_courses: int, x_mm: float) -> float:
        """Across-neck coordinate of a string at distance ``x_mm`` from the nut.

        y = 0 is the neck centreline; the lowest string (course 0) has negative y. Strings fan
        linearly from their nut spacing to their saddle spacing.
        """
        if n_courses < 2:
            return 0.0
        t = min(max(x_mm / self.scale_length_mm, 0.0), 1.0)
        spread = self.string_spread_nut_mm + (self.string_spread_saddle_mm - self.string_spread_nut_mm) * t
        return -spread / 2.0 + spread * course / (n_courses - 1)

    def neck_half_width_mm(self, x_mm: float) -> float:
        """Half the fingerboard width at ``x_mm`` (linear taper nut → body joint)."""
        x_joint = self.fret_distance_mm(self.frets_to_body)
        t = x_mm / x_joint if x_joint > 0 else 0.0
        return (self.nut_width_mm + (self.width_at_body_joint_mm - self.nut_width_mm) * t) / 2.0


@dataclass(frozen=True)
class Tuning:
    name: str
    open_midi: tuple[int, ...]
    a4_hz: float = 440.0
    capo: int = 0

    @property
    def sounding_open_midi(self) -> tuple[int, ...]:
        return tuple(p + self.capo for p in self.open_midi)

    def describe(self) -> str:
        names = " ".join(midi_to_name(p) for p in self.open_midi)
        capo = f", capo {self.capo}" if self.capo else ""
        return f"{self.name} ({names}){capo}, A4={self.a4_hz:.1f} Hz"


@dataclass(frozen=True)
class Position:
    """One way to play a pitch: ``course`` (0 = lowest string) and ``fret`` (0 = open/capo)."""

    course: int
    fret: int


@dataclass
class Guitar:
    geometry: InstrumentGeometry = field(default_factory=InstrumentGeometry)
    tuning: Tuning = field(default_factory=lambda: Tuning("standard", TUNINGS["standard"]))

    @property
    def n_courses(self) -> int:
        return len(self.tuning.open_midi)

    def string_number(self, course: int) -> int:
        """Player numbering: string 1 = highest-pitched string."""
        return self.n_courses - course

    def course_from_string_number(self, string_number: int) -> int:
        return self.n_courses - string_number

    @property
    def lowest_midi(self) -> int:
        return min(self.tuning.sounding_open_midi)

    @property
    def highest_midi(self) -> int:
        return max(self.tuning.sounding_open_midi) + self.geometry.fret_count - self.tuning.capo

    def candidates(self, midi: int) -> list[Position]:
        """Every (course, fret) that sounds ``midi``; fret 0 means the open string (or capo)."""
        out: list[Position] = []
        max_fret = self.geometry.fret_count - self.tuning.capo
        for course, open_pitch in enumerate(self.tuning.sounding_open_midi):
            fret = midi - open_pitch
            if 0 <= fret <= max_fret:
                out.append(Position(course, fret))
        return out

    def midi_at(self, pos: Position) -> int:
        return self.tuning.sounding_open_midi[pos.course] + pos.fret

    def absolute_fret(self, pos: Position) -> int:
        """Fret number measured from the nut (adds the capo)."""
        return pos.fret + self.tuning.capo if pos.fret > 0 else self.tuning.capo


def from_geometry(doc: dict[str, Any]) -> Guitar:
    """Build a Guitar from a guitar-twin geometry document.

    Accepts the ``instrument`` object of a ``nuit.guitar-performance/1`` document or a twin
    geometry export with the same field names. Unknown fields are ignored; missing ones fall back
    to classical-guitar defaults so a partial twin still yields a playable model.
    """
    g = doc.get("geometry", doc)
    defaults = InstrumentGeometry()
    geometry = InstrumentGeometry(
        variant=str(g.get("variant", doc.get("variant", defaults.variant))),
        scale_length_mm=float(g.get("scaleLengthMm", defaults.scale_length_mm)),
        fret_count=int(g.get("fretCount", defaults.fret_count)),
        frets_to_body=int(g.get("fretsToBody", defaults.frets_to_body)),
        nut_width_mm=float(g.get("nutWidthMm", defaults.nut_width_mm)),
        width_at_body_joint_mm=float(g.get("widthAtBodyJointMm", defaults.width_at_body_joint_mm)),
        string_spread_nut_mm=float(g.get("stringSpreadNutMm", defaults.string_spread_nut_mm)),
        string_spread_saddle_mm=float(g.get("stringSpreadSaddleMm", defaults.string_spread_saddle_mm)),
        fingerboard_radius_mm=(
            float(g["fingerboardRadiusMm"]) if g.get("fingerboardRadiusMm") is not None else None
        ),
        inlay_frets=tuple(int(x) for x in g.get("inlayFrets", ())),
        twin_ref=g.get("twinRef") or doc.get("twinRef"),
    )
    t = doc.get("tuning", {})
    open_midi = tuple(int(x) for x in t.get("openMidi", TUNINGS["standard"]))
    tuning = Tuning(
        name=str(t.get("name", "standard")),
        open_midi=open_midi,
        a4_hz=float(t.get("referenceHz", 440.0)),
        capo=int(t.get("capo", 0)),
    )
    return Guitar(geometry=geometry, tuning=tuning)


def geometry_to_doc(guitar: Guitar) -> dict[str, Any]:
    """Serialise the instrument for the performance document (camelCase, millimetres)."""
    g = guitar.geometry
    n = guitar.n_courses
    frets = g.fret_positions_mm()
    strings = []
    for course in range(n):
        strings.append(
            {
                "stringNumber": guitar.string_number(course),
                "openMidi": guitar.tuning.open_midi[course],
                "nut": [0.0, round(g.string_y_mm(course, n, 0.0), 3)],
                "saddle": [g.scale_length_mm, round(g.string_y_mm(course, n, g.scale_length_mm), 3)],
            }
        )
    return {
        "family": "guitar",
        "variant": g.variant,
        "twinRef": g.twin_ref,
        "geometry": {
            "scaleLengthMm": g.scale_length_mm,
            "fretCount": g.fret_count,
            "fretsToBody": g.frets_to_body,
            "nutWidthMm": g.nut_width_mm,
            "widthAtBodyJointMm": g.width_at_body_joint_mm,
            "stringSpreadNutMm": g.string_spread_nut_mm,
            "stringSpreadSaddleMm": g.string_spread_saddle_mm,
            "fingerboardRadiusMm": g.fingerboard_radius_mm,
            "inlayFrets": list(g.inlay_frets),
            "fretPositionsMm": [round(x, 3) for x in frets],
            "strings": strings,
        },
        "tuning": {
            "name": guitar.tuning.name,
            "openMidi": list(guitar.tuning.open_midi),
            "referenceHz": round(guitar.tuning.a4_hz, 2),
            "capo": guitar.tuning.capo,
        },
    }


def infer_tuning(midi_pitches: list[int], a4_hz: float = 440.0) -> Tuning:
    """Pick the most plausible tuning from the transcribed pitch set.

    Heuristic: the lowest confidently-played pitch bounds the lowest string. Pitches below E2
    point to a lowered tuning; frequent D2 with no D#2/E2 points to drop-D. Returns standard
    tuning when nothing argues otherwise.
    """
    if not midi_pitches:
        return Tuning("standard", TUNINGS["standard"], a4_hz)
    counts: dict[int, int] = {}
    for p in midi_pitches:
        counts[p] = counts.get(p, 0) + 1
    # ignore rare outliers (a stray octave error should not retune the guitar)
    floor = max(2, len(midi_pitches) // 400)
    solid = sorted(p for p, c in counts.items() if c >= floor)
    lowest = solid[0] if solid else min(midi_pitches)
    if lowest >= 40:
        return Tuning("standard", TUNINGS["standard"], a4_hz)
    if lowest in (38, 39) and counts.get(38, 0) >= counts.get(39, 0):
        return Tuning("drop-d", TUNINGS["drop-d"], a4_hz)
    if lowest == 39:
        return Tuning("half-step-down", TUNINGS["half-step-down"], a4_hz)
    if lowest in (36, 37):
        return Tuning("drop-c", TUNINGS["drop-c"], a4_hz)
    if lowest == 35:
        return Tuning("standard-7", TUNINGS["standard-7"], a4_hz)
    return Tuning("standard", TUNINGS["standard"], a4_hz)
