"""MusicXML 4.0 export of a ``nuit.guitar-performance/1`` document: standard notation plus TAB.

The output is one ``score-partwise`` part ("Classical Guitar" for classical/nylon variants, otherwise
"Guitar") with two staves:

* staff 1 - standard notation, treble clef sounding an octave lower (G line 2 with
  ``clef-octave-change`` -1); note voices 1-4, stems up for odd voices and down for even ones;
* staff 2 - TAB (``staff-lines`` = string count, ``staff-tuning`` line 1 = lowest string, ``capo`` when
  greater than 0); voices 5-8 mirror voices 1-4 (the MuseScore / Guitar Pro convention).

Every note is written on both staves. TAB copies carry ``<string>``/``<fret>``; notation copies carry
``<fingering>`` (left hand, omitted for open strings), ``<pluck>`` (p/i/m/a/c) and the circled string
number (``<string>``). A note without string or fret appears on the notation staff only. Frets are the
document's own, i.e. counted from the capo.

Rules (what the exporter decides when the document leaves room)
---------------------------------------------------------------
Time
    Positions and durations are exact fractions of a quarter note. ``<divisions>`` is the least common
    multiple of every denominator that occurs (bar length included), so 16ths and triplets are exact. If
    that multiple does not divide 48 (quintuplets, odd fractions, ...) every time is rounded to the
    nearest 1/48 of a quarter note and ``divisions`` is 48. ``beatUnit`` other than 4 is honoured: one
    beat is 4/beatUnit quarter notes and ``tempoBpm`` counts beats of that unit per minute.
Notes missing quantised fields
    ``measure``, ``beatQuantized`` and ``durationBeats`` are recovered from ``onset``/``offset`` through
    ``timing.beats``/``firstBarStart`` and ``rhythm.quantise_beat`` (16ths and triplets); onset and
    offset are snapped independently, and a duration that snaps to zero becomes a quarter of a beat.
    Without ``firstBarStart`` whole bars are prepended only if the first note still precedes the first
    downbeat after snapping (a note a few milliseconds early belongs on the downbeat).
Voices, chords and conflicting durations
    A voice is a sequence of chords. Notes sounding together in one voice share ``<chord/>``. A voice is
    cut at every onset and offset: when durations differ at one onset the chord is written with the
    SHORTEST duration and the longer notes continue, tied, as the following chord(s). Partly overlapping
    notes in one voice are treated the same way, so every voice sums exactly to the bar and no sounding
    time is lost. Gaps are filled with rests (invisible on the TAB staff, which also gets a hidden
    whole-bar rest where its first voice is empty). A voice other than the first is written in a
    measure only when it has notes there. A missing ``voice`` means voice 1.
Barlines and note values
    A note crossing a barline is split and tied. A span that is not one note value (for example 5/4) is
    written as tied note values, largest first, using plain, dotted, double-dotted and triplet values;
    if such a span starts off the 16th grid of its beat (a triplet position) it is first cut at the
    next beat line, so that a triplet group can be completed.
Strums
    Notes tagged ``rasgueado``/``strum`` that start within a quarter beat of the first note of a stroke,
    have the same direction and sound on different strings are one stroke: they are moved to the stroke's
    earliest onset (so 1/48-beat staggers do not enter the rhythm) and each carries
    ``<arpeggiate direction>``. The attribute is the document's stroke direction, unchanged ("down" is a
    down-stroke, which sounds the low strings first); it is not derived from the pitch order of the
    roll. A lone tagged note gets no arpeggiate.
Harmonics
    ``<pitch>`` is always the SOUNDING pitch (the document's ``midi``) on both staves; the harmonic is
    marked ``<technical><harmonic><natural/></harmonic>``. The TAB fret of a harmonic is the touched fret
    (``harmonicFret`` when present, otherwise ``fret``).
Spanners
    ``fromNote`` is resolved by note ``id``. A slide / hammer-on / pull-off starts on the LAST written
    unit of the source note and stops on the FIRST unit of the target note (``H`` / ``P`` text on the
    start). A pair is written on the TAB staff only when both notes have a TAB entry. Vibrato is a
    ``wavy-line`` from the first to the last unit of the note. All other marks are written once, on the
    first unit of a tied note: articulations, ``tamb.``/``let ring``, bend, arpeggiate, harmonic.
    Every pair gets its own ``number``; the TAB copies use 9-16 so the two staves never share one (a
    reader that matches start and stop by number alone cannot cross-pair them).
Beams and tuplets
    Consecutive chords of eighth notes or shorter that touch each other and start in the same beat (the
    same dotted-quarter group in compound meters such as 6/8) are beamed; a rest, a gap or a beat line
    ends a group, and a lone shorter note inside a group gets a hook. Triplets (3:2) carry
    ``time-modification``; in each voice a run of touching triplet values is cut into complete groups
    (a group is complete when its sounding length is twice a plain note value, which becomes its
    ``normal-type``), written with ``<tuplet type="start|stop">`` on the first note of the first and of
    the last chord, with a bracket unless every note of the group is beamed. Beams never cross a group.
Directions
    Tempo (``metronome`` + ``sound tempo``) at the start; a dynamic whenever the effective dynamic
    changes (a note's ``dynamic``, else the document's ``dynamics`` timeline); barre words ("C V",
    "½C III" when fewer strings than the instrument has are covered) at the first note of a barre,
    again after a gap. The numeral is the fret counted from the capo, like the TAB.
Key and spelling
    The key signature comes from ``style.key`` ("A minor", "Bb major", ...) when parseable, else from a
    Krumhansl-Kessler estimate over duration-weighted pitch classes. Pitches are spelled by
    proximity on the line of fifths around that key. Tuning pitches use flats when three or more open
    strings are black keys, otherwise sharps.

Limits (a larger document is refused with ``ValueError``): 128 beats per bar, 24 strings, 10,000
measures and 150,000 written notes. A fret above 36 (barre, harmonic or note) counts as absent.

Not written: tempo changes after the first mark, and metric re-spelling of note values.
"""

from __future__ import annotations

import logging
import math
import numbers
import os
import re
import xml.etree.ElementTree as ET
from bisect import bisect_right
from collections import defaultdict
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from fractions import Fraction
from functools import cache
from itertools import pairwise
from pathlib import Path
from typing import Any

import numpy as np

from ..instrument import TUNINGS
from ..rhythm import Rhythm, quantise_beat

__all__ = ["to_musicxml", "write_musicxml"]

log = logging.getLogger(__name__)

SCHEMA = "nuit.guitar-performance/1"

