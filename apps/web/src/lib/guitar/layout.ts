/**
 * Pure mapping from the guitar twin's geometry (millimetres) to pixels for a horizontal fretboard:
 * nut at the left, body to the right, string 1 at the top like tablature.
 *
 * Fret wires sit at the instrument's real equal-tempered positions (`fretPositionsMm`), so the
 * spaces shrink toward the body exactly as they do on the neck. Across the neck the scale is
 * exaggerated (six strings need rows a finger-wide) but the taper and the string fan are the
 * twin's own: the board is a trapezoid, the strings diverge toward the bridge.
 *
 * Above the board is the "sky" where upcoming notes fall along their fret column.
 */

import type { GuitarGeometryDoc } from '@nuit-one/shared';
import { fretDistanceMm, neckHalfWidthMm, stringYMm } from '@nuit-one/shared';

/** Seconds a note takes to drop from the board's top edge onto its string. */
export const DROP_SECONDS = 0.18;

const MIN_VISIBLE_FRETS = 7;
/** Frets shown beyond the highest fret the piece uses. */
const FRET_MARGIN = 2;
/** Height reserved under the board for the fret numerals. */
const LABEL_BAND = 24;
const BOTTOM_PAD = 8;
const MIN_GEM_RADIUS = 6.5;
/** Width at the far left for the circled string number and the open-string pitch name ("C#"). */
const LABEL_ZONE = 38;

export interface LayoutOptions {
  /** CSS pixels of the drawing surface. */
  readonly width: number;
  readonly height: number;
  /** Frets to show, 1..fretCount. */
  readonly visibleFrets: number;
  /** Desired string spacing at the nut in px; shrinks if the board would not fit. */
  readonly rowGapTarget?: number;
}

