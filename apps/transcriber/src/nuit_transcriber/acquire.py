"""Media acquisition: a URL (YouTube or any yt-dlp site) or a local file → cached audio + video.

Format policy, learned the hard way:

* YouTube serves different format sets per client and per session. A session that only gets the
  muxed 360p stream must still succeed, so every selector ends in a plain ``b`` (best muxed).
* The video is wanted for fretting-hand analysis, so H.264 is preferred (every OpenCV build decodes
  it), then VP9, capped at 1080p (more pixels do not improve fret localisation enough to pay for it).
* yt-dlp must be recent and have a JavaScript runtime (deno) for YouTube's challenge; a stale
  yt-dlp silently loses the DASH formats and only sees the muxed fallback.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

VIDEO_SELECTOR = (
    "bv*[height<=1080][vcodec^=avc1]/bv*[height<=1080][vcodec^=vp09]/bv*[height<=1080][vcodec^=vp9]"
    "/bv*[height<=1080]/b[height<=1080]/b"
)
AUDIO_SELECTOR = "ba[acodec^=opus]/ba[acodec^=mp4a]/ba/b"

#: Fields of the yt-dlp info dict kept in the cache (the rest is large and churns per request).
INFO_FIELDS = (
    "id",
    "title",
    "uploader",
    "channel",
    "duration",
    "upload_date",
    "webpage_url",
    "license",
    "categories",
    "tags",
    "description",
    "width",
    "height",
    "fps",
    "extractor_key",
)

MAX_DURATION_SECONDS = 20 * 60
MAX_FILESIZE_BYTES = 600 * 1024 * 1024


@dataclass
class Acquired:
    source_kind: str  # "youtube" | "url" | "file"
    source_id: str
    url: str | None
    title: str
    uploader: str | None
    duration: float | None
    audio_path: Path
    video_path: Path | None
    info: dict[str, Any]

    def to_doc(self) -> dict[str, Any]:
        return {
            "kind": self.source_kind,
            "id": self.source_id,
            "url": self.url,
            "title": self.title,
            "uploader": self.uploader,
            "durationSec": self.duration,
            "uploadDate": self.info.get("upload_date"),
            "license": self.info.get("license"),
            "hasVideo": self.video_path is not None,
            "videoSize": [self.info.get("width"), self.info.get("height")]
            if self.video_path is not None
            else None,
        }


_YT_ID = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/|live/)([A-Za-z0-9_-]{11})")


def youtube_id(url: str) -> str | None:
    m = _YT_ID.search(url)
    return m.group(1) if m else None


def _has_video_stream(path: Path) -> bool:
    exe = shutil.which("ffprobe")
    if not exe:
        return False
    proc = subprocess.run(
        [
            exe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return "video" in proc.stdout


def _find(dirpath: Path, stem: str) -> Path | None:
    for p in sorted(dirpath.glob(f"{stem}.*")):
        if p.suffix not in {".json", ".part", ".ytdl"}:
            return p
    return None


def acquire_file(path: str | Path) -> Acquired:
    p = Path(path).expanduser().resolve()
    if not p.is_file():
        raise FileNotFoundError(p)
    h = hashlib.sha256()
    with p.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    from .audio_io import media_duration

    return Acquired(
        source_kind="file",
        source_id=h.hexdigest()[:16],
        url=None,
        title=p.stem,
        uploader=None,
        duration=media_duration(p),
        audio_path=p,
        video_path=p if _has_video_stream(p) else None,
        info={"id": h.hexdigest()[:16], "title": p.stem},
    )


def acquire_url(url: str, cache_root: str | Path, want_video: bool = True) -> Acquired:
    """Download (or reuse from cache) the audio and, if wanted, the video of ``url``."""
    import yt_dlp

    if not re.match(r"^https?://", url):
        raise ValueError("only http(s) URLs are accepted")
    yid = youtube_id(url)
    kind = "youtube" if yid else "url"
    key = yid or hashlib.sha256(url.encode()).hexdigest()[:16]
    workdir = Path(cache_root).expanduser().resolve() / kind / key
    workdir.mkdir(parents=True, exist_ok=True)
    info_path = workdir / "info.json"

    def _too_long(info: dict[str, Any], *, incomplete: bool) -> str | None:
        duration = info.get("duration")
        if duration and duration > MAX_DURATION_SECONDS:
            return f"media is {duration:.0f}s; the intake limit is {MAX_DURATION_SECONDS}s"
        return None

    base_opts: dict[str, Any] = {
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "max_filesize": MAX_FILESIZE_BYTES,
        "match_filter": _too_long,
        "retries": 3,
        "fragment_retries": 3,
    }

    audio_path = _find(workdir, "audio")
    video_path = _find(workdir, "video") if want_video else None
    info: dict[str, Any]
    if info_path.is_file():
        info = json.loads(info_path.read_text())
    else:
        with yt_dlp.YoutubeDL(base_opts) as ydl:
            raw = ydl.extract_info(url, download=False)
        if raw is None:
            raise RuntimeError("yt-dlp returned no metadata")
        if (reason := _too_long(raw, incomplete=False)) is not None:
            raise ValueError(reason)
        info = {k: raw.get(k) for k in INFO_FIELDS}
        info_path.write_text(json.dumps(info, ensure_ascii=False, indent=2))

    if audio_path is None:
        opts = dict(base_opts, format=AUDIO_SELECTOR, outtmpl=str(workdir / "audio.%(ext)s"))
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
        audio_path = _find(workdir, "audio")
        if audio_path is None:
            raise RuntimeError("yt-dlp did not produce an audio file")
    if want_video and video_path is None:
        opts = dict(base_opts, format=VIDEO_SELECTOR, outtmpl=str(workdir / "video.%(ext)s"))
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
            video_path = _find(workdir, "video")
        except yt_dlp.utils.DownloadError:
            video_path = None  # audio-only intake still works; fingering then relies on audio alone
        if video_path is not None and not _has_video_stream(video_path):
            video_path = None

    return Acquired(
        source_kind=kind,
        source_id=key,
        url=url,
        title=str(info.get("title") or key),
        uploader=info.get("uploader") or info.get("channel"),
        duration=info.get("duration"),
        audio_path=audio_path,
        video_path=video_path,
        info=info,
    )


def acquire(source: str, cache_root: str | Path, want_video: bool = True) -> Acquired:
    if re.match(r"^https?://", source):
        return acquire_url(source, cache_root, want_video=want_video)
    return acquire_file(source)
