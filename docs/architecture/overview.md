# Nuit One -- Technical Architecture Overview

## System Diagram

```
                         nuit.one (Cloudflare Tunnel)
                                   |
                     +-------------+-------------+
                     |                           |
               nuit-one-web:3000          nuit-one-api:3001
               (SvelteKit SSR)             (Hono REST)
                     |                           |
                     +-------+---+-------+-------+
                             |   |       |
                   +---------+   |   +---+----------+
                   |             |   |               |
              Janua SSO     PostgreSQL          Cloudflare R2
           (OAuth 2.0 +     (Drizzle)        (S3-compat stems)
            JWKS JWT)            |
                                 |
                          +------+------+
                          |             |
                       Soketi       ONNX Runtime
                    (WebSocket)    (AI inference)
```

### Component Responsibilities

| Component | Role |
|---|---|
| **nuit-one-web** | SvelteKit app. SSR for initial load, SPA for workspace navigation. Serves WASM binaries and AudioWorklet scripts from `/static`. Handles OAuth callback and session cookies. |
| **nuit-one-api** | Hono REST API. Validates JWTs against Janua JWKS endpoint. Manages projects, tracks, stems. Generates R2 presigned URLs for direct browser uploads. Runs server-side AI processing: Demucs 4-stem separation, Basic Pitch transcription on all stems, and yt-dlp YouTube audio download. Production container includes Python 3, ffmpeg, and pre-downloaded htdemucs model (~2.5GB). |
| **Janua SSO** | Self-hosted OAuth 2.0 / OpenID Connect provider. Manages user identities, workspace organizations, and role assignments. Publishes JWKS for stateless JWT verification. |
| **PostgreSQL** | Primary data store. Schema managed by Drizzle ORM with migration files in `packages/db/src/migrations/`. Tables: projects, tracks, stems, performances, calibration_profiles. |
| **Cloudflare R2** | Object storage for audio stems, WASM binaries, and exported mixes. S3-compatible API. No egress fees. Browser uploads via presigned PUT URLs. In local dev mode (`STORAGE_MODE=local`), a filesystem adapter stores files under `./storage/` instead. |
| **Soketi** | Self-hosted Pusher-compatible WebSocket server. Powers real-time collaboration: presence, cursor sync, stem delivery notifications (Phase 4+). |
| **ONNX Runtime** | Runs AI models (Demucs, Basic Pitch, SongDriver) locally in the browser via WASM or WebGPU backends. No server round-trips during live performance. |

## Authentication Flow

Nuit One delegates all identity management to Janua, a self-hosted OAuth 2.0 / OpenID Connect provider. The flow uses the Authorization Code grant with PKCE.

```
Browser                    SvelteKit                  Janua SSO
   |                          |                          |
   |-- Click "Sign in" ------>|                          |
   |                          |-- 302 Redirect --------->|
   |                          |   /authorize?            |
   |                          |   client_id=nuit-one&    |
   |                          |   redirect_uri=          |
   |                          |   /auth/callback&        |
   |                          |   code_challenge=...     |
   |                          |                          |
   |<-- Janua login page -----|<-------------------------|
   |                          |                          |
   |-- User authenticates --->|                          |
   |                          |                          |
   |<-- 302 /auth/callback?code=xxx --------------------|
   |                          |                          |
   |-- GET /auth/callback --->|                          |
   |                          |-- POST /token ---------->|
   |                          |   code + code_verifier   |
   |                          |                          |
   |                          |<-- access_token (JWT) ---|
   |                          |    + refresh_token       |
   |                          |    + id_token            |
   |                          |                          |
   |<-- Set session cookie ---|                          |
   |    (httpOnly, secure)    |                          |
   |                          |                          |
   |-- API request ---------->|                          |
   |   Cookie: session=...    |-- Bearer JWT ----------->|
   |                          |   (to nuit-one-api)      |
   |                          |                          |
   |                          |   API validates JWT      |
   |                          |   against Janua JWKS     |
   |                          |   (cached at             |
   |                          |   /.well-known/jwks.json)|
```

### JWT Claims

The access token JWT issued by Janua contains:

