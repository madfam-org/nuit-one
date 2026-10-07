"""Read the fretting hand's position (fret under the index finger) from video.

Two complementary readings per sampled frame, both expressed in fret coordinates through the
fitted neck (``fretboard.NeckTrack``):

* **Fingerboard coverage.** The fingerboard is straightened into fret space (x = fret number,
  y = across the board) using the twin geometry; skin-coloured pixels mark where fingers cover it.
  The covered stretch's edge nearest the nut is where the index finger sits. Robust to the curled,
  knuckles-forward fretting hand that hand-landmark models miss.
* **Fingertips.** MediaPipe Hands on an upscaled crop around the neck; fingertips over the board
  are mapped to fret numbers. More precise, available on fewer frames.

They are fused per frame, then median-filtered over time. The result is a ``PositionTrack``: the
fingering solver's video prior.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from ..instrument import InstrumentGeometry
from .fretboard import NeckFit, NeckTrack

FRETS_SHOWN = 14.0


@dataclass
class PositionTrack:
    times: np.ndarray
    fret: np.ndarray  # continuous index-finger fret estimate (nan = unknown)
    confidence: np.ndarray
    stats: dict[str, Any] = field(default_factory=dict)

    def __call__(self, t: float) -> tuple[float | None, float]:
        if self.times.size == 0:
            return None, 0.0
        lo = int(np.searchsorted(self.times, t - 0.12))
        hi = int(np.searchsorted(self.times, t + 0.12))
        win = self.fret[lo:hi]
        conf = self.confidence[lo:hi]
        ok = np.isfinite(win) & (conf > 0)
        if not ok.any():
            return None, 0.0
        return float(np.median(win[ok])), float(np.mean(conf[ok]))

    def segments(self, min_len: float = 0.25) -> list[dict[str, float | int | str]]:
        """Merge the per-frame readings into constant-position spans (for the performance document)."""
        out: list[dict[str, float | int | str]] = []
        for t, f, c in zip(self.times, self.fret, self.confidence, strict=True):
            if not np.isfinite(f) or c <= 0:
                continue
            pos = max(1, int(round(f)))
            if out and out[-1]["fret"] == pos and t - float(out[-1]["end"]) < 0.3:
                out[-1]["end"] = round(float(t), 3)
                out[-1]["_c"].append(float(c))  # type: ignore[union-attr]
            else:
                out.append(
                    {"start": round(float(t), 3), "end": round(float(t), 3), "fret": pos, "_c": [float(c)]}
                )
        spans = []
        for s in out:
            if float(s["end"]) - float(s["start"]) >= min_len:
                cs = s.pop("_c")
                spans.append({**s, "confidence": round(float(np.mean(cs)), 3), "source": "video"})  # type: ignore[arg-type]
        return spans


def board_grid(
    fit: NeckFit, geometry: InstrumentGeometry, nx: int = 280, ny: int = 36
) -> tuple[np.ndarray, np.ndarray]:
    """Image coordinates of a grid over the fingerboard: x uniform in fret number, y across the board."""
    frets = np.linspace(0.0, FRETS_SHOWN, nx)
    L = geometry.scale_length_mm
    xs = L * (1.0 - 2.0 ** (-frets / 12.0))
    x_joint = geometry.fret_distance_mm(geometry.frets_to_body)
    hw = (
        geometry.nut_width_mm + (geometry.width_at_body_joint_mm - geometry.nut_width_mm) * xs / x_joint
    ) / 2.0
    ys = np.linspace(-1.0, 1.0, ny)[:, None] * hw[None, :]  # (ny, nx)
    u = fit.k * xs / (1.0 + fit.c * xs)
    s = fit.k / (1.0 + fit.c * xs)
    map_x = fit.nut[0] + fit.axis[0] * u[None, :] + fit.normal[0] * ys * s[None, :]
    map_y = fit.nut[1] + fit.axis[1] * u[None, :] + fit.normal[1] * ys * s[None, :]
    return map_x.astype(np.float32), map_y.astype(np.float32)


def skin_mask(bgr: np.ndarray) -> np.ndarray:
    """Skin-coloured pixels (YCrCb box after Chai & Ngan), as 0/1 floats."""
    import cv2

    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    cr, cb = ycrcb[..., 1].astype(np.int16), ycrcb[..., 2].astype(np.int16)
    m = (cr >= 135) & (cr <= 175) & (cb >= 80) & (cb <= 130) & (ycrcb[..., 0] > 40)
    return m.astype(np.float32)


def coverage_position(
    frame_bgr: np.ndarray, fit: NeckFit, geometry: InstrumentGeometry
) -> tuple[float, float]:
    """(index-finger fret, confidence) from where skin covers the straightened fingerboard."""
    import cv2

    mx, my = board_grid(fit, geometry)
    board = cv2.remap(frame_bgr, mx, my, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    cover = skin_mask(board).mean(axis=0)  # per column (fret coordinate)
    cover = np.convolve(cover, np.ones(5) / 5, mode="same")
    frets = np.linspace(0.0, FRETS_SHOWN, len(cover))
    on = cover > 0.35
    if not on.any():
        return float("nan"), 0.0
    # longest covered run
    best_len, best_start, cur_start = 0, 0, None
    for i, v in enumerate(np.append(on, False)):
        if v and cur_start is None:
            cur_start = i
        elif not v and cur_start is not None:
            if i - cur_start > best_len:
                best_len, best_start = i - cur_start, cur_start
            cur_start = None
    a, b = frets[best_start], frets[best_start + best_len - 1]
    width = b - a
    if width < 0.6 or width > 7.0:
        return float("nan"), 0.0
    # the index finger presses in the fret space just past the covered edge nearest the nut
    pos = a + 0.6
    conf = float(np.clip(cover[best_start : best_start + best_len].mean(), 0.0, 1.0))
    return float(pos), conf


class FingertipReader:
    """MediaPipe Hands on an upscaled crop around the neck."""

    TIPS = (8, 12, 16, 20)  # index, middle, ring, little

    def __init__(self) -> None:
        import mediapipe as mp

        self._hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            model_complexity=1,
            min_detection_confidence=0.3,
            min_tracking_confidence=0.3,
        )

    def close(self) -> None:
        self._hands.close()

    def read(
        self, frame_bgr: np.ndarray, fit: NeckFit, geometry: InstrumentGeometry
    ) -> tuple[float, float, list[float]]:
        """(index-finger fret, confidence, fret of each fingertip on the board)."""
        import cv2

        h, w = frame_bgr.shape[:2]
        pts = [
            fit.to_image(geometry.fret_distance_mm(f), y) for f in (-1.0, FRETS_SHOWN) for y in (-45.0, 45.0)
        ]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        x0, x1 = int(max(0, min(xs) - 20)), int(min(w, max(xs) + 20))
        y0, y1 = int(max(0, min(ys) - 60)), int(min(h, max(ys) + 90))
        if x1 - x0 < 40 or y1 - y0 < 40:
            return float("nan"), 0.0, []
        crop = frame_bgr[y0:y1, x0:x1]
        scale = 2.0
        big = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        res = self._hands.process(cv2.cvtColor(big, cv2.COLOR_BGR2RGB))
        if not res.multi_hand_landmarks:
            return float("nan"), 0.0, []
        best: tuple[float, float, list[float]] | None = None
        for lm, hd in zip(res.multi_hand_landmarks, res.multi_handedness, strict=True):
            frets: list[float] = []
            for tip in self.TIPS:
                p = lm.landmark[tip]
                px, py = x0 + p.x * big.shape[1] / scale, y0 + p.y * big.shape[0] / scale
                x_mm, y_mm = fit.to_neck(px, py)
                if not math.isfinite(x_mm) or x_mm <= 0:
                    continue
                f = geometry.fret_from_distance_mm(x_mm)
                if 0.0 < f <= FRETS_SHOWN and abs(y_mm) <= geometry.neck_half_width_mm(x_mm) + 6.0:
                    frets.append(f)
            if len(frets) < 2:
                continue
            index_fret = min(frets)
            conf = float(hd.classification[0].score) * len(frets) / 4.0
            if best is None or conf > best[1]:
                best = (index_fret, conf, frets)
        if best is None:
            return float("nan"), 0.0, []
        # a fingertip presses in the fret space it sits in: fret = ceil of the coordinate
        return float(math.floor(best[0]) + 0.9), best[1], best[2]


def read_positions(
    video_path: str,
    track: NeckTrack,
    geometry: InstrumentGeometry,
    sample_fps: float = 10.0,
    use_landmarks: bool = True,
    t_start: float = 0.0,
    t_end: float | None = None,
) -> PositionTrack:
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    step = max(1, int(round(fps / sample_fps)))
    reader = FingertipReader() if use_landmarks else None
    times, frets, confs = [], [], []
    n_cov = n_tip = n_both_agree = 0
    idx = int(t_start * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    stop = int(t_end * fps) if t_end is not None else None
    while True:
        if stop is not None and idx >= stop:
            break
        ok = cap.grab()
        if not ok:
            break
        if idx % step == 0:
            ok, frame = cap.retrieve()
            t = idx / fps
            fit = track.at(t) if ok else None
            if ok and fit is not None:
                p_cov, c_cov = coverage_position(frame, fit, geometry)
                p_tip, c_tip = float("nan"), 0.0
                if reader is not None:
                    p_tip, c_tip, _ = reader.read(frame, fit, geometry)
                if math.isfinite(p_cov):
                    n_cov += 1
                if math.isfinite(p_tip):
                    n_tip += 1
                if math.isfinite(p_cov) and math.isfinite(p_tip):
                    if abs(p_cov - p_tip) <= 1.5:
                        n_both_agree += 1
                        p, c = 0.6 * p_tip + 0.4 * p_cov, min(1.0, 0.6 * c_tip + 0.4 * c_cov + 0.2)
                    else:
                        p, c = (p_tip, c_tip * 0.7) if c_tip >= c_cov else (p_cov, c_cov * 0.7)
                elif math.isfinite(p_tip):
                    p, c = p_tip, c_tip * 0.8
                elif math.isfinite(p_cov):
                    p, c = p_cov, c_cov * 0.6
                else:
                    p, c = float("nan"), 0.0
                times.append(t)
                frets.append(p)
                confs.append(c)
        idx += 1
    cap.release()
    if reader is not None:
        reader.close()
    tarr, farr, carr = np.array(times), np.array(frets, dtype=float), np.array(confs, dtype=float)
    # temporal median (5 samples ≈ 0.5 s) over the known readings
    smooth = farr.copy()
    for i in range(len(farr)):
        win = farr[max(0, i - 2) : i + 3]
        win = win[np.isfinite(win)]
        if win.size:
            smooth[i] = float(np.median(win))
    stats = {
        "framesSampled": len(times),
        "coverageReadings": n_cov,
        "fingertipReadings": n_tip,
        "agreeingReadings": n_both_agree,
        "neckKeyframes": len(track.fits),
        "neckKeyframesRejected": track.rejected,
        "pxPerMm": round(track.k_ref, 4),
    }
    return PositionTrack(tarr, smooth, carr, stats)


def draw_position(
    frame_bgr: np.ndarray, fit: NeckFit, geometry: InstrumentGeometry, fret: float
) -> np.ndarray:
    import cv2

    out = frame_bgr.copy()
    if not math.isfinite(fret):
        return out
    lo, hi = max(fret - 1, 0.0), fret + 3
    xs = [geometry.fret_distance_mm(lo), geometry.fret_distance_mm(hi)]
    poly = []
    for x in xs:
        hw = geometry.neck_half_width_mm(x)
        poly.append(fit.to_image(x, -hw))
    for x in reversed(xs):
        hw = geometry.neck_half_width_mm(x)
        poly.append(fit.to_image(x, hw))
    pts = np.array([[int(px), int(py)] for px, py in poly], dtype=np.int32)
    overlay = out.copy()
    cv2.fillPoly(overlay, [pts], (255, 140, 0))
    out = cv2.addWeighted(overlay, 0.35, out, 0.65, 0)
    cv2.putText(
        out,
        f"pos {int(round(fret))}",
        (int(pts[0][0]), int(pts[0][1]) - 8),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (255, 200, 0),
        1,
    )
    return out
