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
| **nuit-one-api** | Hono REST API. Validates JWTs against Janua JWKS endpoint. Manages projects, tracks, stems. Generates R2 presigned URLs for direct browser uploads. |
| **Janua SSO** | Self-hosted OAuth 2.0 / OpenID Connect provider. Manages user identities, workspace organizations, and role assignments. Publishes JWKS for stateless JWT verification. |
| **PostgreSQL** | Primary data store. Schema managed by Drizzle ORM with migration files in `packages/db/src/migrations/`. Tables: projects, tracks, stems, performances, calibration_profiles. |
| **Cloudflare R2** | Object storage for audio stems, WASM binaries, and exported mixes. S3-compatible API. No egress fees. Browser uploads via presigned PUT URLs. |
| **Soketi** | Self-hosted Pusher-compatible WebSocket server. Powers real-time collaboration: presence, cursor sync, stem delivery notifications (Phase 3+). |
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

## Bass Karaoke Data Flow

The bass karaoke MVP uses server-side AI processing (Demucs, Basic Pitch) rather than in-browser ONNX Runtime. Audio playback uses standard Web Audio API (`AudioBufferSourceNode` + `GainNode`) rather than the WASM AudioWorklet pipeline, as synchronized stem playback does not require sample-level DSP.

```
Upload Flow:
  Browser                  SvelteKit                 R2 / DB
    |                          |                        |
    |-- POST /api/upload ----->|                        |
    |   {filename, type, size} |-- Create track row --->|
    |                          |-- getUploadUrl() ----->|
    |<-- {trackId, uploadUrl} -|                        |
    |                          |                        |
    |-- PUT uploadUrl -------->|                   (direct to R2)
    |                          |                        |
    |-- POST /api/upload/confirm ->|                    |
    |                          |-- status='uploaded' -->|

Stem Separation Flow:
  SvelteKit                  Hono API                 R2 / DB
    |                          |                        |
    |-- POST /api/process ---->|                        |
    |   {trackId}              |-- Download original -->|
    |                          |-- demucs --two-stems bass
    |                          |-- Upload bass.wav ---->|
    |                          |-- Upload no_bass.wav ->|
    |                          |-- Create stems rows -->|
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

Performance Scoring Flow:
  Browser (all client-side)
    |
    |  StemPlayer: play backing track (no_bass at 100%, bass at 0%)
    |  NoteHighway: canvas render scrolling notes from NoteEvent[]
    |  PitchDetector: getUserMedia() → AnalyserNode → autocorrelation
    |  ScoringEngine: compare detected pitch vs expected notes
    |    → HIT_WINDOWS: perfect 25ms, great 50ms, good 100ms
    |    → Combo multiplier: 1x/2x/3x/4x
    |  ResultsScreen: grade (S/A/B/C/D/F), accuracy %, score
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
| **Server-side AI for MVP** | The bass karaoke MVP uses server-side Demucs and Basic Pitch via CLI subprocesses for simplicity. In-browser ONNX inference is planned for Phase 2 to eliminate server round-trips. |
| **Web Audio API for playback** | Stem playback uses `AudioBufferSourceNode` + `GainNode` rather than the WASM AudioWorklet. Synchronized buffer playback with gain control does not need sample-level DSP. The AudioWorklet pipeline is reserved for real-time recording (Phase 1+). |
| **Monorepo with Turborepo** | Shared types (`packages/shared`) prevent API/frontend drift. Single `pnpm install`. Turborepo caches builds across packages. CI runs only affected packages on each push. |