| Claim | Purpose |
|---|---|
| `sub` | User ID (UUID) |
| `org_id` | Active workspace/organization ID |
| `iss` | Janua issuer URL (used for JWKS lookup) |
| `exp` | Token expiration timestamp |
| `roles` | Array of workspace roles for the user |

The API middleware (`apps/api/src/middleware/auth.ts`) verifies the JWT signature against the Janua JWKS endpoint, extracts `sub` and `org_id`, and attaches them to the Hono request context as the `auth` variable.

### Dev Auth Bypass

When `NODE_ENV !== 'production'`, both the API and SvelteKit skip JWT/session validation entirely:

- **API**: The `jwtAuth` middleware injects deterministic dev user/workspace UUIDs without requiring a Bearer token.
- **SvelteKit**: The `auth` hook auto-sets a session cookie and injects the same dev UUIDs into `event.locals`.

Dev UUIDs (consistent across both services):
- `DEV_USER_ID = '00000000-0000-0000-0000-000000000001'`
- `DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002'`

These are valid UUID v4 strings, required because the PostgreSQL schema uses `uuid()` column types.

### Public Routes

The SvelteKit auth hook exempts specific paths from authentication. The landing page (`/`) uses an exact match (`pathname === '/'`) rather than `startsWith('/')` to avoid accidentally exempting all routes. Auth-related prefixes (`/auth/login`, `/auth/callback`) use `startsWith` matching.

## Audio Data Flow

The audio pipeline bypasses the JavaScript main thread entirely. All DSP runs in a C++/WASM module inside an AudioWorklet thread, communicating with the main thread through a lock-free ring buffer backed by `SharedArrayBuffer`.

```
Hardware Mic/Interface
        |
        v
  getUserMedia()
  (Main Thread)
        |
        v
  AudioContext
        |
  connect()
        |
        v
+---------------------------+
| AudioWorklet Thread       |
|                           |
|  NuitAudioProcessor       |
|    |                      |
|    v                      |
|  WASM Module              |
|  (audio_processor.cpp)    |
|    |                      |
|    +-- process(inputs) -->+-- Ring Buffer -----> Main Thread
|    |   gain, pan, meter   |   (SharedArray      (waveform,
|    |                      |    Buffer)            metering,
|    +-- outputs[] -------->+                       recording)
|                           |
+---------------------------+
        |
        v
  AudioContext destination
  (speakers/headphones)
```

### Key Constraints

**SharedArrayBuffer requirement.** The ring buffer uses `SharedArrayBuffer` for zero-copy data transfer between the AudioWorklet thread and the main thread. This requires the following HTTP headers on every page that loads the audio engine:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These are configured in `deploy/enclii.yaml` under the `web` service `headers` section.

**Lock-free design.** The ring buffer (`packages/audio-engine/src/ring_buffer.cpp`) uses atomic read/write indices. No mutexes or locks are used in the real-time audio path. The AudioWorklet `process()` callback must never block.

**128-frame quantum.** The Web Audio API calls `process()` with exactly 128 frames per invocation at the system sample rate (typically 44100 or 48000 Hz). The WASM module must complete processing within this time budget (~2.9ms at 44100 Hz) or audio glitches will occur.

## Workspace Authorization Pattern

Workspaces map to Janua "organizations." Each user can belong to multiple workspaces with different roles. The authorization model is enforced at two levels.

### Level 1: API Route Authorization

The API middleware extracts `org_id` from the JWT and scopes all database queries to that workspace. A user cannot access resources belonging to a workspace they are not a member of, because the JWT itself is scoped.

```
Request -> JWT validation -> Extract org_id -> Scope DB queries to org_id
```

### Level 2: Role-Based UI Gating

Within a workspace, permissions are tiered:

| Role | Capabilities |
|---|---|
| **owner** | Full control. Manage members, billing, delete workspace. |
| **admin** | Manage projects, tracks, members (except owner). Full DAW editing. |
| **manager** | Create/edit projects and tracks. Assign stems. Cannot manage members. |
| **member** | Record stems, submit performances. View assigned tracks. |
| **viewer** | Read-only access. Listen to stems, view project progress. |

