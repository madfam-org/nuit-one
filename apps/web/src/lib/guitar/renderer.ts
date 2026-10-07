/**
 * Canvas painter for the fretboard highway.
 *
 * Layout: the fretboard (drawn from the digital twin, real fret spacing) sits at the bottom; above it
 * is the sky where upcoming notes fall straight down their own fret column, so the x of a note is
 * always its true fret and its height says when. A note drops onto its string exactly at its onset;
 * near onset a ring on the board closes around the spot and a tether links it to the falling gem, so
 * the string and finger are readable before the note lands.
 *
 * `paint` is a pure function of song time: strike ripples, string wobble and vibrato are all derived
 * from `t - onset`, never from the wall clock. Scrubbing, pausing and slowing the piece down therefore
 * all stay consistent, and nothing needs to be remembered between frames.
 */

import { drawGlyph, glyphsForNote } from './glyphs.js';
import {
  boardEdgesAt,
  DROP_SECONDS,
  type FretboardLayout,
  gemRadiusFor,
  gemY,
  handWindow,
  notePoint,
  noteX,
  skyY,
  stringYAt,
} from './layout.js';
import { approachColor, mix, type Palette, rgba } from './palette.js';
import {
  activeBarreAt,
  activeNotesAt,
  beatMarksBetween,
  eventsBetween,
  handPositionAt,
  type PlacedNote,
  type Timeline,
  upcomingNotes,
} from './timeline.js';

type Ctx2D = CanvasRenderingContext2D;

/** A note fades out over this long after it ends. */
const NOTE_TAIL_SECONDS = 0.14;
/** Notes this close to sounding get a landing ring on the board and a tether from their gem. */
const GHOST_SECONDS = 1.4;
const MAX_UPCOMING = 48;
/** The hand-position window glides to a new position over this long. */
const SHIFT_SECONDS = 0.28;
const RIPPLE_SECONDS = 0.36;
/** Slide / hammer-on / pull-off connectors stay visible this long after the target note starts. */
const CONNECTOR_SECONDS = 0.7;
const FLASH_SECONDS = 0.4;
/** Right-hand finger letters appear on falling notes this close to sounding. */
const PILL_SECONDS = 1;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const TAU = Math.PI * 2;

export interface PainterOptions {
  readonly palette: Palette;
  /** CSS font-family list for numerals and labels. */
  readonly fontFamily: string;
  /** Offscreen canvas factory (the default makes a DOM canvas; tests pass a stub). */
  readonly createCanvas?: (width: number, height: number) => HTMLCanvasElement;
}

export interface Frame {
  readonly timeline: Timeline;
  /** Song time in seconds. */
  readonly t: number;
  /** Seconds of upcoming notes to show. */
  readonly lookAhead: number;
  /** Skip decorative motion: strike ripples, string wobble, vibrato wiggle. */
  readonly reducedMotion: boolean;
}

