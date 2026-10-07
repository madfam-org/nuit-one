"""Standard MIDI file of a performance document (one guitar track, tempo from the beat map)."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def write_midi(doc: dict[str, Any], path: str | Path) -> None:
    import pretty_midi

    tempo = float(doc["timing"].get("tempoBpm") or 120.0)
    pm = pretty_midi.PrettyMIDI(initial_tempo=tempo)
    program = 24 if doc["instrument"].get("variant") == "classical" else 25  # nylon / steel guitar
    inst = pretty_midi.Instrument(program=program, name=doc["source"].get("title", "Guitar")[:60])
    for n in doc["notes"]:
        start, end = float(n["onset"]), max(float(n["offset"]), float(n["onset"]) + 0.02)
        inst.notes.append(
            pretty_midi.Note(velocity=int(n["velocity"]), pitch=int(n["midi"]), start=start, end=end)
        )
    pm.instruments.append(inst)
    pm.write(str(path))
