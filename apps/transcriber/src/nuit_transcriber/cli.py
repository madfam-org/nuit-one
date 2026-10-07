"""``nuit-transcribe``: guitar intake from a URL or a media file.

Writes into ``--out``:

* ``performance.json``: the ``nuit.guitar-performance/1`` document (validated)
* ``performance.musicxml``: notation + TAB staves with fingering and techniques
* ``performance.mid`` and ``chart.json`` (NoteHighway)
* ``debug/*.png`` with ``--debug-frames``: video frames with the predicted fingering drawn on the
  fitted fretboard

Progress goes to stdout as JSON lines with ``--progress json``:
``{"stage": "notes", "progress": 0.35}``; the API job parses them. Logs go to stderr.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import pickle
import sys
import time
from pathlib import Path
from typing import Any

from . import __version__

log = logging.getLogger("nuit_transcriber")

STAGES = [
    ("acquire", 0.03),
    ("audio", 0.05),
    ("notes", 0.25),
    ("rhythm", 0.35),
    ("video", 0.70),
    ("fingering", 0.80),
    ("techniques", 0.90),
    ("export", 1.0),
]


class Progress:
    def __init__(self, mode: str) -> None:
        self.mode = mode
        self.t0 = time.time()

    def __call__(self, stage: str, progress: float, **extra: Any) -> None:
        if self.mode == "json":
            print(json.dumps({"stage": stage, "progress": round(progress, 3), **extra}), flush=True)
        else:
            print(
                f"[{time.time() - self.t0:6.1f}s] {stage:<11} {progress * 100:5.1f}%",
                file=sys.stderr,
                flush=True,
            )


def _cached(path: Path, fn):
    if path.is_file():
        with path.open("rb") as fh:
            return pickle.load(fh)
    value = fn()
    with path.open("wb") as fh:
        pickle.dump(value, fh)
    return value


def run(args: argparse.Namespace) -> dict[str, Any]:

    from .acquire import acquire
    from .audio_io import load_audio
    from .export import chart as chart_export
    from .export import document as docmod
    from .export import midi as midi_export
    from .fingering import FingerNote, as_positions, solve
    from .instrument import Guitar, Tuning, geometry_to_doc, infer_tuning
    from .notes import transcribe
    from .rhythm import analyse
    from .techniques import (
        Spectral,
        articulation,
        chords,
        dynamics,
        percussive_onsets,
        post_fingering,
        pre_fingering,
        style_summary,
        timbre,
        velocities,
    )
    from .tuning import apply_reference, estimate_reference
    from .twin import load as load_twin

    progress = Progress(args.progress)
    out = Path(args.out).expanduser().resolve()
    work = out / "work"
    work.mkdir(parents=True, exist_ok=True)
    warnings: list[str] = []

    progress("acquire", 0.0)
    acq = acquire(args.source, args.cache, want_video=not args.no_video)
    t0 = float(args.start or 0.0)
    t1 = float(args.end) if args.end else None

    progress("audio", STAGES[0][1])
    a22 = load_audio(acq.audio_path, 22050)
    a44 = load_audio(acq.audio_path, 44100)
    s22, s44 = int(t0 * 22050), int(t0 * 44100)
    e22 = int(t1 * 22050) if t1 else None
    e44 = int(t1 * 44100) if t1 else None
    a22, a44 = a22[s22:e22], a44[s44:e44]

    guitar = load_twin(args.twin, capo=args.capo)
    progress("notes", STAGES[1][1])
    tr = _cached(
        work / "notes.pkl", lambda: transcribe(a22, a44, lowest_midi=guitar.lowest_midi - 2, workdir=work)
    )
    notes = sorted(tr.notes, key=lambda n: (n.onset, n.midi))
    for n in notes:
        n.onset += t0
        n.offset += t0
    ref = estimate_reference(notes)
    apply_reference(notes, ref)
    if args.tuning == "auto":
        inferred = infer_tuning([n.midi for n in notes], ref.a4_hz)
        guitar = Guitar(
            guitar.geometry, Tuning(inferred.name, inferred.open_midi, ref.a4_hz, guitar.tuning.capo)
        )
    else:
        guitar = Guitar(
            guitar.geometry,
            Tuning(guitar.tuning.name, guitar.tuning.open_midi, ref.a4_hz, guitar.tuning.capo),
        )

    progress("rhythm", STAGES[2][1])
    rhythm = _cached(work / "rhythm.pkl", lambda: analyse(a22, 22050))
    rhythm.beats = rhythm.beats + t0 if rhythm.beats.size and rhythm.beats[0] < t0 else rhythm.beats
    rhythm.downbeats = (
        rhythm.downbeats + t0
        if rhythm.downbeats.size and t0 and rhythm.downbeats[0] < t0
        else rhythm.downbeats
    )
    if notes:
        rhythm.set_lead_for(notes[0].onset)
    if rhythm.source != "beat_this":
        warnings.append("beat tracking fell back to librosa")

    prior = None
    video_doc: dict[str, Any] | None = None
    track = positions = None
    if acq.video_path is not None and not args.no_video:
        from .video.fretboard import track_neck
        from .video.position import read_positions

        progress("video", STAGES[3][1], detail="neck")
        track = _cached(
            work / "neck.pkl", lambda: track_neck(str(acq.video_path), guitar.geometry, 1.0, None, t0, t1)
        )
        if track.fits:
            progress("video", 0.5, detail="hand")
            positions = _cached(
                work / "positions.pkl",
                lambda: read_positions(str(acq.video_path), track, guitar.geometry, 10.0, True, t0, t1),
            )
            prior = positions
            video_doc = {"used": True, **positions.stats}
        else:
            warnings.append("the guitar neck was not found in the video; fingering uses audio only")
            video_doc = {"used": False, "neckKeyframes": 0}
    else:
        warnings.append("no video: fingering uses audio only")

    progress("fingering", STAGES[4][1])
    spec = Spectral.compute(a44)
    spec_offset = t0

    class _ShiftedSpectral:
        def __init__(self, s, off):
            self.s, self.off = s, off

        def harmonic_profile(self, midi, a, b, n=6):
            return self.s.harmonic_profile(midi, a - self.off, b - self.off, n)

        def brightness(self, midi, a, b):
            return self.s.brightness(midi, a - self.off, b - self.off)

    sspec = _ShiftedSpectral(spec, spec_offset)
    hints = pre_fingering(notes, sspec, guitar.tuning.sounding_open_midi)  # type: ignore[arg-type]
    fnotes = [
        FingerNote(
            onset=n.onset,
            offset=n.offset,
            midi=n.midi,
            confidence=n.confidence,
            must_fret=h.must_fret,
            plucked=h.slur_from is None,
            harmonic_fret=h.harmonic_fret,
            slide=h.slide,
            slur_from=h.slur_from,
        )
        for n, h in zip(notes, hints, strict=True)
    ]
    sol = solve(fnotes, guitar, prior=prior)

    progress("techniques", STAGES[5][1])
    perc = percussive_onsets(spec, offset=t0)
    techs, events = post_fingering(notes, sol.notes, hints, sspec, perc)  # type: ignore[arg-type]
    vel = velocities(notes)
    marks, changes = dynamics(notes, vel)
    arts = articulation(notes, vel)
    tim = timbre(notes, sspec)  # type: ignore[arg-type]
    chord_list = chords(notes, rhythm.beats)
    measure_beats = [rhythm.measure_beat(n.onset) for n in notes]
    style = style_summary(notes, vel, measure_beats, rhythm.beats_per_bar, rhythm.beats, techs, sol.positions)

    progress("export", STAGES[6][1])
    note_docs = []
    for i, (n, a) in enumerate(zip(notes, sol.notes, strict=True)):
        art, extra = arts[i]
        flags = sorted(set(n.flags) | set(a.flags))
        note_docs.append(
            {
                "id": i,
                "onset": round(n.onset, 4),
                "offset": round(n.offset, 4),
                "midi": n.midi,
                "cents": round(n.cents, 1),
                "velocity": vel[i],
                "confidence": round(n.confidence, 3),
                "string": a.string,
                "fret": a.fret,
                "lhFinger": a.lh_finger,
                "rhFinger": a.rh_finger,
                "voice": a.voice,
                "event": a.event,
                **docmod.quantised_fields(rhythm, n.onset, n.offset),
                "barre": a.barre,
                "techniques": techs[i] + extra,
                "dynamic": marks[i] if marks else None,
                "articulation": art,
                "timbre": tim[i],
                "flags": flags,
            }
        )
    instrument = geometry_to_doc(guitar)
    instrument["tuning"]["offsetCents"] = round(ref.offset_cents, 2)
    instrument["tuning"]["intonationSpreadCents"] = (
        round(ref.spread_cents, 2) if ref.spread_cents == ref.spread_cents else None
    )
    pos_spans = positions.segments() if positions is not None else as_positions(sol, fnotes)
    unplaced = sum(1 for a in sol.notes if a.string is None)
    if unplaced:
        warnings.append(f"{unplaced} notes have no playable position on this instrument")
    models = {
        "notes": "basic-pitch icassp-2022 (onnx)",
        "beats": "beat_this final0" if rhythm.source == "beat_this" else "librosa",
        "hands": "mediapipe hands 0.10.21" if video_doc and video_doc.get("used") else "none",
    }
    doc = {
        "schema": docmod.SCHEMA_ID,
        "engine": docmod.engine_block(models),
        "source": acq.to_doc(),
        "instrument": instrument,
        "timing": {
            "source": rhythm.source,
            "beats": [round(float(b), 4) for b in rhythm.beats],
            "downbeats": [round(float(b), 4) for b in rhythm.downbeats],
            "beatsPerBar": rhythm.beats_per_bar,
            "beatUnit": 4,
            "tempoBpm": round(rhythm.tempo_bpm, 2),
            "tempoCurve": [[t, v] for t, v in rhythm.tempo_curve],
            "firstBarStart": round(rhythm.first_bar_start, 4),
            "rubatoIndex": style.get("rubatoIndex"),
        },
        "notes": note_docs,
        "events": events,
        "positions": pos_spans,
        "chords": chord_list,
        "dynamics": changes,
        "style": style,
        "video": video_doc,
        "quality": {
            "notesTotal": len(note_docs),
            "notesFingered": len(note_docs) - unplaced,
            "warnings": warnings,
            "removedByCleanup": tr.removed,
        },
    }
    docmod.validate(doc)
    docmod.write(doc, out / "performance.json")
    midi_export.write_midi(doc, out / "performance.mid")
    chart_export.write_chart(doc, out / "chart.json")
    try:
        from .export.musicxml import write_musicxml

        write_musicxml(doc, out / "performance.musicxml")
    except Exception as exc:  # the score export must not sink the intake
        warnings.append(f"MusicXML export failed: {exc}")
        doc["quality"]["warnings"] = warnings
        docmod.write(doc, out / "performance.json")

    if args.debug_frames and acq.video_path is not None and track is not None and track.fits:
        _debug_frames(acq.video_path, track, guitar, doc, out / "debug", positions)
    progress("done", 1.0, notes=len(note_docs))
    return doc


def _debug_frames(video_path, track, guitar, doc, outdir: Path, positions) -> None:
    """Frames with the fitted ladder, the read hand position and the predicted fingering."""
    import cv2

    from .video.fretboard import draw_fit
    from .video.position import draw_position

    outdir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video_path))
    notes = doc["notes"]
    times = sorted({round(n["onset"], 2) for n in notes if n.get("fret") is not None})
    if not times:
        return
    picks = [times[int(k * (len(times) - 1) / 11)] for k in range(12)]
    g = guitar.geometry
    for t in picks:
        cap.set(cv2.CAP_PROP_POS_MSEC, (t + 0.06) * 1000)
        ok, frame = cap.read()
        fit = track.at(t)
        if not ok or fit is None:
            continue
        img = draw_fit(frame, fit, g)
        if positions is not None:
            pos, _ = positions(t)
            if pos is not None:
                img = draw_position(img, fit, g, pos)
        for n in notes:
            if abs(n["onset"] - t) > 0.04 or n.get("fret") is None or n.get("string") is None:
                continue
            course = guitar.course_from_string_number(n["string"])
            f = n["fret"]
            x = (g.fret_distance_mm(f - 1) + g.fret_distance_mm(f)) / 2 if f > 0 else -4.0
            y = g.string_y_mm(course, guitar.n_courses, x)
            px, py = fit.to_image(x, y)
            cv2.circle(img, (int(px), int(py)), 5, (0, 0, 255), 2)
            label = f"{n['string']}/{f}" + (f" {n['lhFinger']}" if n.get("lhFinger") else "")
            cv2.putText(img, label, (int(px) + 6, int(py) - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
        cv2.imwrite(str(outdir / f"t{t:07.2f}.png"), img)
    cap.release()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="nuit-transcribe", description=__doc__.splitlines()[0])
    ap.add_argument("source", help="http(s) URL (YouTube or any yt-dlp site) or a local media file")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--cache", default=os.environ.get("NUIT_INTAKE_CACHE", "storage/intake"))
    ap.add_argument(
        "--twin",
        default=None,
        help="twin preset (classical-650, steel-string-645, electric-648, "
        "electric-628), a hyperobject project.json, or an instrument JSON",
    )
    ap.add_argument("--tuning", default="auto", help="'auto' or 'twin' (use the twin's tuning)")
    ap.add_argument("--capo", type=int, default=0)
    ap.add_argument("--no-video", action="store_true", help="ignore the video even when available")
    ap.add_argument("--start", type=float, default=None, help="analyse from this time (s)")
    ap.add_argument("--end", type=float, default=None, help="analyse up to this time (s)")
    ap.add_argument("--debug-frames", action="store_true")
    ap.add_argument("--progress", choices=["text", "json"], default="text")
    ap.add_argument("--version", action="version", version=f"nuit-transcriber {__version__}")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
    logging.getLogger("absl").setLevel(logging.ERROR)
    try:
        run(args)
    except Exception as exc:
        if args.progress == "json":
            print(json.dumps({"stage": "error", "progress": 1.0, "error": str(exc)[:500]}), flush=True)
        log.exception("intake failed")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
