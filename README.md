# nuit-one

Part of the MADFAM ecosystem. See [AGENTS.md](./AGENTS.md) and [ECOSYSTEM.md](./ECOSYSTEM.md) for project context.

Nuit One (`nuit.one`) is MADFAM's music platform: a browser DAW with a
C++/WASM audio engine, plus server-side AI audio tooling (stem separation,
media import).

## Current status (2026-07-04)

Evidence-based snapshot of what this repository verifiably contains today:

- **Codebase:** Turborepo + pnpm monorepo — `apps/web` (SvelteKit 2),
  `apps/api` (Hono/Node), `packages/audio-engine`, `packages/db`
  (Drizzle ORM/PostgreSQL), `packages/shared`, `packages/ui`.
  ~192 TypeScript/TSX source files, 41 test files.
- **Audio engine:** a real C++ → WASM (Emscripten) DSP core
  (`packages/audio-engine/src/audio_processor.cpp`, `ring_buffer.cpp`,
  CMake + `build.sh`) with TypeScript bindings for AudioWorklet playback.
- **DAW, Phase 1 complete per [docs/ROADMAP.md](./docs/ROADMAP.md):**
  waveform timeline, full transport (stop/record/loop), pan, basic EQ +
  reverb, mic/interface recording, project CRUD, WAV/MP3 export, undo/redo,
  tempo/time-signature display, metronome. MIDI editing, effects chains,
  cloud sync, and real-time collaboration are later phases (not started).
- **AI/media pipeline in code:** server-side Demucs stem separation
  (`apps/api/src/lib/demucs.ts` spawns `demucs -n htdemucs`) and yt-dlp
  media metadata/import (`apps/api/src/lib/media-extractor.ts`), plus
  Basic Pitch/ONNX plans per the roadmap.
- **Deploy target:** Enclii (Hetzner Kubernetes) with Janua SSO, per
  `deploy/enclii.yaml` and docs. Not independently verified as live here.

### Open decision: product identity

The repo currently carries **two descriptions of what Nuit One is**:

1. **[PRD.md](./PRD.md):** a cross-platform DAW + gamified "instrumental
   karaoke" rhythm-game hub for multi-instrumentalists (note highway,
   hardware-interface capture, latency calibration, performance scoring).
2. **[ECOSYSTEM.md](./ECOSYSTEM.md):** an "audio platform — demucs /
   basic-pitch / yt-dlp pipeline" for music education + remix tooling.

Both have real code behind them (the DAW/engine and the demucs/yt-dlp
libraries respectively). Which framing is the product's primary identity is
an **open product decision** as of 2026-07-04 — treat neither document alone
as authoritative until it is resolved.

### Guitar intake (2026-10)

`apps/transcriber` is a Python engine that takes a guitar performance video
(YouTube, any yt-dlp site, or an upload) and returns notes with exact pitch,
string/fret, left- and right-hand fingering, techniques and a tempo map. When
the video shows the neck, it reads the hand's position by fitting the guitar
twin's fret ladder to the frame. Outputs: a `nuit.guitar-performance/1`
document, MusicXML with a TAB staff, MIDI and a NoteHighway chart. The web
app's guitar karaoke view draws the fretboard from the same twin geometry.
Design: [docs/architecture/guitar-intake.md](./docs/architecture/guitar-intake.md).

### CI

CI (`ci.yml`) has been green on `main` since 2026-08-27. Lint is
`biome check .`, and warnings remain to pay down. An earlier version of this
README reported CI as red; that status dates from 2026-07-04.

## Development

```bash
pnpm install
pnpm dev        # run apps in dev mode (Turborepo)
pnpm test       # run tests
pnpm lint       # biome check . (currently failing repo-wide, see above)
pnpm build      # build all packages
```

The WASM audio engine is built separately: `pnpm --filter audio-engine
build:wasm` (requires Emscripten).

## License

This project is licensed under the GNU Affero General Public License v3.0
(AGPL-3.0-only), per the MADFAM public-repo licensing policy (RFC 0024 P1.4).
See [LICENSE](./LICENSE) for the full text.

Copyright (c) 2026 Innovaciones MADFAM SAS de C.V.
