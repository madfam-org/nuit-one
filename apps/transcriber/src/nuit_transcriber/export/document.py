"""Assemble and validate the ``nuit.guitar-performance/1`` document."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from fractions import Fraction
from importlib import resources
from pathlib import Path
from typing import Any

from .. import __version__
from ..rhythm import Rhythm, quantise_beat

SCHEMA_ID = "nuit.guitar-performance/1"


def load_schema() -> dict[str, Any]:
    text = (
        resources.files("nuit_transcriber").joinpath("schema/guitar-performance.v1.schema.json").read_text()
    )
    return json.loads(text)


def validate(doc: dict[str, Any]) -> None:
    import jsonschema

    jsonschema.validate(doc, load_schema())


def _frac(x: Fraction) -> str:
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def quantised_fields(rhythm: Rhythm, onset: float, offset: float) -> dict[str, Any]:
    """Measure, beat-in-bar (exact fraction) and duration in beats for one note."""
    mb_on = rhythm.measure_beat(onset)
    mb_off = rhythm.measure_beat(offset)
    q_on, dev = quantise_beat(mb_on)
    bpb = rhythm.beats_per_bar
    measure = int(q_on // bpb) + 1
    beat_in_bar = q_on - (measure - 1) * bpb
    q_off, _ = quantise_beat(mb_off)
    dur = max(q_off - q_on, Fraction(1, 4))
    return {
        "measure": max(1, measure),
        "beat": round(float(mb_on - (measure - 1) * bpb), 4),
        "beatQuantized": _frac(beat_in_bar),
        "durationBeats": _frac(dur),
        "timingDeviationBeats": round(float(dev), 4),
    }


def write(doc: dict[str, Any], path: str | Path) -> None:
    Path(path).write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")


def engine_block(models: dict[str, str]) -> dict[str, Any]:
    return {
        "name": "nuit-transcriber",
        "version": __version__,
        "createdAt": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "models": models,
    }