_DOCTYPE = (
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" '
    '"http://www.musicxml.org/dtds/partwise.dtd">'
)
_MAX_DIVISIONS = 48  # lcm(16, 3): 64th notes and triplets are exact on this grid
# Guards against corrupt input: beyond these the document is refused instead of exhausting memory or time
# (the largest limit is about 11 KB of memory per written note, so 150,000 notes is roughly 1.7 GB).
_MAX_MEASURES = 10_000
_MAX_BEATS_PER_BAR = 128
_MAX_STRINGS = 24
_MAX_FRET = 36  # the schema's fretCount maximum; a larger fret number is corrupt data, not a position
_MAX_UNITS = 150_000  # written notes over both staves, ties included
_STANDARD_TUNING = TUNINGS["standard"]  # used when the document gives no tuning
_TAB_VOICE_OFFSET = 4  # notation voices 1-4 -> TAB voices 5-8
_MAX_VOICE = 4
_STRUM_KINDS = frozenset({"rasgueado", "strum"})
_STRUM_WINDOW_BEATS = Fraction(1, 4)
_MIN_BEATS = Fraction(1, 4)  # shortest duration a note that snapped to zero length gets
_DYNAMIC_MARKS = frozenset({"ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"})
_PLUCK_FINGERS = frozenset({"p", "i", "m", "a", "c"})
_DEFAULT_BEND_SEMITONES = 1.0
_SPANNERS_PER_STAFF = 8  # MusicXML number-level is 1-16: notation uses 1-8, the TAB copies 9-16
_BEAT_UNIT_NAMES = {1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "16th", 32: "32nd", 64: "64th"}
_NOTE_TYPES = (
    ("breve", Fraction(8)),
    ("whole", Fraction(4)),
    ("half", Fraction(2)),
    ("quarter", Fraction(1)),
    ("eighth", Fraction(1, 2)),
    ("16th", Fraction(1, 4)),
    ("32nd", Fraction(1, 8)),
    ("64th", Fraction(1, 16)),
)
_NO_STEM_TYPES = frozenset({"breve", "whole"})
_BEAM_LEVELS = {"eighth": 1, "16th": 2, "32nd": 3, "64th": 4}  # beams each beamable note value carries
_LINE_OF_FIFTHS = "FCGDAEB"  # letter at line-of-fifths positions -1 .. 5
_SHARP_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
_FLAT_NAMES = ("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B")
_BLACK_KEYS = frozenset({1, 3, 6, 8, 10})
# Krumhansl-Kessler key profiles (tonic first) and the signature of the major key on each tonic.
_KK_MAJOR = (6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88)
_KK_MINOR = (6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17)
_MAJOR_FIFTHS_BY_TONIC = (0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5)
_LETTER_POSITIONS = {"F": -1, "C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5}
_XML_ILLEGAL = re.compile(r"[^\t\n\r\x20-\U0000d7ff\U0000e000-\U0000fffd\U00010000-\U0010ffff]")
_FRACTION_TEXT = re.compile(r"^(-?\d{1,9})(?:/(\d{1,9})|\.(\d{1,9}))?$")


# --------------------------------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------------------------------


def to_musicxml(doc: Mapping[str, Any]) -> str:
    """Render a ``nuit.guitar-performance/1`` document as a MusicXML 4.0 ``score-partwise`` string.

    The document is not modified. Raises ``ValueError`` when it cannot be exported (no timing, a bad
    meter, a note without a usable pitch or position, an absurd length) and ``TypeError`` when ``doc``
    is not a mapping.
    """
    if not isinstance(doc, Mapping):
        raise TypeError("doc must be a mapping holding a nuit.guitar-performance/1 document")
    schema = doc.get("schema")
    if schema is not None and schema != SCHEMA:
        raise ValueError(f"unsupported document schema {schema!r}; expected {SCHEMA!r}")
    score = _read_score(doc)
    _merge_strokes(score.notes, score.meter)
    divisions, rounded = _choose_divisions(score.notes, score.meter.bar)
    length = int(score.meter.bar * divisions)
    _assign_ticks(score.notes, divisions, length, rounded)
    layout = _build_layout(score.notes, divisions, length, score.meter.beat * divisions)
    directions = _plan_directions(score, layout)
    return _serialise(_emit_score(score, divisions, layout, directions))


def write_musicxml(doc: Mapping[str, Any], path: str | os.PathLike[str]) -> Path:
    """Write ``to_musicxml(doc)`` to ``path`` as UTF-8 and return the path."""
    text = to_musicxml(doc)  # rendered first so a failure never truncates an existing file
    target = Path(path)
    target.write_text(text, encoding="utf-8")
    return target


# --------------------------------------------------------------------------------------------------
# Model
# --------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Meter:
    beats: int
    unit: int

    @property
    def beat(self) -> Fraction:
        """Quarter notes per beat."""
        return Fraction(4, self.unit)

    @property
    def bar(self) -> Fraction:
        """Quarter notes per bar."""
        return self.beats * self.beat


@dataclass
class _Marks:
    """Playing techniques of one note, reduced to what the notation needs."""

    articulations: list[str] = field(default_factory=list)
    other: list[str] = field(default_factory=list)
    harmonic: bool = False
    harmonic_fret: int | None = None
    bend: float | None = None
    vibrato: bool = False
    strum: bool = False
    stroke: str | None = None
    vibrato_number: int = 1
    spans_out: list[tuple[str, int, int]] = field(default_factory=list)  # (kind, number, target index)
    spans_in: list[tuple[str, int, int]] = field(default_factory=list)  # (kind, number, source index)


@dataclass
class _Note:
    index: int
    ident: int
    start: Fraction  # quarter notes from the start of measure 1
    end: Fraction
    midi: int
    voice: int
    string: int | None
    tab: tuple[int, int] | None  # (string, fret as printed in TAB) when the note has a TAB entry
    lh: int | None
    rh: str | None
    marks: _Marks
    dynamic: str | None
    barre: tuple[int, int, int] | None  # (fret, fromString, toString)
    start_tick: int = 0
    end_tick: int = 0
    rolled: bool = False  # part of a strum stroke of two or more notes


@dataclass
class _Score:
    meter: _Meter
    tempo_bpm: float | None
    tuning: tuple[int, ...]
    capo: int
    title: str
    part_name: str
    midi_program: int
    software: str
    encoding_date: str | None
    key: tuple[int, str]  # (fifths, mode)
    notes: list[_Note]


@dataclass(frozen=True)
class _Token:
    """One written note value: ``ticks`` long, drawn as ``type`` with ``dots`` (or as a 3:2 triplet)."""

    ticks: int
    type: str
    dots: int = 0
    tuplet: bool = False


@dataclass(frozen=True, eq=False)
class _Piece:
    """The part of a note that lies inside one measure (``start``/``end`` are ticks in the measure)."""

    note: _Note
    start: int
    end: int


@dataclass
class _Slot:
    """One written chord or rest. ``token`` is None for a whole-measure rest."""

    start: int
    ticks: int
    token: _Token | None
    notes: list[_Note]


@dataclass
class _Layout:
    measures: int
    length: int
    slots: dict[tuple[int, int, int], list[_Slot]] = field(default_factory=dict)  # (measure, staff, voice)
    voices: dict[tuple[int, int], list[int]] = field(default_factory=dict)  # (measure, staff) -> voices
    units: dict[tuple[int, int], int] = field(default_factory=lambda: defaultdict(int))  # (staff, note)
    first_loc: dict[int, tuple[int, int, int]] = field(default_factory=dict)  # note -> (measure, tick, voice)


@dataclass(frozen=True)
class _Direction:
    tick: int
    order: int
    kind: str  # "tempo" | "dynamics" | "words"
    value: str = ""


# --------------------------------------------------------------------------------------------------
# Reading the document
# --------------------------------------------------------------------------------------------------


def _as_int(value: Any) -> int | None:
    """An int from an int, an integral float or a numpy integer; None for anything else (bool included)."""
    if isinstance(value, bool):
        return None
    if isinstance(value, numbers.Integral):
        return int(value)
    if isinstance(value, numbers.Real) and math.isfinite(value) and float(value).is_integer():
        return int(value)
    return None


def _as_float(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, numbers.Real):
        return None
    return float(value) if math.isfinite(value) else None


def _is_mapping(value: Any) -> bool:
    return isinstance(value, Mapping)


def _is_choice(value: Any, choices: frozenset[str]) -> bool:
    """``value in choices`` that tolerates unhashable junk (a corrupt field may be a list or a dict)."""
    return isinstance(value, str) and value in choices


def _as_list(value: Any) -> list[Any] | None:
    """The items of a list, tuple or numpy array; None for anything else (a str is not a list)."""
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray):
        return list(value)
    return None


