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
| AI Inference | ONNX Runtime (WASM/GPU) + server-side Python CLI | Basic Pitch, Demucs (server-side stem separation + transcription), SongDriver, client-side chord/key/BPM |
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

Nuit One sits at the intersection of **web-based DAWs** (BandLab, Soundtrap, Amped Studio, Audiotool, Soundation, Moises, Splice, Suno, Udio, AIVA, Soundful, Boomy) and **audiovisual practice/karaoke platforms** (Yousician, Rocksmith+, Simply Piano, Simply Guitar, Fender Play, Moises, Clone Hero, Smule, JamZone, Melodics, Playground Sessions, Skoove, flowkey, Guitar Pro, Songsterr, Ultimate Guitar). An audit of 31 platforms across both categories identified the baseline features users expect, where we stand, and where we differentiate.

### DAW Baseline Features

Features present in 5+ of 12 surveyed web DAWs. These are table stakes — users assume they exist.

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
| D16 | Cloud project storage + sync | 5/12 (BandLab, Soundtrap, Splice, Amped, Soundation) | Local only | Phase 2 |
| D17 | Real-time collaboration (multi-cursor) | 3/12 (BandLab, Soundtrap, Amped) | Not started | Phase 4 |
| D18 | Sample/loop browser | 5/12 (BandLab, Soundtrap, Splice, Audiotool, Soundation) | Not started | Phase 3 |
| D19 | AI text-to-music generation | 3/12 (Suno, Udio, Boomy) | Not started | Phase 5 |
| D20 | AI stem remix / style transfer | 2/12 (Udio, AIVA) | Not started | Phase 5 |
| D21 | One-click publish / distribution | 3/12 (BandLab, Boomy, Soundful) | Not started | Phase 7 |
| D22 | Social feed / discover page | 2/12 (BandLab, Soundation) | Not started | Phase 4 |
| D23 | Keyboard shortcut customization | 4/12 (BandLab, Amped, Audiotool, Soundation) | Not started | Phase 3 |

### Practice Platform Baseline Features

Features present in 5+ of 19 surveyed practice/karaoke platforms.

| ID | Feature | Competitors | Nuit One Status | Target Phase |
|----|---------|-------------|-----------------|--------------|
| P1 | AI stem separation | 3/7 (Moises, Yousician, Rocksmith+) | Done (Demucs 4-stem) | Phase 2 ✅ |
| P2 | Song library / catalog | 6/7 | Partial (user uploads only) | Phase 3 |
| P3 | Difficulty levels | 5/7 | Not started | Phase 3 |
| P4 | Mobile apps (iOS/Android) | 6/7 | Not started | Phase 6 |
| P5 | Tempo control / slow-down practice | 6/7 | Not started | Phase 3 |
| P6 | Real-time pitch/note detection | 5/7 | Done (all instruments) | Phase 3 ✅ |
| P7 | Scoring / grading | 5/7 | Done (all instruments) | Phase 3 ✅ |
| P8 | Multi-instrument support | 5/7 | Done (bass, vocals, drums, guitar/keys) | Phase 3 ✅ |
| P9 | Progress tracking / history | 6/7 | Not started (schema exists) | Phase 3 |
| P10 | Subscription model | 6/7 | Not started | Phase 7 |
| P11 | Guided lessons / curriculum | 8/19 (Yousician, Simply, Fender, Melodics, Playground, Skoove, flowkey) | Not started | Phase 3 |
| P12 | Tab / sheet music view | 6/19 (Guitar Pro, Songsterr, UG, Yousician, Rocksmith+, Fender) | Not started | Phase 3 |
| P13 | Section loop / riff repeater | 7/19 (Rocksmith+, Moises, JamZone, Guitar Pro, Songsterr, Yousician, Melodics) | Partial (A-B loop exists) | Phase 3 |
| P14 | Achievements / badges / streaks | 6/19 (Yousician, Melodics, Simply, Skoove, flowkey, Playground) | Not started | Phase 4 |
| P15 | Adaptive difficulty (auto-adjust) | 4/19 (Yousician, Rocksmith+, Melodics, Skoove) | Not started | Phase 3 |
| P16 | Backing track customization (stem mixing) | 5/19 (Moises, JamZone, Guitar Pro, Rocksmith+, Yousician) | Done (StemMixer) | Phase 1 ✅ |
| P17 | Chord chart / chord detection display | 4/19 (Moises, Guitar Pro, UG, Yousician) | Not started | Phase 2 |
| P18 | Setlist / playlist practice mode | 3/19 (Yousician, Melodics, Rocksmith+) | Not started | Phase 3 |

