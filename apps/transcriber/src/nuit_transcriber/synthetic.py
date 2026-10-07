"""A synthetic, original étude with known ground truth.

Used three ways: as the web karaoke demo (no third-party music is ever committed to this public
repository), as a schema fixture, and — rendered to audio with ``render_audio`` — as a known answer
for end-to-end tests of the engine.

"Estudio sintético en La menor" (4/4, ♩ = 90): an Am p-i-m-a arpeggio, a Dm arpeggio, a melody
with a slide, a hammer-on, vibrato and natural harmonics, a strummed F barré, and a final Am with a
golpe on the soundboard.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path
from typing import Any

import numpy as np

from . import __version__
from .instrument import Guitar, geometry_to_doc

TEMPO_BPM = 90.0
BEAT = 60.0 / TEMPO_BPM
OPEN = (40, 45, 50, 55, 59, 64)  # standard tuning, lowest string first


@dataclass
class SNote:
    measure: int
    beat: Fraction  # 0-based within the 4/4 bar
    beats: Fraction  # duration in beats
    string: int  # 1 = highest
    fret: int
    lh: int  # 0 = open
    rh: str | None
    voice: int = 1
    techniques: list[dict[str, Any]] = field(default_factory=list)
    dynamic: str | None = None
    barre: dict[str, int] | None = None
    harmonic: bool = False

    @property
    def midi(self) -> int:
        base = OPEN[6 - self.string] + self.fret
        if self.harmonic:  # natural harmonic over fret 12 sounds an octave above the open string
            return OPEN[6 - self.string] + 12
        return base

    @property
    def onset(self) -> float:
        return ((self.measure - 1) * 4 + float(self.beat)) * BEAT

    @property
    def offset(self) -> float:
        return self.onset + float(self.beats) * BEAT


def _arpeggio(
    measure: int, shape: list[tuple[int, int, int]], pattern: list[int], rh: list[str]
) -> list[SNote]:
    """Eighth-note arpeggio; ``shape`` = (string, fret, finger); ``pattern`` indexes into shape."""
    out = []
    for k, idx in enumerate(pattern):
        s, f, lh = shape[idx]
        bass = k == 0
        out.append(
            SNote(
                measure=measure,
                beat=Fraction(k, 2),
                beats=Fraction(4) if bass else Fraction(1, 2),
                string=s,
                fret=f,
                lh=lh,
                rh=rh[k],
                voice=2 if bass else 1,
                techniques=[{"kind": "let-ring", "confidence": 1.0}] if bass else [],
                dynamic="mp",
            )
        )
    return out


def score() -> list[SNote]:
    am = [(5, 0, 0), (3, 2, 2), (2, 1, 1), (1, 0, 0)]
    dm = [(4, 0, 0), (3, 2, 2), (2, 3, 3), (1, 1, 1)]  # the standard Dm shape: fingers 2-3-1
    pattern = [0, 1, 2, 3, 2, 1, 2, 1]
    rh = ["p", "i", "m", "a", "m", "i", "m", "i"]
    notes = _arpeggio(1, am, pattern, rh) + _arpeggio(2, am, pattern, rh) + _arpeggio(3, dm, pattern, rh)
    # measure 4: melody on the treble strings over an open A bass
    notes += [
        SNote(4, Fraction(0), Fraction(4), 5, 0, 0, "p", voice=2, dynamic="mf"),
        SNote(4, Fraction(0), Fraction(1), 1, 5, 1, "i", dynamic="mf"),  # A4
        SNote(
            4,
            Fraction(1),
            Fraction(1),
            1,
            7,
            1,
            None,
            dynamic="mf",
            techniques=[{"kind": "slide", "direction": "up", "fromNote": -1, "confidence": 1.0}],
        ),  # B4
        SNote(4, Fraction(2), Fraction(1, 2), 2, 1, 1, "m", dynamic="mf"),  # C4
        SNote(
            4,
            Fraction(5, 2),
            Fraction(3, 2),
            2,
            3,
            3,
            None,
            dynamic="mf",
            techniques=[{"kind": "hammer-on", "direction": "up", "fromNote": -1, "confidence": 1.0}],
        ),  # D4
    ]
    # measure 5: long vibrato note, then natural harmonics at the 12th fret
    notes += [
        SNote(
            5,
            Fraction(0),
            Fraction(2),
            2,
            5,
            1,
            "i",
            dynamic="f",
            techniques=[{"kind": "vibrato", "rateHz": 5.5, "extentCents": 18.0, "confidence": 1.0}],
        ),  # E4
        SNote(
            5,
            Fraction(2),
            Fraction(1),
            1,
            12,
            0,
            "a",
            harmonic=True,
            dynamic="p",
            techniques=[{"kind": "harmonic", "harmonicFret": 12, "confidence": 1.0}],
        ),  # E5 (harm.)
        SNote(
            5,
            Fraction(3),
            Fraction(1),
            2,
            12,
            0,
            "m",
            harmonic=True,
            dynamic="p",
            techniques=[{"kind": "harmonic", "harmonicFret": 12, "confidence": 1.0}],
        ),  # B4 (harm.)
    ]
    # measure 6: F major full barré, strummed down (rasgueado), held for the bar
    barre = {"fret": 1, "fromString": 6, "toString": 1}
    f_shape = [(6, 1, 1), (5, 3, 3), (4, 3, 4), (3, 2, 2), (2, 1, 1), (1, 1, 1)]
    for k, (s, f, lh) in enumerate(f_shape):
        notes.append(
            SNote(
                6,
                Fraction(k, 48),
                Fraction(4) - Fraction(k, 48),
                s,
                f,
                lh,
                "i",
                voice=2 if s >= 4 else 1,
                barre=barre,
                dynamic="f",
                techniques=[{"kind": "rasgueado", "direction": "down", "confidence": 1.0}],
            )
        )
    # measure 7: final A minor chord — the thumb brushes strings 5-4, i-m-a take the trebles
    rh_final = {5: "p", 4: "p", 3: "i", 2: "m", 1: "a"}
    for s, f, lh in [(5, 0, 0), (4, 2, 2), (3, 2, 3), (2, 1, 1), (1, 0, 0)]:
        notes.append(
            SNote(7, Fraction(0), Fraction(4), s, f, lh, rh_final[s], voice=2 if s >= 4 else 1, dynamic="mp")
        )
    notes.sort(key=lambda n: (n.onset, -n.string))
    return notes


def _frac(x: Fraction) -> str:
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def performance_doc() -> dict[str, Any]:
    notes = score()
    guitar = Guitar()
    instrument = geometry_to_doc(guitar)
    instrument["twinRef"] = "preset:classical-650"
    instrument["tuning"]["offsetCents"] = 0.0
    instrument["tuning"]["intonationSpreadCents"] = 0.0
    measures = max(n.measure for n in notes)
    beats = [round(i * BEAT, 4) for i in range(measures * 4 + 1)]
    events: dict[float, int] = {}
    out_notes = []
    for i, n in enumerate(notes):
        ev = events.setdefault(round(n.onset, 2), len(events))
        techs = []
        for t in n.techniques:
            t = dict(t)
            if t.get("fromNote") == -1:
                t["fromNote"] = i - 1
            techs.append(t)
        out_notes.append(
            {
                "id": i,
                "onset": round(n.onset, 4),
                "offset": round(n.offset, 4),
                "midi": n.midi,
                "cents": 0.0,
                "velocity": {"p": 50, "mp": 64, "mf": 80, "f": 96}.get(n.dynamic or "mf", 80),
                "confidence": 1.0,
                "string": n.string,
                "fret": n.fret,
                "lhFinger": n.lh,
                "rhFinger": n.rh,
                "voice": n.voice,
                "event": ev,
                "measure": n.measure,
                "beat": float(n.beat),
                "beatQuantized": _frac(n.beat),
                "durationBeats": _frac(n.beats),
                "timingDeviationBeats": 0.0,
                "barre": n.barre,
                "techniques": techs,
                "dynamic": n.dynamic,
                "articulation": "legato",
                "timbre": "ordinario",
                "flags": ["harmonic-node"] if n.harmonic else [],
            }
        )
    return {
        "schema": "nuit.guitar-performance/1",
        "engine": {"name": "nuit-transcriber", "version": __version__, "models": {"source": "synthetic"}},
        "source": {
            "kind": "synthetic",
            "id": "estudio-sintetico-la-menor",
            "url": None,
            "title": "Estudio sintético en La menor (Nuit One demo)",
            "uploader": "Nuit One",
            "durationSec": round(measures * 4 * BEAT, 3),
            "uploadDate": None,
            "license": "AGPL-3.0-only (original demo material)",
            "hasVideo": False,
            "videoSize": None,
        },
        "instrument": instrument,
        "timing": {
            "source": "synthetic",
            "beats": beats,
            "downbeats": beats[::4],
            "beatsPerBar": 4,
            "beatUnit": 4,
            "tempoBpm": TEMPO_BPM,
            "tempoCurve": [[b, TEMPO_BPM] for b in beats[:-1]],
            "firstBarStart": 0.0,
            "rubatoIndex": 0.0,
        },
        "notes": out_notes,
        "events": [
            {
                "time": round((measures - 1) * 4 * BEAT + 2 * BEAT, 4),
                "kind": "golpe",
                "strength": 0.8,
                "confidence": 1.0,
            }
        ],
        "positions": [
            {"start": 0.0, "end": round(12 * BEAT, 4), "fret": 1, "confidence": 1.0, "source": "audio"},
            {
                "start": round(12 * BEAT, 4),
                "end": round(20 * BEAT, 4),
                "fret": 5,
                "confidence": 1.0,
                "source": "audio",
            },
            {
                "start": round(20 * BEAT, 4),
                "end": round(28 * BEAT, 4),
                "fret": 1,
                "confidence": 1.0,
                "source": "audio",
            },
        ],
        "chords": [
            {"start": 0.0, "end": round(8 * BEAT, 4), "label": "Am", "confidence": 1.0},
            {"start": round(8 * BEAT, 4), "end": round(12 * BEAT, 4), "label": "Dm", "confidence": 1.0},
            {"start": round(20 * BEAT, 4), "end": round(24 * BEAT, 4), "label": "F", "confidence": 1.0},
            {"start": round(24 * BEAT, 4), "end": round(28 * BEAT, 4), "label": "Am", "confidence": 1.0},
        ],
        "dynamics": [
            {"time": 0.0, "mark": "mp"},
            {"time": round(12 * BEAT, 4), "mark": "mf"},
            {"time": round(16 * BEAT, 4), "mark": "f"},
            {"time": round(18 * BEAT, 4), "mark": "p"},
            {"time": round(20 * BEAT, 4), "mark": "f"},
            {"time": round(24 * BEAT, 4), "mark": "mp"},
        ],
        "style": {"key": "A minor", "meter": "4/4", "texture": "arpeggiated, melodic, chordal"},
        "video": None,
        "quality": {"notesTotal": len(out_notes), "notesFingered": len(out_notes), "warnings": []},
    }


def render_audio(doc: dict[str, Any], sr: int = 44100, seed: int = 7) -> np.ndarray:
    """Karplus–Strong render of a performance document (mono float32), for engine tests."""
    rng = np.random.default_rng(seed)
    dur = max(n["offset"] for n in doc["notes"]) + 1.5
    out = np.zeros(int(dur * sr) + sr, dtype=np.float32)
    for n in doc["notes"]:
        f0 = 440.0 * 2 ** ((n["midi"] - 69) / 12)
        period = max(2, int(round(sr / f0)))
        length = int((n["offset"] - n["onset"] + 0.25) * sr)
        buf = rng.uniform(-1, 1, period).astype(np.float32)
        if "harmonic-node" in n.get("flags", []):
            buf = np.sin(2 * np.pi * np.arange(period) / period).astype(np.float32)
        y = np.empty(length, dtype=np.float32)
        decay = 0.996
        for k in range(length):
            y[k] = buf[k % period]
            buf[k % period] = decay * 0.5 * (buf[k % period] + buf[(k + 1) % period])
        start = int(n["onset"] * sr)
        out[start : start + length] += y * (n["velocity"] / 127.0) * 0.4
    peak = float(np.max(np.abs(out))) or 1.0
    return out / peak * 0.9


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(description="Write the synthetic étude as nuit.guitar-performance/1 JSON")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    Path(args.out).write_text(json.dumps(performance_doc(), ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