def _as_fraction(value: Any, what: str) -> Fraction:
    """Exact fraction from a schema fraction string ("5/2", "-1/4", "0.5"), an int or a float."""
    if isinstance(value, bool):
        raise ValueError(f"{what}: {value!r} is not a fraction")
    if isinstance(value, numbers.Integral):
        return Fraction(int(value))
    if isinstance(value, numbers.Real):
        if not math.isfinite(value):
            raise ValueError(f"{what}: {value!r} is not finite")
        return Fraction(float(value)).limit_denominator(_MAX_DIVISIONS * 4)
    if isinstance(value, str):
        match = _FRACTION_TEXT.match(value.strip())
        if match:
            whole, denominator, decimals = match.groups()
            if denominator is not None:
                if int(denominator) == 0:
                    raise ValueError(f"{what}: {value!r} divides by zero")
                return Fraction(int(whole), int(denominator))
            if decimals is not None:
                return Fraction(value.strip())
            return Fraction(int(whole))
    raise ValueError(f"{what}: {value!r} is not an exact fraction")


def _clean(text: Any) -> str:
    """Text safe for XML 1.0 (control characters and lone surrogates removed)."""
    return _XML_ILLEGAL.sub("", text) if isinstance(text, str) else ""


def _read_score(doc: Mapping[str, Any]) -> _Score:
    timing = doc.get("timing")
    if not isinstance(timing, Mapping):
        raise ValueError("document has no 'timing' object")
    beats, unit = _as_int(timing.get("beatsPerBar")), _as_int(timing.get("beatUnit"))
    if beats is None or not 1 <= beats <= _MAX_BEATS_PER_BAR:
        raise ValueError(f"timing.beatsPerBar must be an integer from 1 to {_MAX_BEATS_PER_BAR}")
    if unit not in _BEAT_UNIT_NAMES:
        raise ValueError("timing.beatUnit must be a power of two from 1 to 64")
    meter = _Meter(beats, unit)
    tempo = _as_float(timing.get("tempoBpm"))

    instrument = doc.get("instrument")
    instrument = instrument if isinstance(instrument, Mapping) else {}
    tuning_doc = instrument.get("tuning")
    tuning_doc = tuning_doc if isinstance(tuning_doc, Mapping) else {}
    tuning = _read_tuning(tuning_doc.get("openMidi"))
    capo = max(_as_int(tuning_doc.get("capo")) or 0, 0)

    raw_notes = _as_list(doc.get("notes"))
    if raw_notes is None:
        raise ValueError("document 'notes' must be a list")
    clock = _LazyClock(timing, meter, raw_notes)
    timeline = _dynamics_timeline(doc.get("dynamics"))
    notes: list[_Note] = []
    links: list[tuple[_Note, str, Any]] = []
    for index, raw in enumerate(raw_notes):
        if not isinstance(raw, Mapping):
            raise ValueError(f"notes[{index}] must be an object")
        note, requests = _read_note(index, raw, meter, len(tuning), clock, timeline)
        notes.append(note)
        links.extend((note, kind, source) for kind, source in requests)
    _link_spanners(notes, links)

    style = doc.get("style")
    declared = _parse_key(style.get("key")) if isinstance(style, Mapping) else None
    source = doc.get("source")
    source = source if isinstance(source, Mapping) else {}
    engine = doc.get("engine")
    engine = engine if isinstance(engine, Mapping) else {}
    variant = str(instrument.get("variant") or "").lower()
    classical = "classical" in variant or "nylon" in variant
    created = engine.get("createdAt")
    date = created[:10] if isinstance(created, str) and re.match(r"^\d{4}-\d{2}-\d{2}", created) else None
    software = (
        " ".join(str(engine.get(k)) for k in ("name", "version") if engine.get(k)) or "nuit-transcriber"
    )
    return _Score(
        meter=meter,
        tempo_bpm=tempo if tempo and tempo > 0 else None,
        tuning=tuning,
        capo=capo,
        title=_clean(source.get("title")).strip(),
        part_name="Classical Guitar" if classical else "Guitar",
        midi_program=25 if classical else 28 if "electric" in variant else 26,
        software=_clean(software),
        encoding_date=date,
        key=declared or _estimate_key(notes),
        notes=notes,
    )


def _read_tuning(value: Any) -> tuple[int, ...]:
    if value is None:
        return _STANDARD_TUNING
    pitches = [_as_int(p) for p in _as_list(value) or []]
    if not 1 <= len(pitches) <= _MAX_STRINGS or any(p is None or not 0 <= p <= 127 for p in pitches):
        raise ValueError(f"instrument.tuning.openMidi must hold 1 to {_MAX_STRINGS} MIDI pitches")
    return tuple(p for p in pitches if p is not None)


def _dynamics_timeline(value: Any) -> tuple[list[float], list[str]]:
    marks: list[tuple[float, str]] = []
    for item in _as_list(value) or ():
        if isinstance(item, Mapping) and _is_choice(item.get("mark"), _DYNAMIC_MARKS):
            time = _as_float(item.get("time"))
            if time is not None:
                marks.append((time, item["mark"]))
    marks.sort(key=lambda m: m[0])
    return [t for t, _ in marks], [m for _, m in marks]


class _LazyClock:
    """Performance seconds -> beat coordinate counted from beat 0 of measure 1.

    Only used for notes that lack quantised fields, so a fully quantised document never builds it.
    """

    def __init__(self, timing: Mapping[str, Any], meter: _Meter, raw_notes: list[Any]) -> None:
        self._timing = timing
        self._meter = meter
        self._raw_notes = raw_notes
        self._rhythm: Rhythm | None = None
        self._origin: float | None = None

    def _build(self) -> Rhythm:
        timing = self._timing
        beats = _finite_sorted(timing.get("beats"))
        downbeats = _finite_sorted(timing.get("downbeats"))
        tempo = _as_float(timing.get("tempoBpm"))
        rhythm = Rhythm(
            beats=beats,
            downbeats=downbeats,
            beats_per_bar=self._meter.beats,
            tempo_bpm=tempo if tempo and tempo > 0 else 120.0,
            source=str(timing.get("source", "document")),
        )
        first_bar = _as_float(timing.get("firstBarStart"))
        if first_bar is not None:
            self._origin = rhythm.beat_index(first_bar)
        else:
            # Whole bars are prepended only when the first note still precedes the first downbeat after
            # snapping: a note a few milliseconds early belongs on the downbeat, not a bar before it.
            onsets = [
                t
                for t in (_as_float(n.get("onset")) for n in self._raw_notes if _is_mapping(n))
                if t is not None
            ]
            first = rhythm.beat_index(min(onsets)) - rhythm.downbeat_offset if onsets else 0.0
            snapped, _ = quantise_beat(first)
            rhythm.lead_bars = math.ceil(-snapped / self._meter.beats) if snapped < 0 else 0
        return rhythm

    def __call__(self, t: float) -> float:
        if self._rhythm is None:
            self._rhythm = self._build()
        if self._origin is not None:
            return float(self._rhythm.beat_index(t) - self._origin)
        return float(self._rhythm.measure_beat(t))