The SvelteKit frontend reads the role from the session and conditionally renders UI controls. The API enforces the same role checks server-side before executing mutations.

### Workspace Switching

The SvelteKit frontend presents a workspace switcher in the sidebar. Selecting a different workspace triggers a re-authentication flow against Janua with the new `org_id`, producing a fresh JWT scoped to that workspace. This ensures complete data isolation between workspaces without client-side filtering.

## DAW Workspace Audio Architecture (Phase 1)

The DAW workspace at `/projects/[id]` provides a multitrack timeline with per-stem audio controls. The signal chain is built from standard Web Audio API nodes, avoiding the WASM AudioWorklet (which is reserved for future real-time DSP).

### Signal Chain per Stem

```
AudioBufferSourceNode
        |
  BiquadFilterNode (lowshelf, 200 Hz)
        |
  BiquadFilterNode (peaking, 1 kHz, Q=1)
        |
  BiquadFilterNode (highshelf, 4 kHz)
        |
     GainNode (volume)
        |
  StereoPannerNode (pan -1..1)
        |
        +----> AudioContext.destination (dry path)
        |
        +----> GainNode (reverb send, 0..1)
                   |
              ConvolverNode (shared IR: room/hall/plate)
                   |
              GainNode (reverb master)
                   |
              AudioContext.destination (wet path)
```

All parameters default to neutral (EQ 0 dB, pan center, reverb 0%) for backward compatibility with the bass karaoke playback path.

### Undo/Redo

The command pattern (`CommandStack` + 6 `Command` implementations) tracks parameter changes:
- `VolumeChangeCommand`, `PanChangeCommand`, `MuteToggleCommand`, `SoloCommand`, `EqChangeCommand`, `ReverbChangeCommand`
- Stack max size: 100. Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z.

### Recording Flow

```
Browser                                     SvelteKit
  |                                            |
  |  getUserMedia() → MediaStream              |
  |  MediaStreamSource → AnalyserNode (metering)
  |  MediaRecorder → Blob (webm/opus or mp4/aac)
  |                                            |
  |  On stop:                                  |
  |  decodeAudioData(blob) → AudioBuffer       |
  |  encodeWav(AudioBuffer) → WAV Blob         |
  |  (consistent format regardless of browser) |
```

### Export Flow

```
OfflineAudioContext (2 channels, project duration)
  |
  For each non-muted stem:
    BufferSource → Gain(volume) → StereoPanner(pan) → destination
  |
  startRendering() → rendered AudioBuffer
  |
  ├── WAV: encodeWav(rendered) → Blob (audio/wav)
  └── MP3: lamejs.Mp3Encoder → Blob (audio/mp3)
       (lamejs loaded lazily via dynamic import)
```

### Metronome

Uses the "look-ahead scheduler" pattern: a `setInterval` callback schedules `OscillatorNode` clicks ahead of time using Web Audio's precise timing. Beat 1 plays 880 Hz sine; other beats play 440 Hz sine. Each click is a 10ms burst with exponential gain ramp-down.

### BPM Detection

Pure function: `detectBPM(AudioBuffer): number`
1. Downsample to mono at ~11 kHz
2. Compute energy per 20ms frame (onset envelope)
3. Half-wave rectify first derivative (onset strength)
4. Autocorrelate in frame domain (lags for 60-200 BPM range)
5. Peak lag → BPM conversion

## Multi-Instrument Karaoke Data Flow

The karaoke system uses server-side AI processing (Demucs 4-stem separation, Basic Pitch transcription on all stems) for track preparation, and client-side Web Audio API for real-time playback and scoring. Up to 4 players can perform simultaneously, each on a different instrument with their own microphone, PitchDetector, and ScoringEngine.

