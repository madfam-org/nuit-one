# Nuit One -- Implementation Roadmap

## Project Overview

Nuit One is a cross-platform music production and gamified performance platform for multi-instrumentalists. It combines low-latency audio capture via WebAssembly AudioWorklets, real-time AI music analysis, and workspace-scoped project management into a single hub hosted at `nuit.one`.

The platform is built as a Turborepo monorepo deployed on Hetzner via Enclii (Kubernetes + Cloudflare Tunnel), using Janua for SSO, PostgreSQL via Drizzle ORM, and Cloudflare R2 for stem storage.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | SvelteKit 2 | SSR + SPA, workspace routing |
| API | Hono (Node.js) | REST endpoints, JWT validation |
| Auth | Janua SSO (OAuth 2.0) | Identity, workspace RBAC |
| Database | PostgreSQL + Drizzle ORM | Projects, tracks, stems, performances |
| Object Storage | Cloudflare R2 / local FS | Audio stems, WASM binaries (local dev: `./storage/`) |
| Audio Engine | C++ -> WASM (Emscripten) | AudioWorklet DSP, ring buffer |
| AI Inference | ONNX Runtime (WASM/GPU) | Basic Pitch, Demucs, SongDriver |
| Real-time | Soketi (Pusher-compat) | WebSocket collaboration events |
| UI System | Svelte components | Neon-noir design tokens, Liquid Glass |
| Monorepo | Turborepo + pnpm | Build orchestration, shared packages |
| Deploy | Enclii (Hetzner K8s) | Containers, Cloudflare Tunnel ingress |

## Monorepo Structure

```
nuit-one/
  apps/
    web/          SvelteKit frontend (Phase 0)
    api/          Hono REST API
  packages/
    audio-engine/ C++/WASM DSP core + TS bindings
    db/           Drizzle schema, migrations, client
    shared/       Types, constants, validators
    ui/           Svelte components + design tokens
  deploy/
    enclii.yaml           Service definitions
    k8s/soketi.yaml       WebSocket server manifest
    cloudflare/           Tunnel reference config
```

## Competitive Benchmark

Nuit One sits at the intersection of **web-based DAWs** (BandLab, Soundtrap, Amped Studio, Audiotool, Soundation, Moises) and **audiovisual practice/karaoke platforms** (Yousician, Rocksmith+, Simply Piano/Guitar, Fender Play, Moises, Clone Hero, Smule). An audit of 19 platforms across both categories identified the baseline features users expect, where we stand, and where we differentiate.

### DAW Baseline Features

Features present in 5+ of 6 surveyed web DAWs. These are table stakes — users assume they exist.

| ID | Feature | Competitors | Nuit One Status | Target Phase |
|----|---------|-------------|-----------------|--------------|
| D1 | Waveform display on timeline | 6/6 | Done | Phase 1 ✅ |
| D2 | Full transport (stop, record, loop region) | 6/6 | Done | Phase 1 ✅ |
| D3 | Pan control | 6/6 | Done | Phase 1 ✅ |
| D4 | Basic EQ + reverb | 6/6 | Done | Phase 1 ✅ |
| D5 | Audio recording from mic/interface | 6/6 | Done | Phase 1 ✅ |
| D6 | Project CRUD UI | 5/6 | Done | Phase 1 ✅ |
| D7 | Export to WAV/MP3 | 6/6 | Done | Phase 1 ✅ |
| D8 | Undo/redo | 6/6 | Done | Phase 1 ✅ |
| D9 | Tempo/time signature display | 5/6 | Done | Phase 1 ✅ |
| D10 | Metronome | 5/6 | Done | Phase 1 ✅ |
| D11 | MIDI editing | 4/6 | Not started | Phase 3 |
| D12 | AI mastering | 2/6 (BandLab, Moises) | Not started | Phase 5 |
| D13 | Full effects chain (compression, delay, chorus) | 6/6 | Not started | Phase 5 |
| D14 | Multi-format export (FLAC, stems, metadata) | 4/6 | Not started | Phase 5 |
| D15 | Automation lanes | 5/6 | Not started | Phase 5 |

### Practice Platform Baseline Features

Features present in 5+ of 7 surveyed practice/karaoke platforms.