/** Pitch-class name of a MIDI note, sharps only ("E", "C#"). */
export function pitchClassName(midi: number): string {
  return NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12] ?? '';
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Tiny deterministic generator for the wood grain (the same board every time). */
function lcg(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function roundedRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface FallingGem {
  readonly note: PlacedNote;
  readonly dt: number;
  readonly u: number;
  readonly r: number;
  readonly alpha: number;
  readonly landing: { readonly x: number; readonly y: number };
  readonly landingR: number;
  x: number;
  y: number;
}

export class FretboardPainter {
  private readonly palette: Palette;
  private readonly font: string;
  private readonly createCanvas: (width: number, height: number) => HTMLCanvasElement;
  private layout: FretboardLayout | null = null;
  private dpr = 1;
  private backdrop: HTMLCanvasElement | null = null;
  private readonly glowSprites = new Map<string, HTMLCanvasElement>();

  constructor(options: PainterOptions) {
    this.palette = options.palette;
    this.font = options.fontFamily;
    this.createCanvas =
      options.createCanvas ??
      ((width, height) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      });
  }

  /** (Re)build the cached static layer (backdrop, board, frets, nut) for a layout and device pixel ratio. */
  configure(layout: FretboardLayout, dpr: number): void {
    this.layout = layout;
    this.dpr = dpr;
    this.glowSprites.clear();
    const canvas = this.createCanvas(
      Math.max(1, Math.round(layout.width * dpr)),
      Math.max(1, Math.round(layout.height * dpr)),
    );
    const g = canvas.getContext('2d');
    if (!g) {
      this.backdrop = null;
      return;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintBackdrop(g, layout);
    this.backdrop = canvas;
  }

  /** Draw one frame. The context's transform is reset here, so callers need not manage it. */
  paint(ctx: Ctx2D, frame: Frame): void {
    const L = this.layout;
    if (!L || !this.backdrop) return;
    const { timeline, t, lookAhead, reducedMotion } = frame;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, L.width, L.height);
    ctx.drawImage(this.backdrop, 0, 0, L.width, L.height);

    const active = activeNotesAt(timeline, t, NOTE_TAIL_SECONDS);
    const upcoming = upcomingNotes(timeline, t, lookAhead, MAX_UPCOMING);
    const falling = this.layoutFalling(L, upcoming, t, lookAhead);

    this.drawBeatLines(ctx, L, timeline, t, lookAhead);
    const hand = this.drawHandPosition(ctx, L, timeline, t);
    this.drawSustainTails(ctx, L, falling, lookAhead);
    this.drawFretNumerals(ctx, L, active, hand);
    this.drawConnectors(ctx, L, timeline, active, upcoming, t);
    this.drawStrings(ctx, L, active, t, reducedMotion);
    this.drawLandingRings(ctx, falling);
    this.drawBarre(ctx, L, timeline, t);
    this.drawActiveGems(ctx, L, timeline, active, t, reducedMotion);
    this.drawFallingGems(ctx, L, timeline, falling);
    this.drawStringLabels(ctx, L);
    this.drawEvents(ctx, L, timeline, t, lookAhead, reducedMotion);
  }

  // -------------------------------------------------------------------------------------------
  // Static layer: backdrop, board, inlays, frets, nut
  // -------------------------------------------------------------------------------------------

  private paintBackdrop(g: Ctx2D, L: FretboardLayout): void {
    const P = this.palette;

    const sky = g.createLinearGradient(0, 0, 0, L.height);
    sky.addColorStop(0, P.base);
    sky.addColorStop(0.6, mix(P.base, P.elevated, 0.5));
    sky.addColorStop(1, mix(P.base, P.surface, 0.9));
    g.fillStyle = sky;
    g.fillRect(0, 0, L.width, L.height);

    // The fret wires continue up into the sky as faint lanes: a column is read from the board.
    g.strokeStyle = rgba(P.text, 0.05);
    g.lineWidth = 1;
    g.beginPath();
    for (let f = 1; f <= L.visibleFrets; f += 1) {
      const x = Math.round(L.fretX[f] ?? 0) + 0.5;
      g.moveTo(x, L.skyTop - 4);
      g.lineTo(x, L.boardTop);
    }
    g.stroke();

    // The strike line, where a gem starts its drop onto the string.
    const strikeFrom = Math.max(8, L.nutX - L.gutter * 0.5);
    const strike = g.createLinearGradient(strikeFrom, 0, L.endX + 10, 0);
    strike.addColorStop(0, rgba(P.cyan, 0));
    strike.addColorStop(0.12, rgba(P.cyan, 0.2));
    strike.addColorStop(0.88, rgba(P.cyan, 0.2));
    strike.addColorStop(1, rgba(P.cyan, 0));
    g.strokeStyle = strike;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(strikeFrom, Math.round(L.hitY) + 0.5);
    g.lineTo(L.endX + 10, Math.round(L.hitY) + 0.5);
    g.stroke();

    this.paintBoard(g, L);
    this.paintInlays(g, L);
    this.paintFrets(g, L);
    this.paintNut(g, L);
  }

  private traceBoard(g: Ctx2D, L: FretboardLayout): void {
    const nut = boardEdgesAt(L, L.nutX);
    const end = boardEdgesAt(L, L.endX);
    g.beginPath();
    g.moveTo(L.nutX, nut.top);
    g.lineTo(L.endX, end.top);
    g.lineTo(L.endX, end.bottom);
    g.lineTo(L.nutX, nut.bottom);
    g.closePath();
  }

  private paintBoard(g: Ctx2D, L: FretboardLayout): void {
    const P = this.palette;
    const nut = boardEdgesAt(L, L.nutX);
    const end = boardEdgesAt(L, L.endX);

    const wood = g.createLinearGradient(0, L.boardTop, 0, L.boardBottom);
    wood.addColorStop(0, P.woodDark);
    wood.addColorStop(0.5, P.woodLight);
    wood.addColorStop(1, P.woodDark);
    g.fillStyle = wood;
    this.traceBoard(g, L);
    g.fill();

    g.save();
    this.traceBoard(g, L);
    g.clip();

    // Light falls off along the neck.
    const depth = g.createLinearGradient(L.nutX, 0, L.endX, 0);
    depth.addColorStop(0, rgba(P.text, 0.035));
    depth.addColorStop(1, rgba(P.base, 0.38));
    g.fillStyle = depth;
    g.fillRect(L.nutX, L.boardTop, L.endX - L.nutX, L.boardBottom - L.boardTop);

    // Grain: faint streaks along the strings, the same every time.
    const random = lcg(1234 + Math.round(L.width));
    const spanX = L.endX - L.nutX;
    const streaks = Math.round((L.boardBottom - L.boardTop) / 2.4);
    g.lineWidth = 1;
    for (let i = 0; i < streaks; i += 1) {
      const y = L.boardTop + random() * (L.boardBottom - L.boardTop);
      const x0 = L.nutX + random() * spanX * 0.7;
      const x1 = x0 + 30 + random() * spanX * 0.5;
      g.strokeStyle = rgba(random() < 0.5 ? P.woodGrain : P.base, 0.05 + random() * 0.08);
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y + (random() - 0.5) * 1.6);
      g.stroke();
    }

    // When the neck goes on past the right edge, let the board dissolve instead of ending.
    if (L.truncated) {
      const fade = g.createLinearGradient(L.endX - spanX * 0.1, 0, L.endX, 0);
      fade.addColorStop(0, rgba(P.base, 0));
      fade.addColorStop(1, rgba(P.base, 0.8));
      g.fillStyle = fade;
      g.fillRect(L.endX - spanX * 0.1, L.boardTop, spanX * 0.1 + 1, L.boardBottom - L.boardTop);
    }
    g.restore();

    // Edge light: lit from above.
    g.lineWidth = 1.2;
    g.strokeStyle = rgba(P.text, 0.16);
    g.beginPath();
    g.moveTo(L.nutX, nut.top + 0.6);
    g.lineTo(L.endX, end.top + 0.6);
    g.stroke();
    g.strokeStyle = rgba('#000000', 0.55);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(L.nutX, nut.bottom - 0.4);
    g.lineTo(L.endX, end.bottom - 0.4);
    g.stroke();
  }

  /** Position markers, only when the instrument has any (a classical board has none). */
  private paintInlays(g: Ctx2D, L: FretboardLayout): void {
    const P = this.palette;
    const inlays = L.geometry.inlayFrets ?? [];
    if (inlays.length === 0) return;
    const rows = L.stringCount;
    for (const fret of inlays) {
      if (fret < 1 || fret > L.visibleFrets) continue;
      const x0 = L.fretX[fret - 1] ?? 0;
      const x1 = L.fretX[fret] ?? 0;
      const cx = (x0 + x1) / 2;
      const radius = Math.min(L.rowGap * 0.2, (x1 - x0) * 0.17);
      const between = (a: number, b: number): number => (stringYAt(L, a, cx) + stringYAt(L, b, cx)) / 2;
      const ys =
        fret % 12 === 0
          ? [between(2, 3), between(rows - 2, rows - 1)]
          : [(stringYAt(L, 1, cx) + stringYAt(L, rows, cx)) / 2];
      for (const cy of ys) {
        const pearl = g.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
        pearl.addColorStop(0, rgba(P.text, 0.42));
        pearl.addColorStop(1, rgba(P.text, 0.12));
        g.fillStyle = pearl;
        g.beginPath();
        g.arc(cx, cy, radius, 0, TAU);
        g.fill();
      }
    }
  }

  private paintFrets(g: Ctx2D, L: FretboardLayout): void {
    const P = this.palette;
    g.lineCap = 'butt';
    for (let f = 1; f <= L.visibleFrets; f += 1) {
      const x = L.fretX[f] ?? 0;
      const { top, bottom } = boardEdgesAt(L, x);
      g.strokeStyle = rgba('#000000', 0.5);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + 1.7, top + 1);
      g.lineTo(x + 1.7, bottom - 1);
      g.stroke();
      g.strokeStyle = P.fretMetal;
      g.globalAlpha = 0.9;
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(x, top + 0.5);
      g.lineTo(x, bottom - 0.5);
      g.stroke();
      g.globalAlpha = 1;
      g.strokeStyle = rgba(P.text, 0.6);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x - 0.7, top + 0.5);
      g.lineTo(x - 0.7, bottom - 0.5);
      g.stroke();
    }
  }

  private paintNut(g: Ctx2D, L: FretboardLayout): void {
    const P = this.palette;
    const { top, bottom } = boardEdgesAt(L, L.nutX);
    const width = clamp(L.gemRadius * 0.5, 5, 9);
    const bone = g.createLinearGradient(L.nutX - width, 0, L.nutX, 0);
    bone.addColorStop(0, P.nutBone);
    bone.addColorStop(1, P.nutShade);
    g.fillStyle = bone;
    g.fillRect(L.nutX - width, top - 2, width, bottom - top + 4);
    g.fillStyle = rgba(P.text, 0.5);
    g.fillRect(L.nutX - width, top - 2, width, 1);
    // String slots.
    g.fillStyle = rgba('#000000', 0.55);
    for (let s = 1; s <= L.stringCount; s += 1) {
      g.fillRect(L.nutX - width, stringYAt(L, s, L.nutX) - 1, width, 2);
    }
  }

  /** Circled string numbers and open-string pitches. Drawn last so a glowing open string never washes them out. */
  private drawStringLabels(ctx: Ctx2D, L: FretboardLayout): void {
    const P = this.palette;
    ctx.save();
    ctx.lineWidth = 1;
    for (let s = 1; s <= L.stringCount; s += 1) {
      const y = stringYAt(L, s, L.nutX);
      ctx.strokeStyle = rgba(P.textSoft, 0.45);
      ctx.beginPath();
      ctx.arc(13, y, 7, 0, TAU);
      ctx.stroke();
      this.text(ctx, String(s), 13, y, 9.5, rgba(P.textSoft, 0.95), 600);
      const open = L.geometry.strings.find((string) => string.stringNumber === s)?.openMidi;
      if (open !== undefined) this.text(ctx, pitchClassName(open), 29, y, 11, rgba(P.text, 0.82), 700);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------------------------
  // Dynamic layer
  // -------------------------------------------------------------------------------------------

  private text(
    ctx: Ctx2D,
    value: string,
    x: number,
    y: number,
    size: number,
    color: string,
    weight = 700,
    align: CanvasTextAlign = 'center',
  ): void {
    ctx.font = `${weight} ${size}px ${this.font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(value, x, y + 0.5);
  }

  private glowSprite(color: string, radius: number): HTMLCanvasElement | null {
    const quantised = Math.max(2, Math.round(radius / 2) * 2);
    const key = `${color}|${quantised}`;
    const cached = this.glowSprites.get(key);
    if (cached) return cached;
    const size = Math.max(2, Math.ceil(quantised * 2 * this.dpr));
    const canvas = this.createCanvas(size, size);
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const gradient = g.createRadialGradient(quantised, quantised, 0, quantised, quantised, quantised);
    gradient.addColorStop(0, rgba(color, 0.85));
    gradient.addColorStop(0.3, rgba(color, 0.32));
    gradient.addColorStop(1, rgba(color, 0));
    g.fillStyle = gradient;
    g.fillRect(0, 0, quantised * 2, quantised * 2);
    this.glowSprites.set(key, canvas);
    return canvas;
  }

  /** Additive halo around (x, y). */
  private glow(ctx: Ctx2D, x: number, y: number, radius: number, color: string, alpha: number): void {
    if (alpha <= 0.01) return;
    const sprite = this.glowSprite(color, radius);
    if (!sprite) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= Math.min(1, alpha);
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  private drawBeatLines(ctx: Ctx2D, L: FretboardLayout, timeline: Timeline, t: number, lookAhead: number): void {
    const P = this.palette;
    const span = Math.max(0.1, lookAhead - DROP_SECONDS);
    ctx.save();
    ctx.lineWidth = 1;
    for (const mark of beatMarksBetween(timeline, t + DROP_SECONDS, t + lookAhead)) {
      const dt = mark.time - t;
      const y = Math.round(skyY(L, dt, lookAhead)) + 0.5;
      const far = clamp((dt - DROP_SECONDS) / span, 0, 1);
      ctx.globalAlpha = (mark.downbeat ? 1 : 0.5) * (1 - 0.8 * far);
      ctx.strokeStyle = mark.downbeat ? rgba(P.cyan, 0.3) : rgba(P.text, 0.1);
      ctx.beginPath();
      ctx.moveTo(26, y);
      ctx.lineTo(L.endX + 8, y);
      ctx.stroke();
      if (mark.downbeat && mark.measure > 0) {
        this.text(ctx, String(mark.measure), 13, y - 8, 11, P.textSoft, 700);
      }
    }
    ctx.restore();
  }

  /** Shades the frets the left hand covers; returns that window (in frets) for the numerals. */
  private drawHandPosition(
    ctx: Ctx2D,
    L: FretboardLayout,
    timeline: Timeline,
    t: number,
  ): { from: number; to: number } | null {
    const P = this.palette;
    const position = handPositionAt(timeline, t);
    if (!position) return null;

    let window = handWindow(L, position.fret);
    let alpha = 1;
    const before = position.start > 0 ? handPositionAt(timeline, position.start - 1e-6) : null;
    if (before && before !== position && t - position.start < SHIFT_SECONDS) {
      const k = easeInOut(clamp((t - position.start) / SHIFT_SECONDS, 0, 1));
      const from = handWindow(L, before.fret);
      if (window && from) window = { x0: lerp(from.x0, window.x0, k), x1: lerp(from.x1, window.x1, k) };
      else if (window) alpha = k;
      else if (from) {
        window = from;
        alpha = 1 - k;
      }
    }
    if (!window) return null;

    const bottom = L.boardBottom + 4;
    const band = ctx.createLinearGradient(0, 0, 0, bottom);
    band.addColorStop(0, rgba(P.amber, 0));
    band.addColorStop(clamp(L.hitY / bottom, 0, 1), rgba(P.amber, 0.04));
    band.addColorStop(clamp(L.boardTop / bottom, 0, 1), rgba(P.amber, 0.07));
    band.addColorStop(1, rgba(P.amber, 0.12));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = band;
    ctx.fillRect(window.x0, 0, window.x1 - window.x0, bottom);

    // A bracket around the window on the board: the hand's reach, readable without hiding the wood.
    const left = boardEdgesAt(L, window.x0);
    const right = boardEdgesAt(L, window.x1);
    ctx.strokeStyle = rgba(P.amber, 0.7);
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(window.x0, left.top + 7);
    ctx.lineTo(window.x0, left.top - 3);
    ctx.lineTo(window.x1, right.top - 3);
    ctx.lineTo(window.x1, right.top + 7);
    ctx.moveTo(window.x0, left.bottom - 7);
    ctx.lineTo(window.x0, left.bottom + 3);
    ctx.lineTo(window.x1, right.bottom + 3);
    ctx.lineTo(window.x1, right.bottom - 7);
    ctx.stroke();
    ctx.restore();
    return { from: position.fret, to: position.fret + 3 };
  }

  private drawFretNumerals(
    ctx: Ctx2D,
    L: FretboardLayout,
    active: readonly PlacedNote[],
    hand: { from: number; to: number } | null,
  ): void {
    const P = this.palette;
    const lit = new Set<number>();
    for (const note of active) if (note.fret > 0) lit.add(note.fret);
    const inlays = new Set(L.geometry.inlayFrets ?? []);
    for (let f = 1; f <= L.visibleFrets; f += 1) {
      const x0 = L.fretX[f - 1] ?? 0;
      const x1 = L.fretX[f] ?? 0;
      const space = x1 - x0;
      const isLit = lit.has(f);
      if (space < 17 && !isLit && f % 2 === 0 && !inlays.has(f)) continue;
      const inHand = hand !== null && f >= hand.from && f <= hand.to;
      const color = isLit ? P.cyan : inHand ? rgba(P.amber, 0.95) : rgba(P.textSoft, inlays.has(f) ? 0.95 : 0.72);
      this.text(ctx, String(f), (x0 + x1) / 2, L.labelY, clamp(space * 0.34, 9, 12.5), color, isLit ? 800 : 600);
    }
  }

  private drawSustainTails(ctx: Ctx2D, L: FretboardLayout, falling: readonly FallingGem[], lookAhead: number): void {
    ctx.save();
    for (const gem of falling) {
      const duration = gem.note.offset - gem.note.onset;
      if (duration < 0.35) continue;
      const top = Math.max(L.skyTop - 6, skyY(L, gem.dt + duration, lookAhead));
      if (top >= gem.y) continue;
      const color = approachColor(this.palette, gem.u);
      const width = gem.r * 0.55;
      const tail = ctx.createLinearGradient(0, gem.y, 0, top);
      tail.addColorStop(0, rgba(color, 0.34));
      tail.addColorStop(1, rgba(color, 0));
      ctx.globalAlpha = gem.alpha;
      ctx.fillStyle = tail;
      ctx.beginPath();
      roundedRect(ctx, gem.landing.x - width / 2, top, width, gem.y - top, width / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawConnectors(
    ctx: Ctx2D,
    L: FretboardLayout,
    timeline: Timeline,
    active: readonly PlacedNote[],
    upcoming: readonly PlacedNote[],
    t: number,
  ): void {
    const P = this.palette;
    const draw = (note: PlacedNote, alpha: number): void => {
      for (const technique of note.techniques ?? []) {
        if (technique.kind !== 'slide' && technique.kind !== 'hammer-on' && technique.kind !== 'pull-off') continue;
        const source = technique.fromNote === undefined ? undefined : timeline.noteById.get(technique.fromNote);
        if (!source) continue;
        const a = notePoint(L, source.string, source.fret);
        const b = notePoint(L, note.string, note.fret);
        const r = gemRadiusFor(L, note.fret);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = P.magenta;
        ctx.fillStyle = P.magenta;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (technique.kind === 'slide') {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        } else {
          const lift = r * 1.7 + Math.abs(b.x - a.x) * 0.1;
          ctx.moveTo(a.x, a.y - r * 0.6);
          ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - lift, b.x, b.y - r * 0.6);
        }
        ctx.stroke();
        ctx.restore();
      }
    };
    for (const note of active) {
      const age = t - note.onset;
      if (age < CONNECTOR_SECONDS) draw(note, 0.9 * (1 - age / CONNECTOR_SECONDS));
    }
    for (const note of upcoming) {
      const dt = note.onset - t;
      if (dt <= GHOST_SECONDS) draw(note, 0.35 * (1 - dt / GHOST_SECONDS) + 0.1);
    }
  }

  private drawStrings(
    ctx: Ctx2D,
    L: FretboardLayout,
    active: readonly PlacedNote[],
    t: number,
    reduced: boolean,
  ): void {
    const P = this.palette;
    const n = L.stringCount;
    const sounding = new Map<number, { note: PlacedNote; age: number; env: number }>();
    for (const note of active) {
      const sinceEnd = t - note.offset;
      sounding.set(note.string, {
        note,
        age: Math.max(0, t - note.onset),
        env: sinceEnd > 0 ? Math.max(0, 1 - sinceEnd / NOTE_TAIL_SECONDS) : 1,
      });
    }

    const xStub = L.openX - L.gemRadius - 6;
    const xEnd = L.width + 4;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let s = n; s >= 1; s -= 1) {
      const y0 = stringYAt(L, s, L.nutX);
      const y1 = stringYAt(L, s, xEnd);
      const slope = (y1 - y0) / (xEnd - L.nutX);
      const t01 = n > 1 ? (s - 1) / (n - 1) : 0;
      const width = lerp(1.1, 3.1, t01) * (L.rowGap < 28 ? 0.85 : 1);
      const wound = s > n / 2;
      const live = sounding.get(s);
      const body = wound ? P.bronze : P.steel;

      // Headstock side of the nut.
      ctx.strokeStyle = rgba(body, 0.4);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(xStub, y0);
      ctx.lineTo(L.nutX, y0);
      ctx.stroke();

      const node = live ? (live.note.fret > 0 ? (L.fretX[live.note.fret] ?? L.nutX) : L.nutX) : L.nutX;
      const decay = live ? 0.45 + 0.55 * Math.exp(-live.age / 0.5) : 0;
      const amplitude =
        live && !reduced
          ? Math.min(L.rowGap * 0.16, 3.2) *
            (isVibrato(live.note) ? 1.7 : 1) *
            Math.max(isVibrato(live.note) ? 0.5 : 0, Math.exp(-live.age / 0.55)) *
            live.env
          : 0;

      if (live) {
        // The ringing part of the string glows, fading with distance from the finger.
        const halo = ctx.createLinearGradient(node, 0, xEnd, 0);
        halo.addColorStop(0, rgba(P.cyan, 0.5 * decay * live.env));
        halo.addColorStop(1, rgba(P.cyan, 0.1 * decay * live.env));
        ctx.strokeStyle = halo;
        ctx.lineWidth = width + 4;
        ctx.beginPath();
        ctx.moveTo(node - 2, y0 + slope * (node - 2 - L.nutX));
        ctx.lineTo(xEnd, y1);
        ctx.stroke();
      }

      const trace = (): void => {
        ctx.beginPath();
        ctx.moveTo(L.nutX, y0);
        if (amplitude > 0.05 && live) {
          const reach = Math.min(xEnd - node, 340);
          const phase = Math.cos(TAU * 9 * live.age);
          for (let x = Math.max(L.nutX, node); x <= xEnd; x += 7) {
            const shape = x < node + reach ? Math.sin((Math.PI * (x - node)) / reach) : 0;
            ctx.lineTo(x, y0 + slope * (x - L.nutX) + amplitude * shape * phase);
          }
        }
        ctx.lineTo(xEnd, y1);
      };

      ctx.strokeStyle = live ? mix(body, P.cyan, 0.55 * decay * live.env) : body;
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = width;
      trace();
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (wound) {
        ctx.setLineDash([1.4, 1.7]);
        ctx.strokeStyle = rgba(P.bronzeLight, 0.55);
        ctx.lineWidth = width * 0.5;
        trace();
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = rgba(P.text, 0.3);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(L.nutX, y0 - width * 0.25);
        ctx.lineTo(xEnd, y1 - width * 0.25);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawLandingRings(ctx: Ctx2D, falling: readonly FallingGem[]): void {
    const seen = new Set<string>();
    ctx.save();
    ctx.lineCap = 'round';
    for (const gem of falling) {
      if (gem.dt > GHOST_SECONDS) break;
      const key = `${gem.note.string}:${gem.note.fret}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const progress = 1 - gem.dt / GHOST_SECONDS;
      const color = approachColor(this.palette, 1 - progress);
      const r = gem.landingR + 2;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = rgba(color, 0.22 + 0.5 * progress);
      ctx.beginPath();
      ctx.arc(gem.landing.x, gem.landing.y, r, 0, TAU);
      ctx.stroke();
      // The ring closes clockwise from twelve o'clock as the onset nears.
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = rgba(this.palette.cyan, 0.95 * progress);
      ctx.beginPath();
      ctx.arc(gem.landing.x, gem.landing.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
      ctx.stroke();
      ctx.fillStyle = rgba(color, 0.07 + 0.1 * progress);
      ctx.beginPath();
      ctx.arc(gem.landing.x, gem.landing.y, r - 1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBarre(ctx: Ctx2D, L: FretboardLayout, timeline: Timeline, t: number): void {
    const barre = activeBarreAt(timeline, t);
    if (!barre || barre.fret < 1) return;
    const P = this.palette;
    const x = noteX(L, barre.fret);
    const r = gemRadiusFor(L, barre.fret);
    const yA = stringYAt(L, clamp(Math.round(barre.fromString), 1, L.stringCount), x);
    const yB = stringYAt(L, clamp(Math.round(barre.toString), 1, L.stringCount), x);
    const top = Math.min(yA, yB) - r * 0.95;
    const bottom = Math.max(yA, yB) + r * 0.95;
    const width = r * 1.5;

    this.glow(ctx, x, (top + bottom) / 2, Math.max(r * 2.4, (bottom - top) * 0.62), P.magenta, 0.2);
    const bar = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
    bar.addColorStop(0, mix(P.magenta, P.base, 0.45));
    bar.addColorStop(0.45, mix(P.magenta, P.text, 0.25));
    bar.addColorStop(1, mix(P.magenta, P.base, 0.55));
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = bar;
    ctx.beginPath();
    roundedRect(ctx, x - width / 2, top, width, bottom - top, width / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba(P.text, 0.4);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  private drawActiveGems(
    ctx: Ctx2D,
    L: FretboardLayout,
    timeline: Timeline,
    active: readonly PlacedNote[],
    t: number,
    reduced: boolean,
  ): void {
    const P = this.palette;
    for (const note of active) {
      const age = Math.max(0, t - note.onset);
      const sinceEnd = t - note.offset;
      const fade = sinceEnd > 0 ? Math.max(0, 1 - sinceEnd / NOTE_TAIL_SECONDS) : 1;
      if (fade <= 0) continue;

      const base = notePoint(L, note.string, note.fret);
      const r0 = gemRadiusFor(L, note.fret);
      const r = r0 * (reduced ? 1 : 1 + 0.2 * Math.exp(-age / 0.07));
      const vibrato = vibratoOf(note);
      const dy = vibrato && !reduced ? Math.sin(TAU * (vibrato.rateHz ?? 5.5) * age) * Math.min(r * 0.2, 2.6) : 0;
      const x = base.x;
      const y = base.y + dy;
      const flare = Math.exp(-age / 0.12);
      const settle = 0.62 + 0.38 * Math.exp(-age / 0.6);

      ctx.save();
      ctx.globalAlpha = fade;
      this.glow(ctx, x, y, r * 2.7, P.cyan, (0.4 + 0.4 * flare) * settle);

      if (!reduced && age < RIPPLE_SECONDS) {
        const k = age / RIPPLE_SECONDS;
        ctx.strokeStyle = rgba(P.cyan, 0.6 * (1 - k));
        ctx.lineWidth = 2 * (1 - k) + 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r + k * r0 * 1.9, 0, TAU);
        ctx.stroke();
      }

      if (note.fret === 0) {
        ctx.fillStyle = rgba(P.cyan, 0.2 + 0.25 * flare);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = mix(P.cyan, P.text, 0.35 * flare);
        ctx.lineWidth = 2.4;
        ctx.stroke();
        this.text(ctx, '0', x, y, r * 1.1, mix(P.cyan, P.text, 0.3), 800);
      } else {
        const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.15);
        body.addColorStop(0, mix(P.cyan, P.text, 0.35 + 0.5 * flare));
        body.addColorStop(0.5, P.cyan);
        body.addColorStop(1, mix(P.cyan, P.base, 0.5));
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(P.text, 0.35 + 0.4 * flare);
        ctx.lineWidth = 1.4;
        ctx.stroke();
        this.fingerMark(ctx, note, x, y, r, P.base);
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = fade;
      this.annotate(ctx, L, timeline, note, x, y, r, true);
      ctx.restore();
    }
  }

  /** The left-hand finger number inside a gem (a dot when the finger is not known or not used). */
  private fingerMark(ctx: Ctx2D, note: PlacedNote, x: number, y: number, r: number, color: string): void {
    const finger = note.lhFinger;
    if (typeof finger === 'number' && finger >= 1) {
      this.text(ctx, String(finger), x, y, Math.max(8, r * 1.15), color, 800);
    } else {
      ctx.fillStyle = rgba(color, 0.75);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.6, r * 0.16), 0, TAU);
      ctx.fill();
    }
  }

  /** Where the right-hand finger letter goes: just right of the gem, or left of it at the edge. */
  private pillBox(
    L: FretboardLayout,
    x: number,
    y: number,
    r: number,
  ): { x: number; y: number; w: number; h: number; size: number } {
    const size = Math.max(8.5, r * 0.72);
    const w = size * 0.62 + 9;
    const h = size + 5;
    const left = x + r + 3;
    return { x: left + w > L.width - 2 ? x - r - 3 - w : left, y: y - h / 2, w, h, size };
  }

  /** Right-hand finger letter beside the gem and technique glyphs at its corners. */
  private annotate(
    ctx: Ctx2D,
    L: FretboardLayout,
    timeline: Timeline,
    note: PlacedNote,
    x: number,
    y: number,
    r: number,
    showPill: boolean,
  ): void {
    const P = this.palette;
    if (note.rhFinger && showPill) {
      const box = this.pillBox(L, x, y, r);
      ctx.fillStyle = rgba(P.base, 0.84);
      ctx.strokeStyle = rgba(P.text, 0.38);
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundedRect(ctx, box.x, box.y, box.w, box.h, box.h / 2);
      ctx.fill();
      ctx.stroke();
      this.text(ctx, note.rhFinger, box.x + box.w / 2, y, box.size, P.text, 700);
    }
    const glyphs = glyphsForNote(note, timeline.strumLeads.has(note.id));
    glyphs.forEach((glyph, i) => {
      const gx = x - r * 0.95;
      const gy = y + (i === 0 ? -1 : 1) * r * 1.0;
      const size = Math.max(4.5, r * 0.42);
      ctx.fillStyle = rgba(P.base, 0.88);
      ctx.strokeStyle = rgba(P.magenta, 0.65);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gx, gy, size * 1.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
      drawGlyph(ctx, glyph, gx, gy, size, P.magenta, this.font);
    });
  }

  /** Where each upcoming note is, with gems that would sit on top of each other fanned out sideways. */
  private layoutFalling(
    L: FretboardLayout,
    upcoming: readonly PlacedNote[],
    t: number,
    lookAhead: number,
  ): FallingGem[] {
    const span = Math.max(0.1, lookAhead - DROP_SECONDS);
    const gems: FallingGem[] = upcoming.map((note) => {
      const dt = note.onset - t;
      const landing = notePoint(L, note.string, note.fret);
      const u = clamp((dt - DROP_SECONDS) / span, 0, 1);
      const landingR = gemRadiusFor(L, note.fret);
      return {
        note,
        dt,
        u,
        r: landingR * (1 - 0.34 * u),
        alpha: 0.18 + 0.82 * clamp((1 - u) / 0.28, 0, 1),
        landing,
        landingR,
        x: landing.x,
        y: gemY(L, dt, lookAhead, landing.y),
      };
    });

    // Nearest first: the gems about to sound keep their exact column, farther ones make room.
    const placed: FallingGem[] = [];
    for (const gem of gems) {
      const step = gem.r * 1.9;
      const settle = clamp((L.hitY - gem.y) / (gem.r * 1.5), 0, 1);
      for (const offset of [0, step, -step, 2 * step, -2 * step]) {
        const x = gem.landing.x + offset * settle;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - gem.y) >= (p.r + gem.r) * 0.95)) {
          gem.x = x;
          break;
        }
      }
      placed.push(gem);
    }
    return gems;
  }

  private drawFallingGems(ctx: Ctx2D, L: FretboardLayout, timeline: Timeline, falling: readonly FallingGem[]): void {
    const P = this.palette;

    // Right-hand letters only for notes that are close, and never two on top of each other (a strum
    // is six gems in one column: one letter says it).
    const taken: { x: number; y: number; w: number; h: number }[] = [];
    const showPill = new Set<number>();
    falling.forEach((gem, i) => {
      if (!gem.note.rhFinger || gem.dt > PILL_SECONDS) return;
      const box = this.pillBox(L, gem.x, gem.y, gem.r);
      const clear = taken.every(
        (b) => box.x >= b.x + b.w || box.x + box.w <= b.x || box.y >= b.y + b.h || box.y + box.h <= b.y,
      );
      if (!clear) return;
      taken.push(box);
      showPill.add(i);
    });

    // Far ones first so the nearest end up on top.
    for (let i = falling.length - 1; i >= 0; i -= 1) {
      const gem = falling[i];
      if (!gem) continue;
      const color = approachColor(P, gem.u);
      const { x, y, r } = gem;

      ctx.save();
      ctx.globalAlpha = gem.alpha;

      if (gem.dt <= GHOST_SECONDS && y + r < gem.landing.y - gem.landingR) {
        ctx.strokeStyle = rgba(color, 0.4);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(x, y + r);
        ctx.lineTo(gem.landing.x, gem.landing.y - gem.landingR);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      this.glow(ctx, x, y, r * 2.3, color, 0.3);
      ctx.fillStyle = rgba(P.base, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(color, 0.2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = gem.note.fret === 0 ? 2.6 : 2;
      ctx.stroke();
      if (gem.note.fret === 0) {
        this.text(ctx, '0', x, y, Math.max(8, r * 1.1), color, 800);
      } else {
        this.fingerMark(ctx, gem.note, x, y, r, P.text);
      }
      ctx.restore();

      if (gem.u < 0.55) {
        ctx.save();
        ctx.globalAlpha = gem.alpha;
        this.annotate(ctx, L, timeline, gem.note, x, y, r, showPill.has(i));
        ctx.restore();
      }
    }
  }

  /** Percussive events (golpe, tambora) fall in the strip right of the board, where the body is. */
  private drawEvents(
    ctx: Ctx2D,
    L: FretboardLayout,
    timeline: Timeline,
    t: number,
    lookAhead: number,
    reduced: boolean,
  ): void {
    const P = this.palette;
    const r = Math.max(8, L.gemRadius * 0.8);
    const x = L.bodyX;
    ctx.save();
    for (const event of eventsBetween(timeline, t, t + lookAhead)) {
      const dt = event.time - t;
      const u = clamp((dt - DROP_SECONDS) / Math.max(0.1, lookAhead - DROP_SECONDS), 0, 1);
      const y = gemY(L, dt, lookAhead, L.centerY);
      ctx.globalAlpha = 0.2 + 0.8 * clamp((1 - u) / 0.28, 0, 1);
      ctx.fillStyle = rgba(P.base, 0.9);
      ctx.strokeStyle = P.magenta;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * (1 - 0.3 * u), 0, TAU);
      ctx.fill();
      ctx.stroke();
      drawGlyph(ctx, 'tambora', x, y, r * 0.42 * (1 - 0.3 * u), P.magenta, this.font);
    }
    for (const event of eventsBetween(timeline, t - FLASH_SECONDS, t)) {
      const k = clamp((t - event.time) / FLASH_SECONDS, 0, 1);
      ctx.globalAlpha = 1 - k;
      this.glow(ctx, x, L.centerY, r * 3.2, P.magenta, 0.7);
      ctx.strokeStyle = P.magenta;
      ctx.lineWidth = 2.4 * (1 - k) + 0.6;
      ctx.beginPath();
      ctx.arc(x, L.centerY, r * (reduced ? 1.2 : 1 + k * 1.8), 0, TAU);
      ctx.stroke();
      drawGlyph(ctx, 'tambora', x, L.centerY, r * 0.5, P.text, this.font);
    }
    ctx.restore();
  }
}

function vibratoOf(note: PlacedNote): { readonly rateHz?: number } | null {
  return (note.techniques ?? []).find((technique) => technique.kind === 'vibrato') ?? null;
}

function isVibrato(note: PlacedNote): boolean {
  return vibratoOf(note) !== null;
}