```
Upload Flow:
  Browser                  SvelteKit                 Storage / DB
    |                          |                        |
    |-- POST /api/upload ----->|                        |
    |   {filename, type, size} |-- Create track row --->|
    |                          |-- getUploadUrl() ----->|
    |<-- {trackId, uploadUrl} -|                        |
    |                          |                        |
    |-- PUT uploadUrl -------->|  (R2 signed URL or /api/storage/upload)
    |                          |                        |
    |-- POST /api/upload/confirm ->|                    |
    |                          |-- status='uploaded' -->|

Stem Separation Flow:
  SvelteKit                  Hono API                 R2 / DB
    |                          |                        |
    |-- POST /api/process ---->|                        |
    |   {trackId}              |-- Download original -->|
    |                          |-- demucs htdemucs (4-stem)
    |                          |-- Upload vocals.wav -->|
    |                          |-- Upload drums.wav --->|
    |                          |-- Upload bass.wav ---->|
    |                          |-- Upload other.wav --->|
    |                          |-- Create stems rows -->|
    |                          |-- Basic Pitch on ALL stems
    |                          |-- Store midiData per stem
    |<-- {jobId} --------------|                        |
    |                          |                        |
    |-- GET /api/process/:id ->|  (poll every 3s)      |
    |<-- {status, progress} ---|                        |

Playback Flow (COEP-safe):
  Browser                  SvelteKit                 R2
    |                          |                      |
    |-- GET /api/audio/... --->|                      |
    |                          |-- getDownloadUrl() ->|
    |                          |<-- signed URL -------|
    |                          |-- fetch(signed URL) ->|
    |                          |<-- audio data --------|
    |<-- audio + CORP headers -|                      |
    |                          |                      |
    |  AudioContext.decodeAudioData()                  |
    |  AudioBufferSourceNode per stem                  |
    |  GainNode per stem (volume/mute/solo)           |
    |  → destination (speakers)                        |

Multi-Player Performance Scoring Flow:
  Browser (all client-side)
    |
    |  Instrument selector: player picks from available instruments
    |    (only stems with valid midiData shown)
    |  Device selector: player picks audio input device
    |    (getAudioInputDevices() via enumerateDevices)
    |
    |  Per player (up to 4 concurrent):
    |    StemPlayer: mute the instrument being played
    |    NoteHighway: canvas render with instrument-specific MIDI range
    |      (bass: 28-72, vocals: 36-84, drums: 35-81, other: 21-108)
    |    PitchDetector: getUserMedia({deviceId}) → autocorrelation
    |      (instrument-specific freq range: bass 30-500Hz, vocals 80-1100Hz, etc.)
    |    ScoringEngine: compare detected pitch vs stem's NoteEvent[]
    |      → HIT_WINDOWS: perfect 25ms, great 50ms, good 100ms
    |      → Combo multiplier: 1x/2x/3x/4x
    |
    |  Results: per-player grade (S/A/B/C/D/F), accuracy %, score
    |  Performance save: fire-and-forget POST per player with stemId
```

### COEP Audio Proxy