| ID | Feature | Competitors | Nuit One Status | Target Phase |
|----|---------|-------------|-----------------|--------------|
| P1 | AI stem separation | 3/7 (Moises, Yousician, Rocksmith+) | Done (Demucs 2-stem) | MVP ✅ |
| P2 | Song library / catalog | 6/7 | Partial (user uploads only) | Phase 3 |
| P3 | Difficulty levels | 5/7 | Not started | Phase 3 |
| P4 | Mobile apps (iOS/Android) | 6/7 | Not started | Phase 6 |
| P5 | Tempo control / slow-down practice | 6/7 | Not started | Phase 3 |
| P6 | Real-time pitch/note detection | 5/7 | Done (bass only) | MVP ✅ |
| P7 | Scoring / grading | 5/7 | Done (bass only) | MVP ✅ |
| P8 | Multi-instrument support | 5/7 | Not started | Phase 3 |
| P9 | Progress tracking / history | 6/7 | Not started (schema exists) | Phase 3 |
| P10 | Subscription model | 6/7 | Not started | Phase 7 |

### Near-Baseline Features

Present in 3-4 competitors. Worth having but not urgent.

| ID | Feature | Competitors | Target Phase |
|----|---------|-------------|--------------|
| N1 | Automation lanes | 5/6 DAWs | Phase 5 |
| N2 | AI composition / suggestion tools | 2/6 (BandLab, Soundtrap) | Phase 5 |
| N3 | Video sync | 2/7 practice platforms | Deferred |
| N4 | VST/plugin hosting | 3/6 DAWs | Deferred |

### Strategic Differentiators

Features that define Nuit One's unique position. No single competitor combines all of these.

| ID | Feature | Closest Competitor | Nuit One Status | Target Phase |
|----|---------|-------------------|-----------------|--------------|
| S1 | BYO-song stem separation + gamified scoring | Moises (stems, no scoring) | Done (bass only) | MVP ✅ |
| S2 | Multi-instrument pitch detection (bass, guitar, keys, drums) | Yousician (guitar/piano only) | Bass only | Phase 3 |
| S3 | Real-time multiplayer band scoring | None | Not started | Phase 4 |
| S4 | Hybrid BYO + licensed song catalog | Moises (BYO only), Yousician (licensed only) | BYO only | Phase 7 |
| S5 | Drum scoring via onset detection (real kits) | None (all use MIDI/pad input) | Not started | Phase 3 |
| S6 | Community song library (user-published stems + charts) | Clone Hero (charts only, no stems) | Not started | Phase 4 |

## Phased Roadmap

### Phase 0 -- Skeleton and Audio Pipeline ✅

**Status: COMPLETE**

**Goal:** Prove the full-stack loop from browser mic input through WASM AudioWorklet to playback output.

- Turborepo + pnpm workspace scaffolding
- C++ ring buffer compiled to WASM via Emscripten
- AudioWorklet passthrough processor with SharedArrayBuffer
- Hono API with JWT middleware (Janua JWKS validation)
- Drizzle schema: projects, tracks, stems, performances, calibration
- SvelteKit app shell with Janua OAuth redirect
- Neon-noir design tokens and base Svelte components (Button, GlassCard, NeonBadge)

### Bass Karaoke MVP (Phases A-D) ✅

**Status: COMPLETE — RUNNABLE**

**Goal:** Upload a song, AI-separate stems, play back with bass muted, show notes, score performance.

**Quick Start:** `chmod +x scripts/setup-dev.sh && ./scripts/setup-dev.sh && pnpm dev`

#### Phase A -- Upload & Store
- Drag-and-drop upload zone with progress bar (UploadZone.svelte)
- Dual-mode storage: local filesystem (dev) or R2 presigned URLs (prod)
- Track creation in DB with status tracking (pending_upload → uploaded)
- Dashboard with TrackList showing upload status via NeonBadge
- Server-side load functions for user's tracks

#### Phase B -- Stem Separation
- Demucs CLI wrapper (`--two-stems bass`) producing bass + no_bass stems
- In-memory job manager with status polling (3s interval)
- Storage adapter (local/R2) for stems on API service
- SvelteKit → Hono API bridge routes for processing
- ProcessingStatus component with progress bar (accepts external jobId to prevent double-trigger)

#### Phase C -- Multi-Stem Playback
- StemPlayer class using Web Audio API (AudioBufferSourceNode + GainNode)
- Per-stem volume, mute, and solo controls (StemMixer.svelte)
- Transport bar with play/pause, seek, keyboard shortcuts (Space, arrows)
- COEP-safe audio proxy at `/api/audio/[...path]` for R2 or local content
- Svelte 5 reactive player store with rAF-based time updates
- Bass karaoke default: backing track at 100%, bass muted

