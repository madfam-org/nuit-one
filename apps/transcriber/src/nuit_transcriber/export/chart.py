"""Note chart for Nuit One's NoteHighway: the existing ``NoteEvent`` shape plus guitar fields."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def chart(doc: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for n in doc["notes"]:
        out.append(
            {
                "startTime": n["onset"],
                "duration": round(float(n["offset"]) - float(n["onset"]), 4),
                "pitch": n["midi"],
                "velocity": n["velocity"],
                "string": n.get("string"),
                "fret": n.get("fret"),
                "finger": n.get("lhFinger"),
            }
        )
    return out


def write_chart(doc: dict[str, Any], path: str | Path) -> None:
    Path(path).write_text(json.dumps(chart(doc), separators=(",", ":")) + "\n")
