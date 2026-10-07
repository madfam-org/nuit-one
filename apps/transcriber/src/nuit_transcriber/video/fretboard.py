"""Find the guitar neck in a video frame by fitting the twin's fret ladder.

Fret wires are bright lines across the neck whose spacing follows d(n) = L·(1 − 2^(−n/12)). That
progression is distinctive, so instead of a learned detector (no open fretboard weights exist) the
neck is found geometrically:

1. **Neck band.** Strings and neck edges are the longest family of parallel lines; their dominant
   direction and densest perpendicular offset give the neck's axis and width.
2. **Fret profile.** The band is straightened into a strip; fret wires become vertical ridges, and
   their per-column strength is a 1-D profile along the neck.
3. **Ladder fit.** The twin's fret positions (mm) are mapped to strip pixels by a 1-D projective map
   ``u = u0 − dir·k·D/(1 + c·D)`` (nut position, px per mm, direction, perspective). The map that
   lands the most fret positions on ridges wins.

The result maps neck millimetres (x from the nut toward the bridge, y across the neck) to image
pixels and back, which is what the hand reader needs to turn fingertips into fret numbers.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from ..instrument import InstrumentGeometry


@dataclass(frozen=True)
class NeckFit:
    nut: tuple[float, float]  # image position of the nut centre (px)
    axis: tuple[float, float]  # unit vector from the nut toward the bridge (image)
    normal: tuple[float, float]  # unit vector across the neck (image), toward the treble strings' side
    k: float  # px per mm along the neck at the nut
    c: float  # perspective term (1/mm)
    half_width_px: float  # half the band width in px at the nut
    score: float  # ladder fit strength (z-score of the winning fit)
    scale_length_mm: float

    def along_px(self, x_mm: float) -> float:
        return self.k * x_mm / (1.0 + self.c * x_mm)

    def x_mm_from_along(self, u: float) -> float:
        # inverse of u = k x / (1 + c x)  →  x = u / (k − c u)
        den = self.k - self.c * u
        return u / den if abs(den) > 1e-9 else float("inf")

    def to_image(self, x_mm: float, y_mm: float) -> tuple[float, float]:
        u = self.along_px(x_mm)
        s = self.k / (1.0 + self.c * x_mm)  # local px/mm, used across the neck too
        px = self.nut[0] + self.axis[0] * u + self.normal[0] * y_mm * s
        py = self.nut[1] + self.axis[1] * u + self.normal[1] * y_mm * s
        return px, py

    def to_neck(self, px: float, py: float) -> tuple[float, float]:
        dx, dy = px - self.nut[0], py - self.nut[1]
        u = dx * self.axis[0] + dy * self.axis[1]
        v = dx * self.normal[0] + dy * self.normal[1]
        x_mm = self.x_mm_from_along(u)
        s = self.k / (1.0 + self.c * x_mm) if math.isfinite(x_mm) else self.k
        return x_mm, v / s

    def fret_at(self, px: float, py: float, geometry: InstrumentGeometry) -> float:
        x_mm, _ = self.to_neck(px, py)
        if not math.isfinite(x_mm) or x_mm < 0:
            return float("nan")
        return geometry.fret_from_distance_mm(x_mm)


def _line_segments(gray: np.ndarray) -> np.ndarray:
    import cv2

    edges = cv2.Canny(gray, 40, 120, L2gradient=True)
    h, w = gray.shape
    lines = cv2.HoughLinesP(edges, 1, np.pi / 720, threshold=40, minLineLength=int(0.06 * w), maxLineGap=6)
    if lines is None:
        return np.zeros((0, 4), dtype=float)
    return lines[:, 0, :].astype(float)


def find_neck_band(
    gray: np.ndarray,
    angle_hint: float | None = None,
    angle_tol: float = 12.0,
    max_abs_angle: float = 60.0,
    peak: int | None = None,
) -> tuple[float, float, float, float, float, float] | None:
    """Return (theta_deg, rho_center, half_width, u_min, u_max, strength) of the neck band.

    ``peak`` selects the n-th strongest line direction (0 = strongest) so callers can try several
    candidate line families and keep the one that carries a fret ladder."""
    seg = _line_segments(gray)
    if len(seg) < 6:
        return None
    dx, dy = seg[:, 2] - seg[:, 0], seg[:, 3] - seg[:, 1]
    length = np.hypot(dx, dy)
    ang = np.degrees(np.arctan2(dy, dx))
    ang = (ang + 90.0) % 180.0 - 90.0  # direction-free, in [-90, 90)
    ok = np.abs(ang) <= max_abs_angle
    if angle_hint is not None:
        ok &= np.abs(((ang - angle_hint) + 90.0) % 180.0 - 90.0) <= angle_tol
    if ok.sum() < 6:
        return None
    hist, edges_ = np.histogram(
        ang[ok], bins=np.arange(-max_abs_angle, max_abs_angle + 0.5, 0.5), weights=length[ok]
    )
    hist = np.convolve(hist, np.ones(5) / 5, mode="same")
    if peak is None:
        theta = float(edges_[int(np.argmax(hist))] + 0.25)
    else:
        order_peaks = np.argsort(hist)[::-1]
        picked: list[float] = []
        for i in order_peaks:
            th = float(edges_[i] + 0.25)
            if hist[i] <= 0:
                break
            if all(abs(th - q) >= 5.0 for q in picked):
                picked.append(th)
            if len(picked) > peak:
                break
        if len(picked) <= peak:
            return None
        theta = picked[peak]
    near = ok & (np.abs(((ang - theta) + 90.0) % 180.0 - 90.0) <= 2.5)
    if near.sum() < 4:
        return None
    t = math.radians(theta)
    axis = np.array([math.cos(t), math.sin(t)])
    normal = np.array([-math.sin(t), math.cos(t)])
    mid = np.stack([(seg[near, 0] + seg[near, 2]) / 2, (seg[near, 1] + seg[near, 3]) / 2], axis=1)
    rho = mid @ normal
    w = length[near]
    h_img = gray.shape[0]
    window = max(24.0, 0.09 * h_img)  # neck band at most ~9 % of the frame height
    order = np.argsort(rho)
    rs, ws = rho[order], w[order]
    best, best_i, best_j = -1.0, 0, 0
    j = 0
    acc = 0.0
    for i in range(len(rs)):
        while j < len(rs) and rs[j] - rs[i] <= window:
            acc += ws[j]
            j += 1
        if acc > best:
            best, best_i, best_j = acc, i, j
        acc -= ws[i]
    sel = order[best_i:best_j]
    sel_mask = np.zeros(len(rho), dtype=bool)
    sel_mask[sel] = True
    rho_sel = rho[sel_mask]
    rho_c = float(np.average(rho_sel, weights=w[sel_mask]))
    half = float(max(np.percentile(np.abs(rho_sel - rho_c), 95), 6.0)) + 4.0
    ends = np.concatenate([seg[near][sel_mask][:, 0:2], seg[near][sel_mask][:, 2:4]]) @ axis
    return theta, rho_c, half, float(ends.min()), float(ends.max()), float(best)


def _strip(gray: np.ndarray, theta: float, rho_c: float, half: float, u_min: float, u_max: float):
    import cv2

    t = math.radians(theta)
    axis = np.array([math.cos(t), math.sin(t)])
    normal = np.array([-math.sin(t), math.cos(t)])
    us = np.arange(u_min, u_max, 1.0)
    vs = np.arange(-half, half, 1.0)
    uu, vv = np.meshgrid(us, vs)
    pts = uu[..., None] * axis + (rho_c + vv)[..., None] * normal
    map_x = pts[..., 0].astype(np.float32)
    map_y = pts[..., 1].astype(np.float32)
    strip = cv2.remap(gray, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return strip.astype(np.float32), axis, normal


def fret_profile(strip: np.ndarray) -> np.ndarray:
    """Per-column strength of thin bright vertical ridges (fret wires) in a straightened neck strip."""
    import cv2

    h = strip.shape[0]
    core = strip[int(h * 0.2) : int(h * 0.8)]
    blur = cv2.GaussianBlur(core, (0, 0), sigmaX=1.0, sigmaY=2.0)
    d2 = cv2.Sobel(blur, cv2.CV_32F, 2, 0, ksize=3)
    ridge = np.maximum(-d2, 0.0)
    prof = np.median(ridge, axis=0)
    base = np.convolve(prof, np.ones(31) / 31, mode="same")
    prof = prof - base
    mad = np.median(np.abs(prof - np.median(prof))) + 1e-6
    return np.clip(prof / (1.4826 * mad), -2.0, 6.0)


def fit_ladder(
    profile: np.ndarray,
    scale_length_mm: float,
    n_frets: int = 12,
    k_range: tuple[float, float] | None = None,
    u0_range: tuple[int, int] | None = None,
    dirs: tuple[int, ...] = (1, -1),
) -> tuple[float, float, float, int, float]:
    """Best (u0, k, c, dir, z) mapping fret mm → strip column."""
    n = len(profile)
    smooth = np.convolve(profile, np.array([0.25, 0.5, 1.0, 0.5, 0.25]) / 2.5, mode="same")
    d = np.array([scale_length_mm * (1 - 2 ** (-f / 12)) for f in range(0, n_frets + 1)])
    k_lo, k_hi = k_range or (max(0.12, 3.0 / (d[12] - d[11])), 3.0 * n / scale_length_mm)
    ks = np.geomspace(k_lo, k_hi, 160)
    u0s = np.arange(*(u0_range or (0, n)))
    best = (0.0, 0.0, 0.0, 1, -1e9)
    scores_all = []
    for direction in dirs:
        for k in ks:
            pos = u0s[:, None] - direction * k * d[None, :]  # (u0, fret)
            idx = np.rint(pos).astype(int)
            inside = (idx >= 0) & (idx < n)
            vals = np.where(inside, smooth[np.clip(idx, 0, n - 1)], 0.0)
            n_in = inside[:, 1:].sum(axis=1)
            score = vals[:, 1:].sum(axis=1) + 1.5 * vals[:, 0]
            score = np.where(n_in >= 7, score / np.sqrt(np.maximum(n_in, 1)), -1e9)
            scores_all.append(score)
            i = int(np.argmax(score))
            if score[i] > best[4]:
                best = (float(u0s[i]), float(k), 0.0, direction, float(score[i]))
    allv = np.concatenate(scores_all)
    allv = allv[allv > -1e8]
    z = (best[4] - float(np.median(allv))) / (float(np.std(allv)) + 1e-6) if allv.size else 0.0
    u0, k, _, direction, _ = best
    u0, k = refine_anchor(smooth, u0, k, direction, scale_length_mm)
    # perspective refinement around the winner
    best_c, best_s = 0.0, -1e9
    for c in np.linspace(-6e-4, 6e-4, 25):
        pos = u0 - direction * k * d / (1 + c * d)
        idx = np.rint(pos).astype(int)
        inside = (idx >= 0) & (idx < n)
        s = float(np.where(inside, smooth[np.clip(idx, 0, n - 1)], 0.0)[1:].sum())
        if s > best_s:
            best_c, best_s = float(c), s
    return u0, k, best_c, direction, z


def _ridge_at(smooth: np.ndarray, u: float, tol: int = 2) -> float:
    n = len(smooth)
    i = int(round(u))
    if i - tol < 0 or i + tol >= n:
        return 0.0
    return float(smooth[i - tol : i + tol + 1].max())


def refine_anchor(
    smooth: np.ndarray, u0: float, k: float, direction: int, scale_length_mm: float, max_shift: int = 9
) -> tuple[float, float]:
    """Resolve the ladder's self-similarity: which ridge is the nut.

    The equal-tempered ladder anchored at real fret m with scale 2^(-m/12) lands exactly on real
    frets m+1, m+2, … so the fit can lock on a few frets past the nut. Step the anchor toward the
    headstock while a ridge sits where the extended ladder predicts the next wire; stop when the
    pattern ends (the bone nut, then the headstock).
    """
    L = scale_length_mm

    def d(f: float) -> float:
        return L * (1 - 2 ** (-f / 12))

    def frets_seen(u0_: float, k_: float) -> float:
        vals = [_ridge_at(smooth, u0_ - direction * k_ * d(f)) for f in range(1, 7)]
        return float(np.mean(vals))

    base = frets_seen(u0, k)
    for _ in range(max_shift):
        k1 = k * 2 ** (1 / 12)
        u1 = u0 + direction * k1 * d(1)  # one more fret toward the headstock
        if _ridge_at(smooth, u1) < max(1.0, 0.45 * base):
            break
        u0, k = u1, k1
    return u0, k


def _fit_band(gray, band, geometry, previous, scale: float) -> NeckFit | None:
    theta, rho_c, half, u_min, u_max, _strength = band
    rho_c, half, u_min, u_max = rho_c * scale, half * scale, u_min * scale, u_max * scale
    pad = 0.25 * (u_max - u_min)
    strip, axis, normal = _strip(gray, theta, rho_c, half, u_min - pad, u_max + pad)
    prof = fret_profile(strip)
    k_range = (previous.k * 0.85, previous.k * 1.15) if previous is not None else None
    u0, k, c, direction, z = fit_ladder(prof, geometry.scale_length_mm, k_range=k_range)
    if z < 2.5:
        return None
    u_nut = (u_min - pad) + u0
    nut = axis * u_nut + normal * rho_c
    ax = -direction * axis  # from the nut toward the bridge
    nrm = np.array([-ax[1], ax[0]])
    return NeckFit(
        nut=(float(nut[0]), float(nut[1])),
        axis=(float(ax[0]), float(ax[1])),
        normal=(float(nrm[0]), float(nrm[1])),
        k=float(k),
        c=float(c),
        half_width_px=float(half),
        score=float(z),
        scale_length_mm=geometry.scale_length_mm,
    )


def fit_frame(
    frame_bgr: np.ndarray,
    geometry: InstrumentGeometry,
    previous: NeckFit | None = None,
) -> NeckFit | None:
    """Fit the neck in one frame. Tracking (``previous`` given) searches near the last direction at
    half resolution; initialisation tries the three strongest line families at full resolution and
    keeps the one whose fret ladder fits best."""
    import cv2

    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    if previous is not None:
        small = cv2.resize(gray, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        hint = math.degrees(math.atan2(previous.axis[1], previous.axis[0]))
        hint = (hint + 90.0) % 180.0 - 90.0
        band = find_neck_band(small, angle_hint=hint)
        fit = _fit_band(gray, band, geometry, previous, 2.0) if band is not None else None
        if fit is not None:
            return fit
    best: NeckFit | None = None
    for peak in range(3):
        band = find_neck_band(gray, peak=peak)
        if band is None:
            continue
        fit = _fit_band(gray, band, geometry, None, 1.0)
        if fit is not None and (best is None or fit.score > best.score):
            best = fit
    return best


def draw_fit(
    frame_bgr: np.ndarray, fit: NeckFit, geometry: InstrumentGeometry, n_frets: int = 14
) -> np.ndarray:
    """Overlay the fitted fret ladder and string lines (debugging and verification)."""
    import cv2

    out = frame_bgr.copy()
    half_nut = geometry.nut_width_mm / 2
    for n in range(0, n_frets + 1):
        x = geometry.fret_distance_mm(n)
        hw = geometry.neck_half_width_mm(x) if n <= geometry.frets_to_body else half_nut * 1.2
        p1 = fit.to_image(x, -hw)
        p2 = fit.to_image(x, hw)
        color = (0, 255, 255) if n in (0, 5, 7, 12) else (0, 200, 0)
        cv2.line(out, (int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1])), color, 1, cv2.LINE_AA)
        if n in (0, 5, 7, 12):
            cv2.putText(
                out, str(n), (int(p2[0]) + 2, int(p2[1]) + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1
            )
    return out


def reanchor(fit: NeckFit, frets_toward_headstock: int) -> NeckFit:
    """Move the nut ``m`` frets toward the headstock (the ladder's self-similar alternative)."""
    m = frets_toward_headstock
    if m == 0:
        return fit
    k2 = fit.k * 2 ** (m / 12)
    shift = k2 * fit.scale_length_mm * (1 - 2 ** (-m / 12))
    nut = (fit.nut[0] - fit.axis[0] * shift, fit.nut[1] - fit.axis[1] * shift)
    return NeckFit(nut, fit.axis, fit.normal, k2, fit.c, fit.half_width_px, fit.score, fit.scale_length_mm)


def _angle(fit: NeckFit) -> float:
    return math.degrees(math.atan2(fit.axis[1], fit.axis[0]))


@dataclass
class NeckTrack:
    times: np.ndarray
    fits: list[NeckFit]
    k_ref: float
    rejected: int

    def at(self, t: float) -> NeckFit | None:
        """Neck fit at time ``t``: linear interpolation between the bracketing keyframes."""
        if not self.fits:
            return None
        i = int(np.searchsorted(self.times, t))
        if i <= 0:
            return self.fits[0]
        if i >= len(self.fits):
            return self.fits[-1]
        t0, t1 = self.times[i - 1], self.times[i]
        a, b = self.fits[i - 1], self.fits[i]
        if t1 - t0 > 4.0:  # a long gap: use the nearer keyframe rather than invent motion
            return a if t - t0 < t1 - t else b
        w = (t - t0) / (t1 - t0)

        def lerp(x: float, y: float) -> float:
            return x + (y - x) * w

        ang = math.radians(lerp(_angle(a), _angle(b)))
        axis = (math.cos(ang), math.sin(ang))
        return NeckFit(
            nut=(lerp(a.nut[0], b.nut[0]), lerp(a.nut[1], b.nut[1])),
            axis=axis,
            normal=(-axis[1], axis[0]),
            k=lerp(a.k, b.k),
            c=lerp(a.c, b.c),
            half_width_px=lerp(a.half_width_px, b.half_width_px),
            score=min(a.score, b.score),
            scale_length_mm=a.scale_length_mm,
        )


def track_neck(
    video_path: str,
    geometry: InstrumentGeometry,
    every_s: float = 1.0,
    max_frames: int | None = None,
    t_start: float = 0.0,
    t_end: float | None = None,
) -> NeckTrack:
    """Fit the neck about once per ``every_s`` across the video, then reconcile the fits.

    Reconciliation resolves the ladder's self-similarity over time: the camera and guitar barely
    move, so the true anchor has the largest px/mm scale (an anchor m frets too far along has a
    scale smaller by 2^(-m/12)). Each keyframe is re-anchored to the consensus scale, and keyframes
    whose angle or nut position disagree with the consensus (a banner edge, a mic stand) are dropped.
    """
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, int(round(every_s * fps)))
    raw: list[tuple[float, NeckFit]] = []
    prev: NeckFit | None = None
    count = 0
    first = int(t_start * fps)
    last = min(n_frames, int(t_end * fps)) if t_end is not None else n_frames
    for idx in range(first, last, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        fit = fit_frame(frame, geometry, prev)
        if fit is not None:
            raw.append((idx / fps, fit))
            prev = fit
        count += 1
        if max_frames is not None and count >= max_frames:
            break
    cap.release()
    if not raw:
        return NeckTrack(np.zeros(0), [], 0.0, 0)
    angles = np.array([_angle(f) for _, f in raw])
    ang_med = float(np.median(angles))
    keep = [(t, f) for (t, f), a in zip(raw, angles, strict=True) if abs(a - ang_med) <= 6.0]
    k_ref = float(np.percentile([f.k for _, f in keep], 80))
    fixed: list[tuple[float, NeckFit]] = []
    for t, f in keep:
        m = int(round(12 * math.log2(k_ref / f.k)))
        fixed.append((t, reanchor(f, m) if 0 < m <= 8 else f))
    nut_med = np.median(np.array([f.nut for _, f in fixed]), axis=0)
    final = [(t, f) for t, f in fixed if math.hypot(f.nut[0] - nut_med[0], f.nut[1] - nut_med[1]) <= 80.0]
    times = np.array([t for t, _ in final])
    return NeckTrack(times, [f for _, f in final], k_ref, len(raw) - len(final))
