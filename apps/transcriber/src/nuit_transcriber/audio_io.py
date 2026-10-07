"""Audio decoding through ffmpeg into float32 numpy arrays (no temp files)."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np


class FfmpegMissingError(RuntimeError):
    pass


def _ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise FfmpegMissingError("ffmpeg is required on PATH to decode media")
    return exe


def load_audio(path: str | Path, sr: int, mono: bool = True) -> np.ndarray:
    """Decode any ffmpeg-readable media file to float32 PCM at ``sr``.

    Returns shape ``(n,)`` when ``mono`` else ``(2, n)``. Damaged packets (common at the head of
    YouTube Opus streams) are skipped by ffmpeg rather than aborting the decode.
    """
    channels = 1 if mono else 2
    cmd = [
        _ffmpeg(),
        "-v",
        "error",
        "-nostdin",
        "-err_detect",
        "ignore_err",
        "-i",
        str(path),
        "-vn",
        "-ac",
        str(channels),
        "-ar",
        str(sr),
        "-f",
        "f32le",
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError(f"ffmpeg could not decode {path}: {proc.stderr.decode(errors='replace')[-400:]}")
    pcm = np.frombuffer(proc.stdout, dtype=np.float32)
    if mono:
        return pcm.copy()
    return pcm.reshape(-1, 2).T.copy()


def write_wav(path: str | Path, audio: np.ndarray, sr: int) -> None:
    import soundfile as sf

    data = audio.T if audio.ndim == 2 else audio
    sf.write(str(path), data, sr, subtype="FLOAT")


def media_duration(path: str | Path) -> float | None:
    exe = shutil.which("ffprobe")
    if not exe:
        return None
    proc = subprocess.run(
        [exe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        return float(proc.stdout.strip())
    except ValueError:
        return None
