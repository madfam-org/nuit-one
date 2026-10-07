"""Guitar twins: reference presets and hyperobject cartridge manifests → ``InstrumentGeometry``.

Parameter ids match the proposed commons ``guitar-neck`` cartridge and the TypeScript adapter in
``packages/shared/src/guitar/geometry.ts`` (``GUITAR_TWIN_PRESETS``, ``twinParametersFromManifest``).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .instrument import TUNINGS, Guitar, InstrumentGeometry, Tuning, from_geometry

RADII_MM = {"7.25in": 184.15, "9.5in": 241.3, "12in": 304.8, "16in": 406.4, "flat": None}

PRESETS: dict[str, dict[str, Any]] = {
    "classical-650": {
        "variant": "classical",
        "scale_length": 650.0,
        "fret_count": 19,
        "frets_to_body": 12,
        "nut_width": 52.0,
        "width_at_body_joint": 62.0,
        "string_count": 6,
        "string_spacing_at_saddle": 58.0,
        "fingerboard_radius": "flat",
        "tuning": "standard",
    },
    "steel-string-645": {
        "variant": "steel-string",
        "scale_length": 645.16,
        "fret_count": 20,
        "frets_to_body": 14,
        "nut_width": 43.0,
        "width_at_body_joint": 55.0,
        "string_count": 6,
        "string_spacing_at_saddle": 54.0,
        "fingerboard_radius": "16in",
        "tuning": "standard",
    },
    "electric-648": {
        "variant": "electric",
        "scale_length": 647.7,
        "fret_count": 22,
        "frets_to_body": 16,
        "nut_width": 42.0,
        "width_at_body_joint": 56.0,
        "string_count": 6,
        "string_spacing_at_saddle": 52.5,
        "fingerboard_radius": "9.5in",
        "tuning": "standard",
    },
    "electric-628": {
        "variant": "electric",
        "scale_length": 628.65,
        "fret_count": 22,
        "frets_to_body": 16,
        "nut_width": 43.0,
        "width_at_body_joint": 56.0,
        "string_count": 6,
        "string_spacing_at_saddle": 52.0,
        "fingerboard_radius": "12in",
        "tuning": "standard",
    },
}


def geometry_from_params(params: dict[str, Any], twin_ref: str | None = None) -> InstrumentGeometry:
    variant = str(params.get("variant", "classical"))
    nut = float(params["nut_width"])
    margin = 4.5 if variant == "classical" else 3.2
    return InstrumentGeometry(
        variant=variant,
        scale_length_mm=float(params["scale_length"]),
        fret_count=int(params["fret_count"]),
        frets_to_body=int(params["frets_to_body"]),
        nut_width_mm=nut,
        width_at_body_joint_mm=float(params["width_at_body_joint"]),
        string_spread_nut_mm=max(nut - 2 * margin, nut * 0.6),
        string_spread_saddle_mm=float(params["string_spacing_at_saddle"]),
        fingerboard_radius_mm=RADII_MM.get(str(params.get("fingerboard_radius", "flat"))),
        inlay_frets=()
        if variant == "classical"
        else tuple(f for f in (3, 5, 7, 9, 12, 15, 17, 19, 21, 24) if f <= int(params["fret_count"])),
        twin_ref=twin_ref,
    )


def params_from_manifest(
    manifest: dict[str, Any], fallback: str = "classical-650"
) -> tuple[dict[str, Any], str | None]:
    params = dict(PRESETS[fallback])
    for p in manifest.get("parameters", []):
        if isinstance(p, dict) and p.get("id") in params and p.get("default") is not None:
            params[p["id"]] = p["default"]
    slug = (manifest.get("project") or {}).get("slug")
    return params, (f"hyperobject:solid/{slug}" if slug else None)


def load(spec: str | None, capo: int = 0) -> Guitar:
    """``spec`` = a preset name, a hyperobject ``project.json`` path, or an instrument JSON path."""
    if spec is None:
        spec = "classical-650"
    if spec in PRESETS:
        params = PRESETS[spec]
        geometry = geometry_from_params(params, f"preset:{spec}")
        open_midi = TUNINGS[params["tuning"]][: int(params["string_count"])]
        return Guitar(geometry=geometry, tuning=Tuning(params["tuning"], tuple(open_midi), capo=capo))
    doc = json.loads(Path(spec).read_text())
    if "parameters" in doc and "project" in doc:
        params, ref = params_from_manifest(doc)
        geometry = geometry_from_params(params, ref)
        tuning = str(params.get("tuning", "standard"))
        open_midi = TUNINGS.get(tuning, TUNINGS["standard"])[: int(params["string_count"])]
        return Guitar(geometry=geometry, tuning=Tuning(tuning, tuple(open_midi), capo=capo))
    guitar = from_geometry(doc.get("instrument", doc))
    if capo:
        guitar = Guitar(
            guitar.geometry, Tuning(guitar.tuning.name, guitar.tuning.open_midi, guitar.tuning.a4_hz, capo)
        )
    return guitar
