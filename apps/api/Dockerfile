FROM node:22-slim AS base
RUN corepack enable

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @nuit-one/api build

# Produce a self-contained prod-only deployment for the api workspace.
# tsup leaves dependencies external, so the runtime image must ship node_modules.
RUN pnpm --filter @nuit-one/api deploy --prod /deploy

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM base AS runtime

# Install Python 3 + ffmpeg (required by demucs, yt-dlp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install AI tools globally (--break-system-packages needed for Debian Bookworm PEP 668)
RUN pip3 install --break-system-packages --no-cache-dir demucs basic-pitch yt-dlp

# Pre-download htdemucs model (~2.5GB) so first import doesn't block on download
RUN python3 -c "import demucs.pretrained; demucs.pretrained.get_model('htdemucs')"

WORKDIR /app
COPY --from=build /deploy/package.json ./package.json
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/index.js"]