export interface FretboardLayout {
  readonly width: number;
  readonly height: number;
  readonly geometry: GuitarGeometryDoc;
  readonly stringCount: number;
  /** Frets drawn: 1..visibleFrets. */
  readonly visibleFrets: number;
  /** True when the neck continues past the right edge (more frets exist than are shown). */
  readonly truncated: boolean;
  /** Width left of the nut: string labels and the open-string column. */
  readonly gutter: number;
  readonly nutX: number;
  /** x of fret wire `visibleFrets`. */
  readonly endX: number;
  /** Centre of the strip right of the board where percussive events (golpe) land. */
  readonly bodyX: number;
  /** x of the nut and of every fret wire of the instrument (some may lie beyond the canvas). */
  readonly fretX: readonly number[];
  /** Pixels per millimetre along the neck. */
  readonly xScale: number;
  /** Pixels per millimetre across the neck (exaggerated relative to `xScale`). */
  readonly yScale: number;
  readonly centerY: number;
  /** Bounding box of the board (it is widest at its far end). */
  readonly boardTop: number;
  readonly boardBottom: number;
  /** String spacing at the nut. */
  readonly rowGap: number;
  /** Largest gem radius; gems shrink to fit narrow fret spaces. */
  readonly gemRadius: number;
  /** x where open-string gems sit: just left of the nut. */
  readonly openX: number;
  /** y where a falling note reaches the board's top edge. */
  readonly hitY: number;
  /** Top of the usable sky. */
  readonly skyTop: number;
  /** Baseline of the fret numerals. */
  readonly labelY: number;
  /** Index into `geometry.strings` (lowest string first) by player string number; index 0 is unused. */
  readonly stringIndex: readonly number[];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Frets to show: the highest fret the piece uses plus a margin, never more than the neck has. */
export function visibleFretCount(notes: Iterable<{ readonly fret: number }>, fretCount: number): number {
  let highest = 0;
  for (const note of notes) highest = Math.max(highest, note.fret);
  return clamp(highest + FRET_MARGIN, Math.min(MIN_VISIBLE_FRETS, fretCount), Math.max(1, fretCount));
}

/** The nut and every fret in mm from the nut: the document's list, or derived from the scale length. */
function fretPositions(geometry: GuitarGeometryDoc): readonly number[] {
  if (geometry.fretPositionsMm.length >= 2) return geometry.fretPositionsMm;
  const count = Math.max(1, geometry.fretCount);
  return Array.from({ length: count + 1 }, (_, n) => fretDistanceMm(geometry.scaleLengthMm, n));
}

export function createLayout(geometry: GuitarGeometryDoc, options: LayoutOptions): FretboardLayout {
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const stringCount = Math.max(1, geometry.strings.length);

  const positions = fretPositions(geometry);
  const lastFret = positions.length - 1;
  const visibleFrets = clamp(Math.round(options.visibleFrets), 1, lastFret);
  const origin = positions[0] ?? 0;
  const visibleMm = Math.max(1e-6, (positions[visibleFrets] ?? 0) - origin);

  // Vertical budget: sky on top, then the board, then the fret numerals.
  const nutHalfMm = neckHalfWidthMm(geometry, 0);
  const endHalfMm = neckHalfWidthMm(geometry, visibleMm);
  const halfMax = Math.max(nutHalfMm, endHalfMm, 1e-6);
  const spreadNutMm = stringCount > 1 ? stringYMm(geometry, stringCount - 1, 0) - stringYMm(geometry, 0, 0) : 0;
  const rowGapTarget = options.rowGapTarget ?? clamp(height * 0.064, 24, 42);
  const maxBoardHeight = Math.max(40, height - LABEL_BAND - BOTTOM_PAD - Math.max(110, height * 0.3));

  let yScale = spreadNutMm > 0 ? (rowGapTarget * (stringCount - 1)) / spreadNutMm : rowGapTarget / 8;
  if (2 * halfMax * yScale > maxBoardHeight) yScale = maxBoardHeight / (2 * halfMax);
  const boardHeight = 2 * halfMax * yScale;
  const centerY = height - BOTTOM_PAD - LABEL_BAND - boardHeight / 2;
  const boardTop = centerY - boardHeight / 2;
  const boardBottom = centerY + boardHeight / 2;
  const rowGap = stringCount > 1 ? (spreadNutMm * yScale) / (stringCount - 1) : rowGapTarget;

  // Horizontal budget: gutter (labels + open strings), the neck, a strip for the body.
  const radiusCap = rowGap * 0.46;
  const gutter = clamp(Math.max(width * 0.07, LABEL_ZONE + 2 * radiusCap + 17), 56, Math.max(56, width * 0.22));
  const bodyMargin = clamp(width * 0.04, 24, 44);
  const nutX = gutter;
  const endX = Math.max(nutX + 40, width - bodyMargin);
  const xScale = (endX - nutX) / visibleMm;
  const fretX = positions.map((p) => nutX + (p - origin) * xScale);

  const spaces = fretX
    .slice(1, visibleFrets + 1)
    .map((x, i) => x - (fretX[i] ?? x))
    .sort((a, b) => a - b);
  const medianSpace = spaces[Math.floor(spaces.length / 2)] ?? radiusCap * 2;
  const gemRadius = clamp(Math.min(radiusCap, medianSpace * 0.48), MIN_GEM_RADIUS, 22);

  const skyTop = gemRadius + 10;
  const hitY = Math.max(boardTop - gemRadius * 1.15 - 2, skyTop + 30);

  const stringIndex = [-1];
  for (let s = 1; s <= stringCount; s += 1) {
    const found = geometry.strings.findIndex((g) => g.stringNumber === s);
    stringIndex.push(found >= 0 ? found : stringCount - s);
  }

  return {
    width,
    height,
    geometry,
    stringCount,
    visibleFrets,
    truncated: visibleFrets < geometry.fretCount,
    gutter,
    nutX,
    endX,
    bodyX: (endX + width) / 2,
    fretX,
    xScale,
    yScale,
    centerY,
    boardTop,
    boardBottom,
    rowGap,
    gemRadius,
    openX: nutX - gemRadius - 9,
    hitY,
    skyTop,
    labelY: boardBottom + LABEL_BAND * 0.62,
    stringIndex,
  };
}

// ---------------------------------------------------------------------------------------------
// Points on the board
// ---------------------------------------------------------------------------------------------

/** Distance from the nut in mm of the neck cross-section at pixel x. */
function mmAt(layout: FretboardLayout, x: number): number {
  return (x - layout.nutX) / layout.xScale;
}

/** y of a string (player numbering) at pixel x. Strings fan out toward the body. */
export function stringYAt(layout: FretboardLayout, stringNumber: number, x: number): number {
  const index = layout.stringIndex[stringNumber] ?? layout.stringCount - stringNumber;
  return layout.centerY - layout.yScale * stringYMm(layout.geometry, index, Math.max(0, mmAt(layout, x)));
}

/** Top and bottom edge of the fingerboard at pixel x (it widens toward the body joint). */
export function boardEdgesAt(layout: FretboardLayout, x: number): { readonly top: number; readonly bottom: number } {
  const half = neckHalfWidthMm(layout.geometry, Math.max(0, mmAt(layout, x))) * layout.yScale;
  return { top: layout.centerY - half, bottom: layout.centerY + half };
}

/** Left and right wire of the space where a finger presses fret `fret` (1-based). */
export function fretSpace(layout: FretboardLayout, fret: number): { readonly x0: number; readonly x1: number } {
  const last = layout.fretX.length - 1;
  const f = clamp(Math.round(fret), 1, last);
  return { x0: layout.fretX[f - 1] ?? layout.nutX, x1: layout.fretX[f] ?? layout.endX };
}

/** x of a note at `fret`: the middle of its fret space; open strings sit left of the nut. */
export function noteX(layout: FretboardLayout, fret: number): number {
  if (fret <= 0) return layout.openX;
  const { x0, x1 } = fretSpace(layout, fret);
  return (x0 + x1) / 2;
}

export function notePoint(
  layout: FretboardLayout,
  stringNumber: number,
  fret: number,
): { readonly x: number; readonly y: number } {
  const x = noteX(layout, fret);
  // Open strings are drawn on the nut's string line, not at the stub where the gem sits.
  return { x, y: stringYAt(layout, stringNumber, fret <= 0 ? layout.nutX : x) };
}

/** Gem radius at a fret: a finger fills its fret space, so gems shrink toward the body. */
export function gemRadiusFor(layout: FretboardLayout, fret: number): number {
  if (fret <= 0) return layout.gemRadius;
  const { x0, x1 } = fretSpace(layout, fret);
  return clamp((x1 - x0) * 0.5, MIN_GEM_RADIUS, layout.gemRadius);
}

/**
 * The span the left hand covers in a position: four frets from the one under the index finger.
 * Null when the window starts beyond the visible neck; clipped at its right edge.
 */
export function handWindow(
  layout: FretboardLayout,
  indexFret: number,
  span = 4,
): { readonly x0: number; readonly x1: number } | null {
  const first = Math.max(1, Math.round(indexFret));
  const x0 = layout.fretX[first - 1] ?? layout.endX;
  if (x0 >= layout.endX - 1) return null;
  const x1 = layout.fretX[Math.min(first + span - 1, layout.fretX.length - 1)] ?? layout.endX;
  return { x0, x1: Math.min(x1, layout.endX) };
}

// ---------------------------------------------------------------------------------------------
// The sky
// ---------------------------------------------------------------------------------------------

function skyUnitsPerSecond(layout: FretboardLayout, lookAhead: number): number {
  return (layout.hitY - layout.skyTop) / Math.max(0.1, lookAhead - DROP_SECONDS);
}

/**
 * y of something `dt` seconds before its time while it is still falling through the sky: it reaches
 * the board's top edge `DROP_SECONDS` before the note sounds, and the sky top at `lookAhead`.
 */
export function skyY(layout: FretboardLayout, dt: number, lookAhead: number): number {
  return layout.hitY - (dt - DROP_SECONDS) * skyUnitsPerSecond(layout, lookAhead);
}

/**
 * y of an upcoming note: falling through the sky, then dropping onto its string so that it lands
 * exactly at its onset. The drop starts at the sky's speed and accelerates.
 */
export function gemY(layout: FretboardLayout, dt: number, lookAhead: number, landingY: number): number {
  if (dt >= DROP_SECONDS) return skyY(layout, dt, lookAhead);
  const progress = 1 - Math.max(0, dt) / DROP_SECONDS;
  const fall = landingY - layout.hitY;
  if (fall <= 0) return landingY;
  const match = clamp((skyUnitsPerSecond(layout, lookAhead) * DROP_SECONDS) / fall, 0, 1);
  return layout.hitY + fall * (match * progress + (1 - match) * progress * progress);
}
