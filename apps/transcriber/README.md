# nuit-transcriber

Guitar intake engine for Nuit One. It takes a performance video (YouTube or any
yt-dlp-supported site, or a local file) and returns pitch, timing, string/fret,
fingering and playing technique, ready for the guitar karaoke view and for
MusicXML/MIDI export.

> **Status (2026-10-07): work in progress.** The modules listed as *done* below
> are implemented and unit-tested; the CLI, fingering solver, video reader,
> technique detector and exporters are not built yet. Design and roadmap:
> [`docs/architecture/guitar-intake.md`](../../docs/architecture/guitar-intake.md).

## Modules

| Module | What it does | State |
|---|---|---|
| `acquire.py` | yt-dlp download (H.264-first video ≤1080p + Opus audio, cached by video id) or local file intake | done, exercised manually |
| `audio_io.py` | ffmpeg decode to float32 numpy (tolerates damaged Opus packets) | done |
| `instrument.py` | Equal-tempered fret geometry `d(n) = L·(1 − 2^(−n/12))`, tunings, capo, every (string, fret) for a pitch, twin geometry document in/out | done, tested |
| `notes.py` | Basic Pitch (ONNX) + guitar clean-up: harmonic-ghost suppression, re-detection merge, per-note pitch re-measured from harmonics (cents) | done, exercised on one video |
| `tuning.py` | Reference pitch (A4 in Hz) as the weighted median of note intonation | done, tested |
| `rhythm.py` | Beats/downbeats/meter/tempo map (Beat This!, librosa fallback), 16th/triplet quantisation | done, tested |
| `fingering.py` | Beam search over string/fret with hand-position, span and video costs; left-hand fingers, barré, right-hand p-i-m-a | next |
| `video/` | Neck rectification fitted to the twin's fret ladder, fretboard skin occupancy, MediaPipe on the upscaled neck crop | next |
| `techniques.py` | Vibrato, bends, slides, ligados, harmonics, percussive effects, dynamics, articulation, tone colour | next |
| `export/` | `nuit.guitar-performance/1` JSON, MusicXML (notation + TAB staves), MIDI, NoteHighway chart | next |

## Environment

```bash
cd apps/transcriber
uv sync
uv run pytest -q
```

The lockfile resolves for **Intel macOS** (developer machines) and **Linux x86_64**
(the container). On Intel macOS the ceilings are torch/torchaudio 2.2.2,
onnxruntime 1.23.2, mediapipe 0.10.21, numba 0.62.1 / llvmlite 0.45.1, and
numpy < 2; `pyproject.toml` encodes them as constraints. Basic Pitch's
TensorFlow/CoreML runtimes are overridden away (its ONNX model is used), and
demucs' `sphn` audio I/O is dropped on Intel macOS (the engine decodes audio
itself and calls `demucs.apply.apply_model`). On Linux, torch comes from the
PyTorch CPU index.

yt-dlp must stay current and needs a JavaScript runtime (deno) for YouTube;
without them YouTube serves only a muxed 360p stream.

## Media and copyright

Downloaded media and everything derived from it live in the repo's gitignored
`storage/` directory. Never commit audio, video, or transcriptions of a
third-party performance to this public repository.

## Model licences

| Component | Code | Weights |
|---|---|---|
| Basic Pitch | Apache-2.0 | ship in the Apache-2.0 package |
| Beat This! | MIT | MIT (per its README) |
| MediaPipe Hands | Apache-2.0 | Apache-2.0 |
| Demucs | MIT | no separate grant published |
| yt-dlp | Unlicense | — |