### Near-Baseline Features

Present in 3-4 competitors across either category. Worth having but not urgent.

| ID | Feature | Competitors | Target Phase |
|----|---------|-------------|--------------|
| N1 | Automation lanes | 5/12 DAWs | Phase 5 |
| N2 | AI composition / suggestion tools | 2/12 (BandLab, Soundtrap) | Phase 5 |
| N3 | Video sync | 2/19 practice platforms | Deferred |
| N4 | VST/plugin hosting | 3/12 DAWs | Deferred |
| N5 | Cloud sample/preset marketplace | 3/12 (Splice, BandLab, Soundation) | Phase 5 |
| N6 | In-app recording lessons / tutorials | 4/19 (Fender Play, Skoove, flowkey, Playground) | Phase 3 |
| N7 | Social duet / sing-along | 3/19 (Smule, Yousician, Rocksmith+) | Phase 4 |
| N8 | AI practice feedback / coaching | 3/19 (Yousician, Skoove, Melodics) | Phase 3 |

### Strategic Differentiators

Features that define Nuit One's unique position. No single competitor combines all of these.

| ID | Feature | Closest Competitor | Nuit One Status | Target Phase |
|----|---------|-------------------|-----------------|--------------|
| S1 | BYO-song stem separation + gamified scoring | Moises (stems, no scoring) | Done (all instruments) | Phase 3 ✅ |
| S2 | Multi-instrument pitch detection (bass, guitar, keys, drums) | Yousician (guitar/piano only) | Done | Phase 3 ✅ |
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
- One-command setup: `scripts/setup-dev.sh` (PostgreSQL, Python venv with numpy<2 + pre-built wheels, ffmpeg, yt-dlp, demucs, basic-pitch, drizzle-kit via tsx)
- Dev auth bypass: auto-session with deterministic UUIDs, no Janua required
- Local filesystem storage: `STORAGE_MODE=local` with absolute `LOCAL_STORAGE_PATH` (web + API run from different cwds)
- API uses `API_PORT` env var (not `PORT`) to avoid conflict with SvelteKit; dev script uses `--env-file=../../.env`
- YouTube import: paste URL → yt-dlp (`-f bestaudio --audio-quality 0`) → Demucs 4-stem → Basic Pitch (all stems, `--save-note-events`) → ready to play

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

### Phase 2 -- AI Intelligence Layer + Navigation Shell ✅

**Status: COMPLETE**

**Goal:** Move AI inference to the browser, expand from bass-only to full-spectrum music intelligence, and deliver the Spotify-inspired navigation architecture.

#### Navigation Shell
- App shell layout: collapsible sidebar + persistent bottom bar + content area
- Sidebar navigation: Dashboard, Library, Search (placeholder), Projects section, Settings
- Bottom "Now Playing" / Active Session bar: track info, transport, persists across routes
- Mobile responsive: bottom tab bar (<768px), icon-only sidebar (768–1023px), full sidebar (≥1024px)
- Route restructure: `/library` (track/project browser), `/studio/[projectId]` (DAW workspace), `/perform/[trackId]` (performance mode)
- New UI components: Sidebar, SidebarItem, SidebarSection, BottomBar, BottomTabs, IconButton, Avatar, Tooltip, Breadcrumb, TabBar
- Authenticated layout group `(app)` with user profile + recent projects loader