def _finite_sorted(values: Any) -> np.ndarray:
    numbers_ = [v for v in (_as_float(x) for x in _as_list(values) or ()) if v is not None]
    return np.unique(np.array(numbers_, dtype=float))  # sorted, and no zero-length beat intervals


def _read_note(
    index: int,
    raw: Mapping[str, Any],
    meter: _Meter,
    string_count: int,
    clock: _LazyClock,
    timeline: tuple[list[float], list[str]],
) -> tuple[_Note, list[tuple[str, Any]]]:
    where = f"notes[{index}]"
    midi = _as_int(raw.get("midi"))
    if midi is None or not 0 <= midi <= 127:
        raise ValueError(f"{where}: 'midi' must be an integer from 0 to 127")

    start_beats: Fraction | None = None
    measure = _as_int(raw.get("measure"))
    if measure is not None and raw.get("beatQuantized") is not None:
        start_beats = (measure - 1) * meter.beats + _as_fraction(
            raw["beatQuantized"], f"{where}.beatQuantized"
        )
    duration_beats = (
        _as_fraction(raw["durationBeats"], f"{where}.durationBeats")
        if raw.get("durationBeats") is not None
        else None
    )
    onset = _as_float(raw.get("onset"))
    if start_beats is None or duration_beats is None:
        offset = _as_float(raw.get("offset"))
        if onset is None or offset is None:
            raise ValueError(f"{where}: needs measure/beatQuantized/durationBeats or finite onset/offset")
        snapped_on, snapped_off = _snap(clock(onset), where), _snap(clock(offset), where)
        if start_beats is None:
            start_beats = snapped_on
        if duration_beats is None:
            duration_beats = snapped_off - snapped_on
    if duration_beats <= 0:
        duration_beats = _MIN_BEATS
    start, end = start_beats * meter.beat, (start_beats + duration_beats) * meter.beat
    if start < 0:
        log.warning("%s starts before the first bar line; moved to the bar line", where)
        start, end = Fraction(0), max(end, _MIN_BEATS * meter.beat)

    marks, requests = _collect_marks(raw.get("techniques"), raw.get("articulation"))
    string, fret = _as_int(raw.get("string")), _as_int(raw.get("fret"))
    if string is not None and not 1 <= string <= string_count:
        log.warning("%s: string %s does not exist on this instrument; no TAB entry", where, string)
        string = None
    if fret is not None and not 0 <= fret <= _MAX_FRET:
        log.warning("%s: fret %s does not exist; no TAB entry", where, fret)
        fret = None
    tab = None
    if string is not None and fret is not None:
        shown = marks.harmonic_fret if marks.harmonic and marks.harmonic_fret is not None else fret
        tab = (string, shown)

    lh, rh = _as_int(raw.get("lhFinger")), raw.get("rhFinger")
    dynamic = raw["dynamic"] if _is_choice(raw.get("dynamic"), _DYNAMIC_MARKS) else None
    if dynamic is None and onset is not None and timeline[0]:
        position = bisect_right(timeline[0], onset + 1e-6) - 1
        dynamic = timeline[1][position] if position >= 0 else None
    ident = _as_int(raw.get("id"))
    note = _Note(
        index=index,
        ident=index if ident is None else ident,
        start=start,
        end=end,
        midi=midi,
        voice=min(max(_as_int(raw.get("voice")) or 1, 1), _MAX_VOICE),
        string=string,
        tab=tab,
        lh=lh if lh in (1, 2, 3, 4) else None,
        rh=rh if _is_choice(rh, _PLUCK_FINGERS) else None,
        marks=marks,
        dynamic=dynamic,
        barre=_read_barre(raw.get("barre")),
    )
    return note, requests


def _snap(coordinate: float, where: str) -> Fraction:
    if not math.isfinite(coordinate):
        raise ValueError(f"{where}: cannot place the note on the beat grid")
    snapped, _ = quantise_beat(coordinate)
    return snapped


def _read_barre(value: Any) -> tuple[int, int, int] | None:
    if not isinstance(value, Mapping):
        return None
    fret, first, last = (_as_int(value.get(k)) for k in ("fret", "fromString", "toString"))
    if fret is None or first is None or last is None or not 1 <= fret <= _MAX_FRET or first < 1 or last < 1:
        return None
    return fret, first, last


def _collect_marks(techniques: Any, articulation: Any) -> tuple[_Marks, list[tuple[str, Any]]]:
    marks = _Marks()
    requests: list[tuple[str, Any]] = []
    for tech in _as_list(techniques) or ():
        if not isinstance(tech, Mapping):
            continue
        kind = tech.get("kind")
        if _is_choice(kind, _STRUM_KINDS):
            marks.strum = True
            if tech.get("direction") in ("up", "down"):
                marks.stroke = tech["direction"]
        elif kind == "vibrato":
            marks.vibrato = True
        elif kind == "harmonic":
            marks.harmonic = True
            fret = _as_int(tech.get("harmonicFret"))
            marks.harmonic_fret = fret if fret is not None and 0 <= fret <= _MAX_FRET else None
        elif kind == "bend":
            extent = _as_float(tech.get("extentCents"))
            semitones = abs(extent) / 100.0 if extent else _DEFAULT_BEND_SEMITONES
            marks.bend = -semitones if tech.get("direction") == "down" else semitones
        elif kind == "tambora":
            marks.other.append("tamb.")
        elif kind == "let-ring":
            marks.other.append("let ring")
        elif kind in ("staccato", "accent"):
            marks.articulations.append(kind)
        elif kind in ("slide", "hammer-on", "pull-off"):
            requests.append((kind, tech.get("fromNote")))
    if articulation in ("staccato", "accent"):
        marks.articulations.append(articulation)
    marks.articulations = list(dict.fromkeys(marks.articulations))
    marks.other = list(dict.fromkeys(marks.other))
    return marks, requests


def _link_spanners(notes: Sequence[_Note], links: Sequence[tuple[_Note, str, Any]]) -> None:
    """Resolve ``fromNote`` ids and give every spanner pair (and vibrato) its own MusicXML number."""
    by_id: dict[int, _Note] = {}
    for note in notes:
        by_id.setdefault(note.ident, note)
    counter = 0

    def next_number() -> int:
        nonlocal counter
        counter += 1
        return (counter - 1) % _SPANNERS_PER_STAFF + 1

    for note, kind, source in links:
        partner = by_id.get(source) if _as_int(source) is not None else None
        if partner is None or partner is note:
            log.warning("note %s: %s from unknown note %r ignored", note.ident, kind, source)
            continue
        number = next_number()
        partner.marks.spans_out.append((kind, number, note.index))
        note.marks.spans_in.append((kind, number, partner.index))
    for note in notes:
        if note.marks.vibrato:
            note.marks.vibrato_number = next_number()


# --------------------------------------------------------------------------------------------------
# Key and pitch spelling
# --------------------------------------------------------------------------------------------------


def _parse_key(value: Any) -> tuple[int, str] | None:
    """("A minor" | "Bb" | "F#m" ...) -> (fifths, mode); None when not understood."""
    if not isinstance(value, str) or not value.strip() or value.strip()[0].upper() not in _LETTER_POSITIONS:
        return None
    text = value.strip()
    position = _LETTER_POSITIONS[text[0].upper()]
    rest = text[1:].lstrip()
    if rest[:1] in ("#", "♯"):
        position, rest = position + 7, rest[1:]
    elif rest[:1] in ("b", "♭"):
        position, rest = position - 7, rest[1:]
    word = rest.strip().lower()
    if word in ("", "major", "maj"):
        mode = "major"
    elif word in ("m", "min", "minor"):
        mode, position = "minor", position - 3
    else:
        return None
    return (position, mode) if -7 <= position <= 7 else None