#### Phase D -- Note Display & Scoring
- Basic Pitch CLI wrapper for bass stem transcription to NoteEvent[]
- Canvas-based scrolling note highway (NoteHighway.svelte)
- Real-time pitch detection via autocorrelation (PitchDetector class)
- Scoring engine with timing windows (25/50/100ms) and combo multipliers (1-4x)
- Performance mode page with countdown → play → results flow
- Results screen with grade (S/A/B/C/D/F), stats grid, accuracy

#### Dev Infrastructure
- One-command setup: `scripts/setup-dev.sh` (PostgreSQL, Python venv, ffmpeg, yt-dlp)
- Dev auth bypass: auto-session with deterministic UUIDs, no Janua required
- Local filesystem storage: `STORAGE_MODE=local` stores files in `./storage/`
- YouTube import: paste a URL → yt-dlp download → Demucs → Basic Pitch → ready to play

### Phase 1 -- Core DAW Foundation ✅

**Status: COMPLETE**

**Goal:** Deliver the baseline DAW features users expect on day one: waveform, recording, export, effects, undo, metronome.

#### Slice 1 -- MVP Stickiness
- Performance persistence: POST/GET API routes + SvelteKit bridge (fire-and-forget save on game end)
- Project CRUD UI: list, create, rename, delete with track count subquery (D6 ✅)
- Progress tracking: per-track stats page with score trend chart (canvas-based, neon-noir)
- Tempo/time signature settings UI surfacing existing DB columns (D9 ✅)

#### Slice 2 -- Core DAW Identity
- Extended StemPlayer signal chain: `source → eqLow → eqMid → eqHigh → gain → panner → destination` + reverb wet path via shared ConvolverNode
- Pan control via StereoPannerNode per stem (D3 ✅)
- 3-band parametric EQ: lowshelf 200Hz, peaking 1kHz, highshelf 4kHz (D4 ✅)
- Convolver reverb with IR presets (room/hall/plate) (D4 ✅)
- A-B loop region with auto-restart
- Undo/redo via command pattern: CommandStack (max 100) + 6 command types (D8 ✅)
- Canvas waveform display per stem with click-to-seek and shift-drag loop selection (D1 ✅)
- Full transport: play, stop, loop toggle, A/B markers, keyboard shortcuts (D2 ✅)
- DAW workspace route at `/projects/[id]` with multitrack timeline layout

#### Slice 3 -- Recording & Export
- Mic recording via getUserMedia + MediaRecorder with AnalyserNode level metering (D5 ✅)
- WAV encoder: PCM 16-bit interleaved with proper header
- MP3 export via lamejs (lazy loaded, ~100KB) (D7 ✅)
- Export dialog: format selector (WAV/MP3), quality picker (128/192/320 kbps), download trigger
- EQ controls: 3 vertical sliders (-12 to +12 dB) per stem
- Reverb controls: amount slider + IR preset selector
- Metronome: look-ahead scheduler with OscillatorNode clicks (880Hz downbeat, 440Hz others) (D10 ✅)
- BPM detection: energy-based onset envelope + autocorrelation (60-200 BPM range)
- Latency calibration wizard: 4-step UI (output → input → display → save)
- Performance persistence bug fix: scores now saved to `performances` table

### Phase 2 -- AI Intelligence Layer

**Goal:** Move AI inference to the browser, expand from bass-only to full-spectrum music intelligence.

