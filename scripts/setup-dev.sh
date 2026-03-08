#!/usr/bin/env bash
set -euo pipefail

echo "=== Nuit One — Dev Setup ==="

# 1. System dependencies
echo ""
echo "--- Installing system dependencies ---"
if command -v brew &>/dev/null; then
  brew install ffmpeg yt-dlp 2>/dev/null || echo "ffmpeg/yt-dlp already installed"
else
  echo "WARNING: Homebrew not found. Install ffmpeg and yt-dlp manually."
fi

# 2. Python venv + AI tools
echo ""
echo "--- Setting up Python venv + AI tools ---"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  echo "Created .venv"
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet demucs basic-pitch
echo "Installed demucs + basic-pitch in .venv"

# 3. PostgreSQL
echo ""
echo "--- Setting up PostgreSQL ---"
if command -v brew &>/dev/null; then
  brew services start postgresql@15 2>/dev/null || brew services start postgresql 2>/dev/null || echo "PostgreSQL may already be running"
fi
createuser -s nuitone 2>/dev/null || echo "User nuitone already exists"
createdb -O nuitone nuitone 2>/dev/null || echo "Database nuitone already exists"

# 4. .env file
echo ""
echo "--- Setting up .env ---"
if [ ! -f .env ]; then
  cp .env.example .env
  # Append dev-specific overrides
  cat >> .env <<'ENVEOF'

# --- Local Dev Overrides ---
NODE_ENV=development
STORAGE_MODE=local
LOCAL_STORAGE_PATH=./storage
ENVEOF
  echo "Created .env from .env.example with local dev overrides"
else
  echo ".env already exists — verify it has STORAGE_MODE=local and NODE_ENV=development"
fi

# 5. Local storage directory
mkdir -p storage
echo "Created storage/ directory"

# 6. Install Node dependencies
echo ""
echo "--- Installing Node dependencies ---"
pnpm install

# 7. Push DB schema
echo ""
echo "--- Pushing DB schema ---"
DATABASE_URL=postgresql://nuitone:nuitone@localhost:5432/nuitone pnpm db:push

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start dev servers:  pnpm dev"
echo "Open browser:       http://localhost:5173"