def _estimate_key(notes: Sequence[_Note]) -> tuple[int, str]:
    """Krumhansl-Kessler key estimate over duration-weighted pitch classes (C major if undecidable)."""
    weights = [0.0] * 12
    for note in notes:
        weights[note.midi % 12] += float(note.end - note.start)
    if max(weights) == min(weights):
        return 0, "major"
    best_r, best = -2.0, (0, "major")
    for tonic in range(12):
        for mode, profile in (("major", _KK_MAJOR), ("minor", _KK_MINOR)):
            r = _pearson(weights, [profile[(pc - tonic) % 12] for pc in range(12)])
            if r > best_r:
                fifths = _MAJOR_FIFTHS_BY_TONIC[tonic if mode == "major" else (tonic + 3) % 12]
                best_r, best = r, (fifths, mode)
    return best


def _pearson(xs: Sequence[float], ys: Sequence[float]) -> float:
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True))
    sxx, syy = sum((x - mx) ** 2 for x in xs), sum((y - my) ** 2 for y in ys)
    return sxy / math.sqrt(sxx * syy) if sxx > 0 and syy > 0 else -2.0


def _speller(fifths: int, mode: str) -> Callable[[int], tuple[str, int, int]]:
    """MIDI pitch -> (step, alter, octave), spelled by proximity on the line of fifths around the key."""
    low = fifths + 2 + (1 if mode == "minor" else 0) - 6

    @cache
    def spell(midi: int) -> tuple[str, int, int]:
        base = (midi % 12 * 7) % 12
        position = base - 12 * ((base - low) // 12)  # the one position in [low, low + 11] for this pitch
        alter = (position + 1) // 7
        return _LINE_OF_FIFTHS[(position + 1) % 7], alter, (midi - alter) // 12 - 1

    return spell


def _spell_tuning(open_midi: Sequence[int]) -> list[tuple[str, int, int]]:
    flats = sum(1 for p in open_midi if p % 12 in _BLACK_KEYS) >= 3
    names = _FLAT_NAMES if flats else _SHARP_NAMES
    out = []
    for pitch in open_midi:
        name = names[pitch % 12]
        out.append((name[0], {"#": 1, "b": -1}.get(name[1:], 0), pitch // 12 - 1))
    return out


# --------------------------------------------------------------------------------------------------
# Strokes, divisions and ticks
# --------------------------------------------------------------------------------------------------


def _merge_strokes(notes: Sequence[_Note], meter: _Meter) -> None:
    """Move the notes of one strum stroke onto the stroke's earliest onset (see the module docstring)."""
    window = _STRUM_WINDOW_BEATS * meter.beat
    stroke: list[_Note] = []
    strings: set[int] = set()  # strings already sounding in the current stroke
    for note in sorted((n for n in notes if n.marks.strum), key=lambda n: (n.start, n.index)):
        if stroke and not _joins_stroke(stroke[0], strings, note, window):
            _close_stroke(stroke)
            stroke, strings = [], set()
        stroke.append(note)
        if note.string is not None:
            strings.add(note.string)
    _close_stroke(stroke)


def _joins_stroke(head: _Note, strings: set[int], note: _Note, window: Fraction) -> bool:
    return (
        note.start - head.start <= window
        and note.marks.stroke == head.marks.stroke
        and (note.string is None or note.string not in strings)
    )


def _close_stroke(stroke: Sequence[_Note]) -> None:
    if len(stroke) < 2:
        return
    onset = min(n.start for n in stroke)
    for note in stroke:
        note.start, note.rolled = onset, True


def _choose_divisions(notes: Sequence[_Note], bar: Fraction) -> tuple[int, bool]:
    """(divisions per quarter note, whether every time must be rounded to that grid)."""
    needed = bar.denominator
    for note in notes:
        for time in (note.start, note.end):
            needed = math.lcm(needed, time.denominator)
            if _MAX_DIVISIONS % needed:  # no longer a divisor of 48, and it cannot become one again
                return _MAX_DIVISIONS, True
    return needed, False


def _assign_ticks(notes: Sequence[_Note], divisions: int, length: int, rounded: bool) -> None:
    # a 64th triplet (2 ticks) is the smallest note value on the 1/48 grid
    shortest = 2 if divisions == _MAX_DIVISIONS else 1
    for note in notes:
        start, end = note.start * divisions, note.end * divisions
        note.start_tick = round(start) if rounded else int(start)
        note.end_tick = round(end) if rounded else int(end)
        note.end_tick = max(note.end_tick, note.start_tick + shortest)
    if notes and max(n.end_tick for n in notes) > _MAX_MEASURES * length:
        raise ValueError(f"score would exceed {_MAX_MEASURES} measures; check measure numbers and durations")


# --------------------------------------------------------------------------------------------------
# Rhythm: note values and layout of voices
# --------------------------------------------------------------------------------------------------


@cache
def _token_table(divisions: int) -> tuple[_Token, ...]:
    """Every writable note value that is a whole number of ticks, longest first."""
    found: dict[int, _Token] = {}
    for name, base in _NOTE_TYPES:
        for dots, factor, tuplet in (
            (0, Fraction(1), False),
            (1, Fraction(3, 2), False),
            (2, Fraction(7, 4), False),
            (0, Fraction(2, 3), True),
        ):
            ticks = base * factor * divisions
            if ticks.denominator == 1 and ticks >= 1:
                found.setdefault(int(ticks), _Token(int(ticks), name, dots, tuplet))
    return tuple(found[t] for t in sorted(found, reverse=True))


def _tokenize(ticks: int, divisions: int) -> list[_Token]:
    """Split a span into written note values, largest first (plain, dotted, double-dotted, triplet).

    A value is only taken when what is left is zero or still writable, so no sliver below the smallest
    note value is stranded (on the 1/48 grid the smallest value is 2 ticks). A span that is itself
    shorter than the smallest value (1 tick, only on that grid) keeps its exact length with the
    smallest glyph, so bar sums stay exact.
    """
    table = _token_table(divisions)
    smallest = table[-1].ticks
    out: list[_Token] = []
    remaining = ticks
    while remaining > 0:
        for token in table:
            left = remaining - token.ticks
            if left == 0 or left >= smallest:
                out.append(token)
                remaining = left
                break
        else:
            out.append(replace(table[-1], ticks=remaining))
            remaining = 0
    return out


def _span_tokens(low: int, high: int, divisions: int, beat_ticks: Fraction) -> list[_Token]:
    """Note values for the ticks [low, high) of a bar.

    A span that needs several values and starts off the 16th grid of its beat is cut at the next beat
    line first (a rest after two triplets becomes the missing triplet value, then plain values).
    """
    tokens = _tokenize(high - low, divisions)
    if len(tokens) > 1 and Fraction(low) % (beat_ticks / 4) != 0:
        edge = (Fraction(low) // beat_ticks + 1) * beat_ticks
        if edge.denominator == 1 and edge < high:
            return _tokenize(int(edge) - low, divisions) + _tokenize(high - int(edge), divisions)
    return tokens


def _too_dense() -> ValueError:
    return ValueError(f"score too dense: more than {_MAX_UNITS} written notes (ties included)")


def _voice_slots(pieces: Sequence[_Piece], length: int, divisions: int, beat_ticks: Fraction) -> list[_Slot]:
    """Cut one voice at every onset/offset; each segment is a chord (or a rest) written as note values."""
    if not pieces:
        return [_Slot(0, length, None, [])]
    cuts = sorted({0, length, *(p.start for p in pieces), *(p.end for p in pieces)})
    position = {cut: i for i, cut in enumerate(cuts)}
    if sum(position[p.end] - position[p.start] for p in pieces) > _MAX_UNITS:
        raise _too_dense()
    sounding: list[list[_Note]] = [[] for _ in range(len(cuts) - 1)]
    for piece in pieces:  # each piece fills the segments it covers: linear in the notes written
        for i in range(position[piece.start], position[piece.end]):
            sounding[i].append(piece.note)
    slots: list[_Slot] = []
    for (low, high), chord in zip(pairwise(cuts), sounding, strict=True):
        at = low
        for token in _span_tokens(low, high, divisions, beat_ticks):
            slots.append(_Slot(at, token.ticks, token, chord))
            at += token.ticks
    return slots


def _build_layout(notes: Sequence[_Note], divisions: int, length: int, beat_ticks: Fraction) -> _Layout:
    last = max((n.end_tick for n in notes), default=0)
    layout = _Layout(measures=max(1, -(-last // length)), length=length)
    if sum((n.end_tick - 1) // length - n.start_tick // length + 1 for n in notes) > _MAX_UNITS:
        raise _too_dense()
    written = 0
    pieces: dict[tuple[int, int, int], list[_Piece]] = defaultdict(list)
    present: dict[tuple[int, int], set[int]] = defaultdict(set)
    for note in notes:
        for staff in (1, 2) if note.tab else (1,):
            for m in range(note.start_tick // length, (note.end_tick - 1) // length + 1):
                low = m * length
                piece = _Piece(note, max(note.start_tick, low) - low, min(note.end_tick, low + length) - low)
                pieces[(m + 1, staff, note.voice)].append(piece)
                present[(m + 1, staff)].add(note.voice)
    for measure in range(1, layout.measures + 1):
        for staff in (1, 2):
            voices = sorted(present[(measure, staff)] | {1})
            layout.voices[(measure, staff)] = voices
            for voice in voices:
                slots = _voice_slots(pieces.get((measure, staff, voice), ()), length, divisions, beat_ticks)
                layout.slots[(measure, staff, voice)] = slots
                for slot in slots:
                    written += len(slot.notes)
                    for note in slot.notes:
                        layout.units[(staff, note.index)] += 1
                        if staff == 1:
                            layout.first_loc.setdefault(note.index, (measure, slot.start, voice))
                if written > _MAX_UNITS:
                    raise _too_dense()
    return layout


# --------------------------------------------------------------------------------------------------
# Beams
# --------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Tuplet:
    """How one 3:2 slot takes part in a tuplet group of its voice pass."""

    normal_type: str  # the plain note value the group is counted in
    group: int  # sequence number of the group within the pass
    start: bool
    stop: bool
    bracket: bool  # False when every note of the group is beamed (the number alone is enough)


def _tuplet_plan(slots: Sequence[_Slot], divisions: int) -> dict[int, _Tuplet]:
    """Tuplet groups of one voice pass by slot start; a run that never completes a group gets none."""
    plain = {base * divisions: name for name, base in _NOTE_TYPES}  # plain note values in ticks
    plan: dict[int, _Tuplet] = {}
    run: list[tuple[_Slot, _Token]] = []
    groups = 0

    def close() -> None:
        nonlocal groups
        group: list[tuple[_Slot, _Token]] = []
        for slot, token in run:
            group.append((slot, token))
            unit = plain.get(
                Fraction(sum(t.ticks for _, t in group), 2)
            )  # sounding length 2u = 3 x u of notes
            if unit is None:
                continue
            bracket = not all(s.notes and t.type in _BEAM_LEVELS for s, t in group)
            for k, (member, _) in enumerate(group):
                plan[member.start] = _Tuplet(unit, groups, k == 0, k == len(group) - 1, bracket)
            groups += 1
            group = []
        run.clear()

    for slot in slots:
        token = slot.token
        if token is None or not token.tuplet:
            close()
        elif run and slot.start != run[-1][0].start + run[-1][0].ticks:
            close()
            run.append((slot, token))
        else:
            run.append((slot, token))
    close()
    return plan


def _beam_group_ticks(meter: _Meter, divisions: int) -> Fraction:
    """Ticks one beam group may span: a beat, or a dotted quarter in compound meters (6/8, 9/8, 12/8)."""
    beat = meter.beat * divisions
    compound = meter.unit >= 8 and meter.beats > 3 and meter.beats % 3 == 0
    return beat * 3 if compound else beat


def _beam_states(levels: Sequence[int]) -> list[dict[int, str]]:
    """Beam state of every note of one group at each beam level; ``levels`` = beams each note needs."""
    states: list[dict[int, str]] = [{} for _ in levels]
    for level in range(1, max(levels) + 1):
        i = 0
        while i < len(levels):
            if levels[i] < level:
                i += 1
                continue
            j = i
            while j + 1 < len(levels) and levels[j + 1] >= level:
                j += 1
            if j > i:
                states[i][level], states[j][level] = "begin", "end"
                for k in range(i + 1, j):
                    states[k][level] = "continue"
            elif level > 1:  # a lone shorter note hangs a hook towards the rest of its group
                states[i][level] = "forward hook" if i == 0 else "backward hook"
            i = j + 1
    return states


def _group_of(tuplets: Mapping[int, _Tuplet], slot: _Slot) -> int | None:
    found = tuplets.get(slot.start)
    return None if found is None else found.group


def _beam_plan(
    slots: Sequence[_Slot], group_ticks: Fraction, tuplets: Mapping[int, _Tuplet]
) -> dict[int, dict[int, str]]:
    """Beam states by slot start for one voice pass of a measure; a beam never crosses a tuplet group."""
    plan: dict[int, dict[int, str]] = {}
    group: list[tuple[_Slot, int]] = []  # (slot, beams it needs)

    def close() -> None:
        if len(group) > 1:
            for (slot, _), states in zip(group, _beam_states([level for _, level in group]), strict=True):
                plan[slot.start] = states
        group.clear()

    for slot in slots:
        level = _BEAM_LEVELS.get(slot.token.type) if slot.token is not None and slot.notes else None
        if group:
            last, first = group[-1][0], group[0][0]
            same_beat = Fraction(slot.start) // group_ticks == Fraction(first.start) // group_ticks
            same_tuplet = _group_of(tuplets, slot) == _group_of(tuplets, last)
            if level is None or slot.start != last.start + last.ticks or not same_beat or not same_tuplet:
                close()
        if level is not None:
            group.append((slot, level))
    close()
    return plan


# --------------------------------------------------------------------------------------------------
# Directions: tempo, dynamics, barre
# --------------------------------------------------------------------------------------------------


def _roman(number: int) -> str:
    out = []
    for value, glyph in ((10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")):
        while number >= value:
            out.append(glyph)
            number -= value
    return "".join(out)


def _plan_directions(score: _Score, layout: _Layout) -> dict[tuple[int, int], list[_Direction]]:
    """Directions per (measure, voice) of staff 1, each attached to the first unit of the note causing it."""
    plan: dict[tuple[int, int], list[_Direction]] = defaultdict(list)
    if score.tempo_bpm is not None:
        plan[(1, 1)].append(_Direction(0, 0, "tempo"))

    by_onset: dict[int, list[_Note]] = defaultdict(list)
    for note in score.notes:
        by_onset[note.start_tick].append(note)
    current: str | None = None
    for tick in sorted(by_onset):
        lead = next((n for n in sorted(by_onset[tick], key=lambda n: (n.voice, n.midi)) if n.dynamic), None)
        if lead is not None and lead.dynamic != current:
            current = lead.dynamic
            measure, at, voice = layout.first_loc[lead.index]
            plan[(measure, voice)].append(_Direction(at, 1, "dynamics", lead.dynamic or ""))

    held: tuple[tuple[int, int, int], int] | None = None  # (barre, last tick it is needed)
    for note in sorted(score.notes, key=lambda n: (n.start_tick, n.voice, n.midi)):
        if note.barre is None:
            continue
        if held is not None and held[0] == note.barre and note.start_tick <= held[1]:
            held = (note.barre, max(held[1], note.end_tick))
            continue
        held = (note.barre, note.end_tick)
        fret, first, last = note.barre
        covers = abs(last - first) + 1
        words = f"{'C' if covers >= len(score.tuning) else '½C'} {_roman(fret)}"
        measure, at, voice = layout.first_loc[note.index]
        plan[(measure, voice)].append(_Direction(at, 2, "words", words))
    for items in plan.values():
        items.sort(key=lambda d: (d.tick, d.order))
    return plan


# --------------------------------------------------------------------------------------------------
# XML emission
# --------------------------------------------------------------------------------------------------


@dataclass
class _Emit:
    score: _Score
    divisions: int
    layout: _Layout
    spell: Callable[[int], tuple[str, int, int]]
    notes: list[_Note]
    beam_ticks: Fraction
    seen: dict[tuple[int, int], int] = field(default_factory=lambda: defaultdict(int))


def _sub(parent: ET.Element, tag: str, text: Any = None, **attrs: str) -> ET.Element:
    element = ET.SubElement(parent, tag, {k.replace("_", "-"): v for k, v in attrs.items()})
    if text is not None:
        element.text = str(text)
    return element


def _number(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _emit_score(
    score: _Score,
    divisions: int,
    layout: _Layout,
    directions: Mapping[tuple[int, int], Sequence[_Direction]],
) -> ET.Element:
    root = ET.Element("score-partwise", {"version": "4.0"})
    if score.title:
        _sub(_sub(root, "work"), "work-title", score.title)
    encoding = _sub(_sub(root, "identification"), "encoding")
    if score.encoding_date:
        _sub(encoding, "encoding-date", score.encoding_date)
    _sub(encoding, "software", score.software)

    part_list = _sub(root, "part-list")
    entry = _sub(part_list, "score-part", id="P1")
    _sub(entry, "part-name", score.part_name)
    _sub(entry, "part-abbreviation", "Guit.")
    instrument = _sub(entry, "score-instrument", id="P1-I1")
    _sub(instrument, "instrument-name", score.part_name)
    midi = _sub(entry, "midi-instrument", id="P1-I1")
    _sub(midi, "midi-channel", 1)
    _sub(midi, "midi-program", score.midi_program)

    beam_ticks = _beam_group_ticks(score.meter, divisions)
    ctx = _Emit(score, divisions, layout, _speller(*score.key), score.notes, beam_ticks)
    part = _sub(root, "part", id="P1")
    for measure in range(1, layout.measures + 1):
        _emit_measure(part, measure, ctx, directions)
    return root


def _emit_measure(
    part: ET.Element, number: int, ctx: _Emit, directions: Mapping[tuple[int, int], Sequence[_Direction]]
) -> None:
    layout = ctx.layout
    element = _sub(part, "measure", number=str(number))
    if number == 1:
        _emit_attributes(element, ctx)
    passes = [(staff, voice) for staff in (1, 2) for voice in layout.voices[(number, staff)]]
    for position, (staff, voice) in enumerate(passes):
        pending = list(directions.get((number, voice), ())) if staff == 1 else []
        slots = layout.slots[(number, staff, voice)]
        tuplets = _tuplet_plan(slots, ctx.divisions)
        beams = _beam_plan(slots, ctx.beam_ticks, tuplets)
        for slot in slots:
            while pending and pending[0].tick <= slot.start:
                _emit_direction(element, pending.pop(0), ctx.score)
            _emit_slot(element, slot, staff, voice, ctx, beams.get(slot.start, {}), tuplets.get(slot.start))
        for leftover in pending:  # cannot happen (every direction sits on a slot start); never drop one
            _emit_direction(element, leftover, ctx.score)
        if position < len(passes) - 1:
            _sub(_sub(element, "backup"), "duration", layout.length)
    if number == layout.measures:
        barline = _sub(element, "barline", location="right")
        _sub(barline, "bar-style", "light-heavy")


def _emit_attributes(measure: ET.Element, ctx: _Emit) -> None:
    score = ctx.score
    attributes = _sub(measure, "attributes")
    _sub(attributes, "divisions", ctx.divisions)
    key = _sub(attributes, "key")
    _sub(key, "fifths", score.key[0])
    _sub(key, "mode", score.key[1])
    time = _sub(attributes, "time")
    _sub(time, "beats", score.meter.beats)
    _sub(time, "beat-type", score.meter.unit)
    _sub(attributes, "staves", 2)
    treble = _sub(attributes, "clef", number="1")
    _sub(treble, "sign", "G")
    _sub(treble, "line", 2)
    _sub(treble, "clef-octave-change", -1)
    tab = _sub(attributes, "clef", number="2")
    _sub(tab, "sign", "TAB")
    _sub(tab, "line", max(len(score.tuning) - 1, 1))
    details = _sub(attributes, "staff-details", number="2")
    _sub(details, "staff-lines", len(score.tuning))
    for line, (step, alter, octave) in enumerate(_spell_tuning(score.tuning), start=1):
        tuning = _sub(details, "staff-tuning", line=str(line))
        _sub(tuning, "tuning-step", step)
        if alter:
            _sub(tuning, "tuning-alter", alter)
        _sub(tuning, "tuning-octave", octave)
    if score.capo > 0:
        _sub(details, "capo", score.capo)


def _emit_direction(measure: ET.Element, item: _Direction, score: _Score) -> None:
    direction = _sub(measure, "direction", placement="below" if item.kind == "dynamics" else "above")
    content = _sub(direction, "direction-type")
    if item.kind == "tempo":
        metronome = _sub(content, "metronome")
        _sub(metronome, "beat-unit", _BEAT_UNIT_NAMES[score.meter.unit])
        _sub(metronome, "per-minute", _number(score.tempo_bpm or 0.0))
    elif item.kind == "dynamics":
        _sub(_sub(content, "dynamics"), item.value)
    else:
        _sub(content, "words", item.value)
    _sub(direction, "staff", 1)
    if item.kind == "tempo":
        _sub(direction, "sound", tempo=_number((score.tempo_bpm or 0.0) * float(score.meter.beat)))


@dataclass(frozen=True)
class _Lane:
    """Where a slot is written: its staff, its MusicXML voice number and its stem direction."""

    staff: int
    xml_voice: int
    stem: str


def _emit_slot(
    measure: ET.Element,
    slot: _Slot,
    staff: int,
    voice: int,
    ctx: _Emit,
    beams: Mapping[int, str],
    tuplet: _Tuplet | None,
) -> None:
    lane = _Lane(
        staff,
        voice + (_TAB_VOICE_OFFSET if staff == 2 else 0),
        "up" if voice % 2 else "down",
    )
    token = slot.token
    if token is None or not slot.notes:
        _emit_rest(measure, slot, lane, tuplet)
        return
    for position, note in enumerate(sorted(slot.notes, key=lambda n: (n.midi, n.string or 0))):
        _emit_pitched(measure, slot, token, note, position, lane, ctx, beams, tuplet)


def _emit_rest(measure: ET.Element, slot: _Slot, lane: _Lane, tuplet: _Tuplet | None) -> None:
    element = _sub(measure, "note", **({"print_object": "no"} if lane.staff == 2 else {}))
    _sub(element, "rest", **({"measure": "yes"} if slot.token is None else {}))
    _sub(element, "duration", slot.ticks)
    _sub(element, "voice", lane.xml_voice)
    if slot.token is not None:
        _emit_value(element, slot.token, tuplet)
    _sub(element, "staff", lane.staff)
    marks = _tuplet_marks(tuplet)
    if marks:
        notations = _sub(element, "notations")
        notations.extend(marks)


def _emit_value(element: ET.Element, token: _Token, tuplet: _Tuplet | None) -> None:
    """``type``, ``dot`` and ``time-modification`` of a written note value."""
    _sub(element, "type", token.type)
    for _ in range(token.dots):
        _sub(element, "dot")
    if token.tuplet:
        modification = _sub(element, "time-modification")
        _sub(modification, "actual-notes", 3)
        _sub(modification, "normal-notes", 2)
        _sub(modification, "normal-type", token.type if tuplet is None else tuplet.normal_type)


def _tuplet_marks(tuplet: _Tuplet | None) -> list[ET.Element]:
    """``<tuplet>`` elements that open and/or close a group at this slot."""
    marks: list[ET.Element] = []
    if tuplet is not None and tuplet.stop:
        marks.append(ET.Element("tuplet", {"type": "stop", "number": "1"}))
    if tuplet is not None and tuplet.start:
        attributes = {"type": "start", "number": "1", "bracket": "yes" if tuplet.bracket else "no"}
        marks.append(ET.Element("tuplet", attributes))
    return marks


def _emit_pitched(
    measure: ET.Element,
    slot: _Slot,
    token: _Token,
    note: _Note,
    position: int,
    lane: _Lane,
    ctx: _Emit,
    beams: Mapping[int, str],
    tuplet: _Tuplet | None,
) -> None:
    unit = ctx.seen[(lane.staff, note.index)]
    ctx.seen[(lane.staff, note.index)] += 1
    total = ctx.layout.units[(lane.staff, note.index)]

    element = _sub(measure, "note")
    if position:
        _sub(element, "chord")
    step, alter, octave = ctx.spell(note.midi)
    pitch = _sub(element, "pitch")
    _sub(pitch, "step", step)
    if alter:
        _sub(pitch, "alter", alter)
    _sub(pitch, "octave", octave)
    _sub(element, "duration", slot.ticks)
    if unit > 0:
        _sub(element, "tie", type="stop")
    if unit < total - 1:
        _sub(element, "tie", type="start")
    _sub(element, "voice", lane.xml_voice)
    _emit_value(element, token, tuplet)
    if token.type not in _NO_STEM_TYPES:
        _sub(element, "stem", lane.stem)
    _sub(element, "staff", lane.staff)
    for level in sorted(beams):
        _sub(element, "beam", beams[level], number=str(level))
    notations = _notations(note, lane.staff, unit, total, ctx)
    if position == 0:  # a group opens and closes on the first note of a chord
        for mark in _tuplet_marks(tuplet):
            notations.insert(0, mark)
    if len(notations):
        element.append(notations)


def _notations(note: _Note, staff: int, unit: int, total: int, ctx: _Emit) -> ET.Element:
    """Ties, spanners, ornaments, techniques, articulations and arpeggiate of one written unit of a note."""
    first, last = unit == 0, unit == total - 1
    marks = note.marks
    notations = ET.Element("notations")
    if not first:
        _sub(notations, "tied", type="stop")
    if not last:
        _sub(notations, "tied", type="start")

    def usable(partner: int) -> bool:  # a TAB copy only joins spanners whose other end is on TAB too
        return staff == 1 or ctx.notes[partner].tab is not None

    spans_in = [s for s in marks.spans_in if first and usable(s[2])]
    spans_out = [s for s in marks.spans_out if last and usable(s[2])]
    shift = _SPANNERS_PER_STAFF if staff == 2 else 0  # the two staves must never share a number
    for kind, number, _ in spans_in:
        if kind == "slide":
            _sub(notations, "slide", type="stop", number=str(number + shift))
    for kind, number, _ in spans_out:
        if kind == "slide":
            _sub(notations, "slide", type="start", number=str(number + shift), line_type="solid")

    if marks.vibrato:
        ornaments = _sub(notations, "ornaments")
        number = str(marks.vibrato_number + shift)
        if first:
            _sub(ornaments, "wavy-line", type="start", number=number)
        if last:
            _sub(ornaments, "wavy-line", type="stop", number=number)
        if not first and not last:
            _sub(ornaments, "wavy-line", type="continue", number=number)

    technical = _technical(note, staff, first, spans_in, spans_out, shift)
    if len(technical):
        notations.append(technical)
    if first and marks.articulations:
        articulations = _sub(notations, "articulations")
        for name in marks.articulations:
            _sub(articulations, name)
    if first and note.rolled:
        _sub(notations, "arpeggiate", **({"direction": marks.stroke} if marks.stroke else {}))
    return notations


def _technical(
    note: _Note,
    staff: int,
    first: bool,
    spans_in: Sequence[tuple[str, int, int]],
    spans_out: Sequence[tuple[str, int, int]],
    shift: int,
) -> ET.Element:
    """``<technical>``: fingering/pluck/circled string (notation) or string/fret (TAB), plus the marks."""
    marks = note.marks
    technical = ET.Element("technical")
    if staff == 1:
        if note.lh:
            _sub(technical, "fingering", note.lh)
        if note.rh:
            _sub(technical, "pluck", note.rh)
        if note.string:
            _sub(technical, "string", note.string)
    elif note.tab is not None:
        _sub(technical, "string", note.tab[0])
        _sub(technical, "fret", note.tab[1])
    if first and marks.harmonic:
        _sub(_sub(technical, "harmonic"), "natural")
    for kind, number, _ in spans_in:
        if kind in ("hammer-on", "pull-off"):
            _sub(technical, kind, type="stop", number=str(number + shift))
    for kind, number, _ in spans_out:
        if kind in ("hammer-on", "pull-off"):
            _sub(
                technical, kind, "H" if kind == "hammer-on" else "P", type="start", number=str(number + shift)
            )
    if first and marks.bend is not None:
        _sub(_sub(technical, "bend"), "bend-alter", _number(marks.bend))
    if first:
        for text in marks.other:
            _sub(technical, "other-technical", text)
    return technical


# --------------------------------------------------------------------------------------------------
# Serialisation
# --------------------------------------------------------------------------------------------------


def _serialise(root: ET.Element) -> str:
    ET.indent(root, space="  ")
    body = ET.tostring(root, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{_DOCTYPE}\n{body}\n'
