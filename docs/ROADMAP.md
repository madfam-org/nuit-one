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
| Object Storage | Cloudflare R2 | Audio stems, WASM binaries |
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

**Status: COMPLETE**

**Goal:** Upload a song, AI-separate stems, play back with bass muted, show notes, score performance.

#### Phase A -- Upload & Store
- Drag-and-drop upload zone with progress bar (UploadZone.svelte)
- R2 presigned URL upload flow (client → signed URL → R2 PUT → confirm)
- Track creation in DB with status tracking (pending_upload → uploaded)
- Dashboard with TrackList showing upload status via NeonBadge
- Server-side load functions for user's tracks

#### Phase B -- Stem Separation
- Demucs CLI wrapper (`--two-stems bass`) producing bass + no_bass stems
- In-memory job manager with status polling (3s interval)
- R2 upload/download for stems on API service
- SvelteKit → Hono API bridge routes for processing
- ProcessingStatus component with progress bar

#### Phase C -- Multi-Stem Playback
- StemPlayer class using Web Audio API (AudioBufferSourceNode + GainNode)
- Per-stem volume, mute, and solo controls (StemMixer.svelte)
- Transport bar with play/pause, seek, keyboard shortcuts (Space, arrows)
- COEP-safe audio proxy at `/api/audio/[...path]` for R2 content
- Svelte 5 reactive player store with rAF-based time updates
- Bass karaoke default: backing track at 100%, bass muted

#### Phase D -- Note Display & Scoring
- Basic Pitch CLI wrapper for bass stem transcription to NoteEvent[]
- Canvas-based scrolling note highway (NoteHighway.svelte)
- Real-time pitch detection via autocorrelation (PitchDetector class)
- Scoring engine with timing windows (25/50/100ms) and combo multipliers (1-4x)
- Performance mode page with countdown → play → results flow
- Results screen with grade (S/A/B/C/D/F), stats grid, accuracy

### Phase 1 -- Core Recording and Playback

**Goal:** Record a stem from hardware input and play it back against a backing track.

- WASM audio engine: gain, pan, metering, transport control
- Multitrack timeline view with waveform rendering
- Latency calibration wizard (audio round-trip, visual offset)
- Project CRUD and workspace-scoped API routes

### Phase 2 -- AI Stem Separation and Pitch Detection

**Goal:** Advanced AI features beyond the MVP bass karaoke flow.

- Demucs full 4-stem separation (vocals, drums, bass, other)
- ONNX Runtime in-browser inference (no server round-trip)
- Web Worker offloading for model execution
- MIDI data overlay on multitrack timeline

### Phase 3 -- Performance Mode (Gamified Recording)

**Goal:** Advanced performance features beyond the MVP scoring.

- WebGL note highway renderer (performance optimization)
- Multi-instrument support (guitar, keyboard, drums)
- Performance recording with automatic stem export
- Soketi integration for live collaboration presence

### Phase 4 -- Workspace Collaboration

**Goal:** Multi-user project management with role-based access and real-time updates.

- Workspace member management via Janua organizations
- Role-based UI gating (owner/admin/manager/member/viewer)
- Project progress dashboard (stems needed vs delivered)
- Real-time cursors and presence indicators via Soketi
- Commenting and review workflow on stems

### Phase 5 -- AI Accompaniment and Advanced DSP

**Goal:** Generative backing tracks and professional mixing tools.

- SongDriver ONNX model for tempo-tracking accompaniment
- Effects chain: EQ, compression, reverb (WASM DSP)
- Mix routing matrix
- Export to WAV/FLAC/MP3 with metadata

### Phase 6 -- Native Clients

**Goal:** Desktop and mobile apps with kernel-level audio drivers.

- JUCE or Superpowered SDK integration
- Shared C++ audio engine across web and native
- Platform-specific latency optimization
- Offline project sync

### Phase 7 -- Scale and Polish

**Goal:** Production hardening, observability, and growth features.

- Horizontal scaling for API and WebSocket tiers
- CDN edge caching for WASM and stem assets
- Prometheus + Grafana monitoring
- Error tracking (Sentry)
- Public artist profiles at nuit.one/slug

## Critical Path

```
Phase 0: WASM AudioWorklet passthrough .............. DONE
    |
Bass Karaoke MVP (A-D): Upload → Stems → Play → Score  DONE
    |
Phase 1: Advanced recording + playback
    |
Phase 2: Advanced AI (in-browser ONNX)
    |
Phase 3: Advanced performance -----> Phase 4: Collaboration (parallel)
    |                                       |
Phase 5: AI accompaniment + DSP <----------+
    |
Phase 6: Native clients
    |
Phase 7: Scale + polish
```

The Bass Karaoke MVP delivers a working end-to-end loop (upload → AI stem separation → playback → scoring) using server-side processing. Phases 1-3 extend this with in-browser inference, advanced recording, and multi-instrument support. Phases 3 and 4 can proceed in parallel once Phase 2 stabilizes.

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
