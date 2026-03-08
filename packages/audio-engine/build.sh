#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
OUT_DIR="$SCRIPT_DIR/out"

echo "==> Building Nuit Audio Engine (WASM)"

# Check for Emscripten
if ! command -v emcmake &> /dev/null; then
  echo "Error: Emscripten not found. Install emsdk first."
  echo "  https://emscripten.org/docs/getting_started/downloads.html"
  exit 1
fi

mkdir -p "$BUILD_DIR" "$OUT_DIR"

cd "$BUILD_DIR"
emcmake cmake "$SCRIPT_DIR" -DCMAKE_BUILD_TYPE=Release
emmake make -j$(nproc 2>/dev/null || sysctl -n hw.logicalcpu)

# Copy outputs
cp -f audio_engine.js audio_engine.wasm "$OUT_DIR/"

echo "==> Build complete: $OUT_DIR/"