- Demucs full 4-stem separation (vocals, drums, bass, other)
- ONNX Runtime in-browser inference (no server round-trip)
- Web Worker offloading for model execution
- MIDI data overlay on multitrack timeline
- AI chord detection from audio (chroma features or ONNX model) — Moises + BandLab have this
- AI key detection (byproduct of chord detection)
- AI BPM detection via ML model (refines Phase 1's algorithmic version)
- Adaptive difficulty data model: tag notes by density/complexity tiers for Easy/Medium/Hard/Expert charts
- WebGPU acceleration backend for ONNX Runtime (Demucs is ~80 MB, needs GPU)

### Phase 3 -- Multi-Instrument Performance Mode

**Goal:** Expand from bass-only karaoke to a full multi-instrument practice platform with tempo control, difficulty levels, and progress tracking.

- WebGL note highway renderer (performance optimization)
- Multi-instrument support: guitar, keyboard, drums (P8)
- Performance recording with automatic stem export
- Practice mode with tempo control / time-stretching without pitch shift (P5 — SoundTouch WASM)
- A-B loop markers for section practice (P5 — Rocksmith+ Riff Repeater, Moises)
- Progressive difficulty levels: Easy/Medium/Hard/Expert note charts from Phase 2 AI data (P3)
- Progress tracking: per-song history, improvement graphs, streak tracking (P9)
- Drum scoring via onset detection for percussive input (S5 — no competitor does this for real kits)
- Guitar + keyboard pitch detection: extend range to E2-E6, add Web MIDI API for MIDI keyboards (S2)
- Multiple notation modes: tab view for guitar, standard notation option
- Song library browser: searchable/filterable view with BPM, key, difficulty metadata (P2)

### Phase 4 -- Social & Collaboration

**Goal:** Multi-user project management, real-time multiplayer performance, and community features.

- Workspace member management via Janua organizations
- Role-based UI gating (owner/admin/manager/member/viewer)
- Project progress dashboard (stems needed vs delivered)
- Real-time cursors and presence indicators via Soketi (moved from Phase 3)
- Commenting and review workflow on stems
- Real-time multiplayer band scoring via Soketi: multiple players, per-instrument scores, combined band score (S3)
- Leaderboards: per-song, per-instrument, global + workspace-scoped
- Social sharing: performance result cards for social media
- Community song library: publish processed songs with stems + note charts for others to play (S6)
- Friend system / follow other musicians
- Weekly challenges / competitions on specific songs
- Public artist profiles at `nuit.one/slug` (moved from Phase 7 — growth feature, not polish)

### Phase 5 -- AI Accompaniment and Advanced DSP

**Goal:** Generative backing tracks, professional mixing tools, and AI-assisted mastering.

- SongDriver ONNX model for tempo-tracking accompaniment
- Full WASM DSP effects chain: compression, delay, chorus, distortion, limiter (D13 — basic EQ + reverb are Phase 1)
- Mix routing matrix
- Multi-format export: FLAC, multi-track stem export, metadata embedding (D14 — basic WAV/MP3 is Phase 1)
- AI mastering: one-click loudness normalization, EQ curve, limiting (D12 — BandLab offers free, LANDR/Moises paid)
- Automation lanes: parameter automation on timeline (D15)
- AI composition tools: extend/recompose suggestions (N2 — BandLab differentiator)

### Phase 6 -- Native Clients

**Goal:** Desktop and mobile apps with kernel-level audio drivers and offline capability.

- JUCE or Superpowered SDK integration
- Shared C++ audio engine across web and native
- Platform-specific latency optimization
- Offline project sync
- iOS + Android apps via Capacitor or React Native (P4 — 6/7 practice platforms have mobile)
- Offline practice mode: download songs + stems + note charts (critical for mobile)
- Push notifications: challenges, friend activity, streaks
- Native MIDI hardware support bypassing Web MIDI limitations

### Phase 7 -- Scale, Polish & Growth

**Goal:** Production hardening, monetization, and growth infrastructure.

- Horizontal scaling for API and WebSocket tiers
- CDN edge caching for WASM and stem assets
- Prometheus + Grafana monitoring
- Error tracking (Sentry)
- Subscription model with free tier via Stripe (P10 — 6/7 practice platforms use subscriptions)
- Content licensing infrastructure for optional licensed catalog (S4 — hybrid BYO + licensed)
- Internationalization (multi-language)
- Accessibility audit (WCAG 2.1 AA)
- Analytics and growth tooling

## Feature Parity Checklist

### DAW Baseline Coverage

| ID | Feature | Phase | Status |
|----|---------|-------|--------|
| D1 | Waveform display | 1 | Done |
| D2 | Full transport | 1 | Done |
| D3 | Pan control | 1 | Done |
| D4 | Basic EQ + reverb | 1 | Done |
| D5 | Audio recording | 1 | Done |
| D6 | Project CRUD UI | 1 | Done |
| D7 | WAV/MP3 export | 1 | Done |
| D8 | Undo/redo | 1 | Done |
| D9 | Tempo/time signature | 1 | Done |
| D10 | Metronome | 1 | Done |
| D11 | MIDI editing | 3 | Not started |
| D12 | AI mastering | 5 | Not started |
| D13 | Full effects chain | 5 | Not started |
| D14 | Multi-format export | 5 | Not started |
| D15 | Automation lanes | 5 | Not started |

### Practice Platform Baseline Coverage

| ID | Feature | Phase | Status |
|----|---------|-------|--------|
| P1 | AI stem separation | MVP | Done |
| P2 | Song library / catalog | 3 | Partial |
| P3 | Difficulty levels | 3 | Not started |
| P4 | Mobile apps | 6 | Not started |
| P5 | Tempo control / slow-down | 3 | Not started |
| P6 | Real-time pitch detection | MVP | Done |
| P7 | Scoring / grading | MVP | Done |
| P8 | Multi-instrument support | 3 | Not started |
| P9 | Progress tracking | 1 | Done (score history + trend chart) |
| P10 | Subscription model | 7 | Not started |

### Strategic Differentiator Coverage

| ID | Feature | Phase | Status |
|----|---------|-------|--------|
| S1 | BYO-song stems + gamified scoring | MVP | Done (bass) |
| S2 | Multi-instrument pitch detection | 3 | Bass only |
| S3 | Real-time multiplayer band scoring | 4 | Not started |
| S4 | Hybrid BYO + licensed catalog | 7 | BYO only |
| S5 | Drum scoring via onset detection | 3 | Not started |
| S6 | Community song library | 4 | Not started |

## Critical Path

```
Phase 0 + Bass Karaoke MVP ........................ DONE
    |
Phase 1: Core DAW Foundation ...................... DONE
    (waveform, recording, export, EQ, metronome, project CRUD)
    |
Phase 2: AI Intelligence Layer
    (4-stem ONNX, chord/key/BPM detection, adaptive difficulty)
    |
Phase 3: Multi-Instrument Performance ----> Phase 4: Social & Collaboration
    (tempo control, difficulty levels,       (multiplayer band scoring,
     drums, guitar, progress tracking)        leaderboards, community, profiles)
    |                                              |
Phase 5: AI Accompaniment & Pro DSP <--------------+
    (mastering, full effects, automation, composition)
    |
Phase 6: Native Clients & Mobile
    (iOS, Android, Tauri desktop, offline)
    |
Phase 7: Scale, Polish & Growth
    (subscriptions, licensing, i18n, a11y)
```

Phases 3 and 4 can proceed in parallel once Phase 2 stabilizes. Phase 5 depends on both. The web-first approach (mobile deferred to Phase 6) is a deliberate differentiator — no competitor in the practice platform space is web-first.

## Build vs Buy vs Integrate

| Capability | Decision | Rationale |
|---|---|---|
| Auth / SSO | Integrate (Janua) | Self-hosted, OAuth 2.0, workspace orgs built in |
| Audio DSP | Build (C++/WASM) | Latency requirements rule out JS; must own the pipeline |
| Stem Separation | Integrate (Demucs ONNX) | Research-grade model, run locally via ONNX Runtime |
| Pitch Detection | Integrate (Basic Pitch ONNX) | Spotify open-source, proven accuracy |
| Object Storage | Buy (Cloudflare R2) | S3-compatible, no egress fees, global edge |
| Database | Buy (PostgreSQL) | Proven, Drizzle ORM for type-safe queries |
| WebSockets | Integrate (Soketi) | Self-hosted Pusher protocol, runs on same K8s cluster |
| Deployment | Buy (Enclii + Hetzner) | Managed K8s with Cloudflare Tunnel ingress |
| UI Components | Build (Svelte) | Custom neon-noir design language, no off-the-shelf match |
| Note Highway | Build (Canvas/WebGL) | No existing library matches requirements |
| Time-stretching | Integrate (SoundTouch WASM) | Proven library, complex algorithm |
| Chord/key detection | Build (algorithmic) or Integrate (ONNX) | Chroma-based is simple; ML if higher accuracy needed |
| BPM detection | Build (onset detection) | Standard algorithm, no ML needed for basic version |
| Leaderboards | Build (PostgreSQL) | Simple aggregate queries + caching |
| Subscriptions | Integrate (Stripe) | Industry standard, no reason to build |

## Enclii Gaps

Items that Enclii does not handle and must be managed separately.

| Gap | Mitigation |
|---|---|
| Database provisioning | Provision PostgreSQL on Hetzner manually or via Terraform |
| R2 bucket + API keys | Configure via Cloudflare dashboard; inject as K8s secrets |
| Soketi deployment | Custom K8s manifest (`deploy/k8s/soketi.yaml`) |
| WASM binary hosting | Serve from SvelteKit static or R2 with CORP headers |
| COOP/COEP headers | Configured in `deploy/enclii.yaml` service headers |
| SSL certificates | Handled by Cloudflare Tunnel (no manual cert management) |
| CI/CD pipeline | GitHub Actions (build, test, push images, deploy via Enclii CLI) |
| Monitoring stack | Self-host Prometheus + Grafana on same cluster (Phase 7) |