Strict COEP (`require-corp`) blocks cross-origin fetches to R2 signed URLs. The SvelteKit server route at `/api/audio/[...path]` acts as a same-origin proxy: it fetches audio from R2 server-side and serves it to the browser with `Cross-Origin-Resource-Policy: same-origin` headers. This allows the audio to load without relaxing COEP.

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **C++/WASM for audio DSP** | JavaScript cannot guarantee real-time audio processing. The AudioWorklet + WASM path bypasses GC pauses and JIT deoptimizations. The same C++ core can be reused in native desktop/mobile clients (Phase 6). |
| **Janua over Auth0/Clerk** | Self-hosted. No per-user pricing. Full control over organization/workspace modeling. OAuth 2.0 + JWKS is a standard the API can validate statelessly. |
| **Drizzle ORM over Prisma** | Drizzle generates no client library, produces standard SQL, and supports the postgres.js driver. Smaller bundle, faster cold starts, full TypeScript inference. |
| **Cloudflare R2 over S3** | Zero egress fees. Critical for a platform where users frequently download large audio files. S3-compatible API means no code changes if we migrate later. |
| **Hono over Express/Fastify** | Tiny runtime footprint. Works on Node, Deno, Bun, and Cloudflare Workers without modification. Built-in middleware for CORS, JWT, logger. |
| **SvelteKit over Next.js** | Svelte compiles to vanilla JS with no virtual DOM overhead. Smaller client bundles matter for a WASM-heavy app where every kilobyte of JS competes with the audio engine for parse time. Server-side rendering for SEO on public pages. |
| **Soketi over managed Pusher** | Self-hosted on the same Hetzner cluster. No message-volume pricing. Pusher client libraries work unchanged. Can scale horizontally with Redis adapter if needed. |
| **ONNX Runtime in browser** | AI inference on the user's device avoids network latency during live performance. Models load once and run at near-native speed via WASM/WebGPU backends. Server-side fallback available for devices without sufficient compute. |
| **Server-side AI for processing** | Track preparation (Demucs 4-stem separation, Basic Pitch transcription on all stems) runs server-side via CLI subprocesses. Client-side AI (chord/key/BPM detection, difficulty analysis) runs in Web Workers. In-browser ONNX inference for stem separation is a future optimization. |
| **Web Audio API for playback** | Stem playback uses `AudioBufferSourceNode` + `GainNode` + `BiquadFilterNode` + `StereoPannerNode` + `ConvolverNode` rather than the WASM AudioWorklet. Synchronized buffer playback with gain/EQ/pan/reverb does not need sample-level DSP. The AudioWorklet pipeline is reserved for future real-time DSP requiring sub-sample precision. |
| **Command pattern for undo** | Simple, serializable command objects with `execute()`/`undo()` methods. Avoids state snapshots (which would be expensive for audio buffers). Stack max 100 to bound memory. |
| **lamejs for MP3 export** | ~100KB minified, loaded lazily only on MP3 export. Avoids server round-trip for encoding. WAV export uses a custom encoder (56 lines) with no dependencies. |
| **Frame-domain BPM detection** | Onset envelope autocorrelation uses frame-rate lags (not sample-rate), making the algorithm work correctly across all sample rates and buffer sizes. Energy-based approach works for rhythmic music; ML refinement planned for Phase 2. |
| **Dual-mode storage** | A unified storage adapter (`apps/api/src/lib/storage.ts`, `apps/web/src/lib/server/storage.ts`) delegates to local filesystem or Cloudflare R2 based on `STORAGE_MODE` env var. This eliminates the R2 dependency for local development. |
| **Monorepo with Turborepo** | Shared types (`packages/shared`) prevent API/frontend drift. Single `pnpm install`. Turborepo caches builds across packages. CI runs only affected packages on each push. |

## YouTube Import Flow

The dashboard supports importing songs directly from YouTube URLs. The pipeline downloads audio via `yt-dlp`, then runs the full Demucs + Basic Pitch processing chain.

```
YouTube Import Flow:
  Browser                  SvelteKit                  Hono API
    |                          |                          |
    |-- POST /api/import/youtube ->|                      |
    |   {url}                  |-- POST /api/import/youtube ->|
    |                          |                          |-- yt-dlp -f bestaudio
    |                          |                          |   --audio-quality 0
    |                          |<-- {jobId} --------------|
    |<-- {jobId} --------------|                          |
    |                          |                          |-- create project/track
    |-- GET /api/process/:id ->|  (poll every 3s)        |-- upload to storage
    |                          |-- GET /api/stems/jobs/:id ->|-- demucs htdemucs (4-stem)
    |<-- {status, progress} ---|<-- job status ------------|-- basic-pitch ALL stems
    |                          |                          |-- mark track ready
```

Requirements: `yt-dlp` and `ffmpeg` must be on PATH. Basic Pitch is invoked with `--save-note-events` to produce CSV output; the CSV uses `start_time_s,end_time_s` columns (duration is computed as `endTime - startTime`). Each stem is transcribed independently with per-stem error handling (non-fatal).

In local dev, the setup script installs both via Homebrew and creates a Python venv with compatible dependency pins. In production, the API Dockerfile installs Python 3, ffmpeg, demucs, basic-pitch, and yt-dlp directly, and pre-downloads the htdemucs model at build time.

## Multi-Player Performance Architecture (Phase 3)

The perform page at `/perform/[trackId]` supports up to 4 simultaneous players, each on a different instrument. The architecture is entirely client-side — no server coordination needed for local multi-player.

### Instrument Configuration

Instrument constants are centralized in `packages/shared/src/constants.ts`:

