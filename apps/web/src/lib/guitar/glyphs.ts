/**
 * Technique glyphs for the fretboard: slide /, hammer-on H, pull-off P, vibrato ~, harmonic ◇,
 * rasgueado ↓ ↑, tambora ✕, bend. They are drawn as vector strokes rather than text so they look the
 * same on every system whatever fonts it has; only H and P are letters.
 */

import type { GuitarNote } from '@nuit-one/shared';

export type GlyphKind =
  | 'slide-up'
  | 'slide-down'
  | 'hammer'
  | 'pull'
  | 'vibrato'
  | 'harmonic'
  | 'strum-down'
  | 'strum-up'
  | 'tambora'
  | 'bend';

const MAX_GLYPHS_PER_NOTE = 2;

/**
 * The glyphs a note carries, most informative first. A strum or rasgueado stroke touches several
 * notes but is announced once: only the stroke's lead note gets its arrow.
 */
export function glyphsForNote(note: Pick<GuitarNote, 'techniques'>, isStrumLead = true): GlyphKind[] {
  const found: GlyphKind[] = [];
  for (const technique of note.techniques ?? []) {
    let glyph: GlyphKind | null = null;
    switch (technique.kind) {
      case 'slide':
        glyph = technique.direction === 'down' ? 'slide-down' : 'slide-up';
        break;
      case 'hammer-on':
        glyph = 'hammer';
        break;
      case 'pull-off':
        glyph = 'pull';
        break;
      case 'vibrato':
        glyph = 'vibrato';
        break;
      case 'harmonic':
        glyph = 'harmonic';
        break;
      case 'rasgueado':
      case 'strum':
        glyph = isStrumLead ? (technique.direction === 'up' ? 'strum-up' : 'strum-down') : null;
        break;
      case 'tambora':
        glyph = 'tambora';
        break;
      case 'bend':
        glyph = 'bend';
        break;
      default:
        break;
    }
    if (glyph && !found.includes(glyph)) found.push(glyph);
  }
  return found.slice(0, MAX_GLYPHS_PER_NOTE);
}

/** Draw a glyph centred on (cx, cy) within a box of half-size `size`. */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  kind: GlyphKind,
  cx: number,
  cy: number,
  size: number,
  color: string,
  fontFamily: string,
): void {
  const s = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.3, s * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (kind) {
    case 'slide-up':
      ctx.moveTo(cx - s, cy + s);
      ctx.lineTo(cx + s, cy - s);
      break;
    case 'slide-down':
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      break;
    case 'vibrato':
      ctx.moveTo(cx - s, cy + s * 0.15);
      ctx.bezierCurveTo(cx - s * 0.6, cy - s * 1.0, cx - s * 0.15, cy - s * 1.0, cx, cy);
      ctx.bezierCurveTo(cx + s * 0.15, cy + s * 1.0, cx + s * 0.6, cy + s * 1.0, cx + s, cy - s * 0.15);
      break;
    case 'harmonic':
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s * 0.8, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s * 0.8, cy);
      ctx.closePath();
      break;
    case 'strum-down':
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx, cy + s);
      ctx.moveTo(cx - s * 0.65, cy + s * 0.3);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx + s * 0.65, cy + s * 0.3);
      break;
    case 'strum-up':
      ctx.moveTo(cx, cy + s);
      ctx.lineTo(cx, cy - s);
      ctx.moveTo(cx - s * 0.65, cy - s * 0.3);
      ctx.lineTo(cx, cy - s);
      ctx.lineTo(cx + s * 0.65, cy - s * 0.3);
      break;
    case 'tambora':
      ctx.moveTo(cx - s * 0.85, cy - s * 0.85);
      ctx.lineTo(cx + s * 0.85, cy + s * 0.85);
      ctx.moveTo(cx + s * 0.85, cy - s * 0.85);
      ctx.lineTo(cx - s * 0.85, cy + s * 0.85);
      break;
    case 'bend':
      ctx.moveTo(cx - s * 0.9, cy + s);
      ctx.quadraticCurveTo(cx + s * 0.9, cy + s * 0.7, cx + s * 0.7, cy - s * 0.7);
      ctx.moveTo(cx + s * 0.1, cy - s * 0.35);
      ctx.lineTo(cx + s * 0.7, cy - s * 0.9);
      ctx.lineTo(cx + s * 1.1, cy - s * 0.2);
      break;
    case 'hammer':
    case 'pull':
      break;
  }
  if (kind === 'hammer' || kind === 'pull') {
    ctx.font = `700 ${Math.round(s * 2.1)}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'hammer' ? 'H' : 'P', cx, cy + s * 0.08);
  } else {
    ctx.stroke();
  }
  ctx.restore();
}