#### AI Intelligence
- Demucs full 4-stem separation (vocals, drums, bass, other)
- ONNX Runtime in-browser inference (no server round-trip)
- Web Worker offloading for model execution
- MIDI data overlay on multitrack timeline
- AI chord detection from audio (chroma features or ONNX model) — Moises + BandLab have this
- Chord chart / chord detection display on track page (P17)
- AI key detection (byproduct of chord detection)
- AI BPM detection via ML model (refines Phase 1's algorithmic version)
- Adaptive difficulty data model: tag notes by density/complexity tiers for Easy/Medium/Hard/Expert charts
- WebGPU acceleration backend for ONNX Runtime (Demucs is ~80 MB, needs GPU)
- Cloud project storage + sync to R2 with offline-first queue (D16)

### Phase 3 -- Multi-Instrument Karaoke Sprint ✅ (partial)

**Status: MULTI-INSTRUMENT KARAOKE COMPLETE — remaining items deferred**

**Goal:** Expand from bass-only karaoke to a full multi-instrument practice platform with tempo control, difficulty levels, and progress tracking.

#### Completed: Multi-Instrument Karaoke (4 slices, 448 tests)
- Highest-quality YouTube download: yt-dlp with `-f bestaudio --audio-quality 0` flags
- All-stem Basic Pitch transcription: runs on all 4 stems (vocals, drums, bass, other), not just bass
- Instrument configuration constants: `PLAYABLE_INSTRUMENTS`, frequency/MIDI ranges, labels, neon colors
- Parameterized PitchDetector: constructor accepts `minFrequency`, `maxFrequency`, `deviceId` options
- Parameterized NoteHighway: `minPitch`/`maxPitch` props (backward-compatible defaults)
- Instrument selector UI on perform page: shows only instruments with valid note data
- Generic stem muting: removed `bassKaraokeMode`, callers use `toggleMute()` explicitly
- Fixed latent `no_bass` bug: perform page no longer requires `no_bass` stem
- Multi-player support: up to 4 players per session, each with own instrument, mic, PitchDetector, ScoringEngine
- Device selection: `getAudioInputDevices()` via `enumerateDevices()` for multi-mic input
- PlayerSlot component: per-player instrument + device picker with Nuit Glass styling
- Multi-player results: per-player grades, scores, and stats; independent performance saves (P8 ✅, S2 ✅)

#### Remaining (deferred to future sprints)
- WebGL note highway renderer (performance optimization)
- Performance recording with automatic stem export
- Practice mode with tempo control / time-stretching without pitch shift (P5 — SoundTouch WASM)
- A-B loop markers for section practice (P5 — Rocksmith+ Riff Repeater, Moises)
- Enhanced section loop / riff repeater with auto-speed-up on mastery (P13)
- Progressive difficulty levels: Easy/Medium/Hard/Expert note charts from Phase 2 AI data (P3)
- Adaptive difficulty: auto-adjust note density based on real-time accuracy (P15)
- Drum scoring via onset detection for percussive input (S5 — no competitor does this for real kits)
- Web MIDI API for MIDI keyboards
- Tab / sheet music view: guitar tablature and standard notation rendering (P12)
- Song library browser: searchable/filterable view with BPM, key, difficulty metadata (P2)
- Sample/loop browser for DAW workspace (D18)
- Guided lessons / curriculum: structured practice paths per instrument (P11)
- Setlist / playlist practice mode: queue songs for continuous practice sessions (P18)
- Global search page: search tracks, songs, projects, community content (`/search`)
- Keyboard shortcut customization panel (D23)
- AI practice feedback / coaching hints (N8)

### Phase 4 -- Social & Collaboration

**Goal:** Multi-user project management, real-time multiplayer performance, and community features.

- Workspace member management via Janua organizations
- Role-based UI gating (owner/admin/manager/member/viewer)
- Project progress dashboard (stems needed vs delivered)
- Real-time cursors and presence indicators via Soketi (moved from Phase 3)
- Real-time collaboration with multi-cursor editing in DAW workspace (D17)
- Commenting and review workflow on stems
- Real-time multiplayer band scoring via Soketi: multiple players, per-instrument scores, combined band score (S3)
- Leaderboards: per-song, per-instrument, global + workspace-scoped
- Social sharing: performance result cards for social media
- Social feed / discover page: browse trending tracks, followed artists, community activity (D22)
- Community song library: publish processed songs with stems + note charts for others to play (S6)
- Friend system / follow other musicians
- Achievements / badges / streaks: practice milestones, performance grades, daily streaks (P14)
- Weekly challenges / competitions on specific songs
- Public artist profiles at `nuit.one/slug` (moved from Phase 7 — growth feature, not polish)

### Phase 5 -- AI Accompaniment and Advanced DSP

**Goal:** Generative backing tracks, professional mixing tools, AI-assisted mastering, and AI music generation.

- SongDriver ONNX model for tempo-tracking accompaniment
- Full WASM DSP effects chain: compression, delay, chorus, distortion, limiter (D13 — basic EQ + reverb are Phase 1)
- Mix routing matrix
- Multi-format export: FLAC, multi-track stem export, metadata embedding (D14 — basic WAV/MP3 is Phase 1)
- AI mastering: one-click loudness normalization, EQ curve, limiting (D12 — BandLab offers free, LANDR/Moises paid)
- Automation lanes: parameter automation on timeline (D15)
- AI composition tools: extend/recompose suggestions (N2 — BandLab differentiator)
- AI text-to-music generation: prompt-based track creation (D19 — Suno, Udio, Boomy have this)
- AI stem remix / style transfer: re-style existing stems via ML models (D20 — Udio, AIVA)

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
- One-click publish / distribution to streaming platforms (D21 — BandLab, Boomy, Soundful)
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
| D16 | Cloud project storage + sync | 2 | Partial (R2 storage, no offline sync) |
| D17 | Real-time collaboration | 4 | Not started |
| D18 | Sample/loop browser | 3 | Not started |
| D19 | AI text-to-music generation | 5 | Not started |
| D20 | AI stem remix / style transfer | 5 | Not started |
| D21 | One-click publish / distribution | 7 | Not started |
| D22 | Social feed / discover page | 4 | Not started |
| D23 | Keyboard shortcut customization | 3 | Not started |

### Practice Platform Baseline Coverage

| ID | Feature | Phase | Status |
|----|---------|-------|--------|
| P1 | AI stem separation | MVP | Done (4-stem) |
| P2 | Song library / catalog | 3 | Partial |
| P3 | Difficulty levels | 3 | Not started |
| P4 | Mobile apps | 6 | Not started |
| P5 | Tempo control / slow-down | 3 | Not started |
| P6 | Real-time pitch detection | Phase 3 | Done (all instruments) |
| P7 | Scoring / grading | Phase 3 | Done (all instruments) |
| P8 | Multi-instrument support | 3 | Done |
| P9 | Progress tracking | 1 | Done (score history + trend chart) |
| P10 | Subscription model | 7 | Not started |
| P11 | Guided lessons / curriculum | 3 | Not started |
| P12 | Tab / sheet music view | 3 | Not started |
| P13 | Section loop / riff repeater | 3 | Partial (A-B loop) |
| P14 | Achievements / badges / streaks | 4 | Not started |
| P15 | Adaptive difficulty | 3 | Not started |
| P16 | Backing track customization | 1 | Done |
| P17 | Chord chart / chord detection | 2 | Done |
| P18 | Setlist / playlist practice mode | 3 | Not started |

### Strategic Differentiator Coverage

| ID | Feature | Phase | Status |
|----|---------|-------|--------|
| S1 | BYO-song stems + gamified scoring | MVP | Done (all instruments) |
| S2 | Multi-instrument pitch detection | 3 | Done (bass, vocals, drums, guitar/keys) |
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
Phase 2: AI Intelligence + Navigation Shell ....... DONE
    (sidebar + bottom bar, 4-stem Demucs,
     chord/key/BPM detection, chord display, analysis panel)
    |
Phase 3: Multi-Instrument Karaoke Sprint .......... DONE (core)
    (multi-instrument pitch detection, multi-player,
     device selection, instrument selector, all-stem transcription)
    |
Phase 3 remaining + Phase 4 (parallel) ............ NOT STARTED
    Phase 3 rest: tempo control, difficulty levels,
     tabs, search, sample browser, lessons
    Phase 4: multiplayer band scoring, collab,
     leaderboards, community, profiles, achievements
    |
Phase 5: AI Accompaniment & Pro DSP
    (mastering, full effects, automation,
     AI text-to-music, stem remix, composition)
    |
Phase 6: Native Clients & Mobile
    (iOS, Android, Tauri desktop, offline)
    |
Phase 7: Scale, Polish & Growth
    (subscriptions, licensing, publish/distribution, i18n, a11y)
```

Phase 3 remaining items and Phase 4 can proceed in parallel. Phase 5 depends on both. The web-first approach (mobile deferred to Phase 6) is a deliberate differentiator — no competitor in the practice platform space is web-first.

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
| API Python/AI runtime | Handled in `apps/api/Dockerfile` — Python 3, ffmpeg, demucs, basic-pitch, yt-dlp installed; htdemucs model pre-downloaded at build time |
| API resource sizing | API pod requires 2000m CPU + 3Gi memory for Demucs stem separation (configured in `deploy/enclii.yaml`) |
| SSL certificates | Handled by Cloudflare Tunnel (no manual cert management) |
| CI/CD pipeline | GitHub Actions (build, test, push images, deploy via Enclii CLI) |
| Monitoring stack | Self-host Prometheus + Grafana on same cluster (Phase 7) |

## UX Architecture

### Design Principles

1. **Spotify Familiarity**: Left sidebar + bottom now-playing bar + content area — the layout billions of users already know
2. **Three-Mode Architecture**: Library, Studio, Performance — each mode has its own context but shares the app shell
3. **Progressive Disclosure**: Simple surface, deep features available on demand
4. **Nuit Glass Design Language**: All new components follow neon-noir aesthetic with liquid glass surfaces

### Spotify Metaphor Mapping

| Spotify Concept | Nuit One Equivalent | Route |
|----------------|---------------------|-------|
| Home | Dashboard (recent + recommended) | `/dashboard` |
| Your Library | Track & Project Library | `/library` |
| Search | Search tracks, songs, community | `/search` |
| Now Playing bar | Active Session bar (playback/recording/performance) | (persistent bottom bar) |
| Album/Playlist page | Project detail / Track detail | `/projects/[id]`, `/tracks/[id]` |
| Play button on album | "Open in Studio" / "Play Mode" | `/studio/[projectId]`, `/perform/[trackId]` |

### App Shell Layout

```
+--sidebar--+------------------content------------------+
|            |                                           |
| [logo]     |   <page content here>                    |
| Dashboard  |                                           |
| Library    |                                           |
| Search     |                                           |
|            |                                           |
| ---------- |                                           |
| Projects   |                                           |
|  Project A |                                           |
|  Project B |                                           |
| ---------- |                                           |
| Settings   |                                           |
|            |                                           |
+------------+-------------------------------------------+
|        [now-playing / active session bar]              |
+-------------------------------------------------------+
```

### Sidebar Behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1024px) | Always visible, 240px wide, collapsible to 64px icon-only |
| Tablet (768–1023px) | Icon-only (64px) by default, expandable on hover/click |
| Mobile (<768px) | Hidden; replaced by bottom tab bar (`BottomTabs.svelte`) |

**Sections**: Navigation (Dashboard, Library, Search), Projects (pinned/recent), Settings

### Bottom "Now Playing" Bar

- Shows when any audio session is active (playback, recording, or performance)
- Displays: track title, artist, playback progress, play/pause, volume
- Click expands to full transport controls
- During performance mode: shows score, combo, accuracy in real-time
- Persists across route navigation (audio doesn't stop when switching pages)
- Height: 64px collapsed, expands to ~120px for full transport

### Route Architecture

| Current Route | New Route | Rationale |
|---------------|-----------|-----------|
| `/dashboard` | `/dashboard` (keep) | Home/landing stays |
| (none) | `/library` | Spotify "Your Library" pattern |
| `/tracks/[id]` | `/tracks/[id]` (keep) | Track detail page |
| `/tracks/[id]/play` | `/perform/[trackId]` | Performance mode gets top-level route |
| `/tracks/[id]/stats` | `/tracks/[id]/stats` (keep) | Stats stays nested |
| `/projects/[id]` | `/studio/[projectId]` | DAW workspace = "Studio" mode |
| (none) | `/search` | Global search page |

### New UI Components (Phase 2)

| Component | Description |
|-----------|-------------|
| `Sidebar.svelte` | Collapsible sidebar container with responsive breakpoints |
| `SidebarItem.svelte` | Navigation link with icon + label + active state |
| `SidebarSection.svelte` | Grouped sidebar section with collapsible header |
| `BottomBar.svelte` | Persistent now-playing / active session bar |
| `BottomTabs.svelte` | Mobile tab bar replacement for sidebar |
| `IconButton.svelte` | Compact icon-only button for sidebar and transport |
| `Avatar.svelte` | User avatar with optional presence indicator |
| `Tooltip.svelte` | Hover tooltip for icon-only sidebar mode |
| `Breadcrumb.svelte` | Context breadcrumb (Library > Project > Track) |
| `TabBar.svelte` | Horizontal tab switcher for sub-views |

### Additional UI Components (Phase 3)

| Component | Description |
|-----------|-------------|
| `SearchBar.svelte` | Global search input with results dropdown and filters |

### Layout File Changes

| File | Change |
|------|--------|
| `routes/+layout.svelte` | Add app shell (sidebar + bottom bar + content slot) |
| `routes/(app)/+layout.svelte` | Authenticated layout with sidebar state management |
| `routes/(app)/+layout.server.ts` | Load user profile + recent projects for sidebar |