| Instrument | Freq Range (Hz) | MIDI Range | Neon Color |
|-----------|----------------|-----------|------------|
| Bass | 30-500 | 28-72 (E1-C5) | `#8b5cf6` (violet) |
| Vocals | 80-1100 | 36-84 (C2-C6) | `#00f5ff` (cyan) |
| Drums | 60-500 | 35-81 (B1-A5) | `#f59e0b` (amber) |
| Guitar/Keys | 27-4200 | 21-108 (A0-C8) | `#00ff88` (green) |

### Multi-Player State

Each player has an independent `PlayerConfig` containing:
- **Instrument selection**: one of `PLAYABLE_INSTRUMENTS`, unique per player
- **Device selection**: `deviceId` from `getAudioInputDevices()` for multi-mic setups
- **PitchDetector**: parameterized with instrument-specific frequency range and device constraint
- **ScoringEngine**: initialized with the selected stem's `NoteEvent[]`
- **Score state**: score, combo, accuracy, recentJudgments — all independent per player

### Stem Muting

When the game starts, all instruments being played are muted from the backing track via `player.toggleMute(instrument)`. This allows each player to hear the full mix minus their part.

### Device Selection

`getAudioInputDevices()` requests temporary mic access to enumerate device labels (browser requirement), then immediately releases the stream. Each player can select a different audio input, enabling scenarios like one player on built-in mic and another on a USB audio interface.

## Local Development Setup

A one-command setup script provisions the full dev environment:

```bash
chmod +x scripts/setup-dev.sh && ./scripts/setup-dev.sh
```

This script:
1. Installs `ffmpeg` and `yt-dlp` via Homebrew
2. Creates a Python venv at `.venv/` with upgraded pip/setuptools, `numpy<2` (PyTorch 2.2 compat), pre-built `llvmlite`/`numba` wheels, `demucs`, and `basic-pitch`
3. Starts PostgreSQL and creates the `nuitone` database
4. Creates `.env` from `.env.example` with local dev overrides (absolute `LOCAL_STORAGE_PATH`)
5. Runs `pnpm install` and pushes DB schema via `tsx`-wrapped `drizzle-kit`

Key env vars for local dev:
- `NODE_ENV=development` — enables auth bypass
- `STORAGE_MODE=local` — uses filesystem storage instead of R2
- `LOCAL_STORAGE_PATH=/absolute/path/to/storage` — must be absolute because the web app and API run from different working directories
- `API_PORT=3001` — API server port (avoids conflict with SvelteKit's `PORT=3000`)

The API dev script (`apps/api/package.json`) uses `--env-file=../../.env` with tsx to load the monorepo root `.env`, and prepends `.venv/bin` to PATH so that `demucs` and `basic-pitch` CLI tools are found when spawned as subprocesses.

## Production Deployment

The API service runs in a Docker container (`apps/api/Dockerfile`) that includes both Node.js and the Python AI toolchain. The Dockerfile uses a multi-stage build:

1. **Build stage** (`node:22-slim`): Compiles TypeScript to JavaScript via Turborepo.
2. **Runtime stage** (`node:22-slim` + Python 3): Installs Python 3, pip, ffmpeg, demucs, basic-pitch, and yt-dlp. Pre-downloads the htdemucs model (~2.5GB) at build time so the first import request doesn't stall on model download.

The AI tools (`demucs`, `basic-pitch`, `yt-dlp`) are installed globally via pip3 and are available on PATH when spawned as subprocesses by the Node.js API.

### Resource Requirements

The API pod requires elevated resources due to Demucs stem separation:

| Resource | Value | Rationale |
|----------|-------|-----------|
| CPU | 2000m | Demucs CPU inference is compute-intensive (~5 min per track) |
| Memory | 3Gi | Demucs peak memory usage is ~2-3GB during separation |

These are configured in `deploy/enclii.yaml` under the `api` service.

### Capacity Notes

- Demucs runs single-concurrency per pod (one import at a time). For multi-user scale, add a job queue (Redis/Bull) and scale pods horizontally.
- The Docker image is large (~4GB) due to the pre-downloaded htdemucs model. Use a container registry with layer caching.
- Basic Pitch transcription runs on all 4 stems sequentially after Demucs completes. Each stem takes ~10-30s on CPU.
