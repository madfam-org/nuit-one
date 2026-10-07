import type { GuitarTechnique } from '@nuit-one/shared';
import { describe, expect, it } from 'vitest';
import { glyphsForNote } from './glyphs.js';

const note = (...techniques: GuitarTechnique[]) => ({ techniques });

describe('glyphsForNote', () => {
  it('maps each technique to its glyph', () => {
    expect(glyphsForNote(note({ kind: 'slide', direction: 'up' }))).toEqual(['slide-up']);
    expect(glyphsForNote(note({ kind: 'slide', direction: 'down' }))).toEqual(['slide-down']);
    expect(glyphsForNote(note({ kind: 'slide' }))).toEqual(['slide-up']);
    expect(glyphsForNote(note({ kind: 'hammer-on' }))).toEqual(['hammer']);
    expect(glyphsForNote(note({ kind: 'pull-off' }))).toEqual(['pull']);
    expect(glyphsForNote(note({ kind: 'vibrato', rateHz: 5.5 }))).toEqual(['vibrato']);
    expect(glyphsForNote(note({ kind: 'harmonic', harmonicFret: 12 }))).toEqual(['harmonic']);
    expect(glyphsForNote(note({ kind: 'tambora' }))).toEqual(['tambora']);
    expect(glyphsForNote(note({ kind: 'bend' }))).toEqual(['bend']);
  });

  it('draws rasgueado and strum arrows by direction (down by default)', () => {
    expect(glyphsForNote(note({ kind: 'rasgueado', direction: 'down' }))).toEqual(['strum-down']);
    expect(glyphsForNote(note({ kind: 'rasgueado', direction: 'up' }))).toEqual(['strum-up']);
    expect(glyphsForNote(note({ kind: 'strum' }))).toEqual(['strum-down']);
  });

  it('gives a stroke one arrow: only its lead note carries it', () => {
    expect(glyphsForNote(note({ kind: 'rasgueado', direction: 'down' }), false)).toEqual([]);
    expect(glyphsForNote(note({ kind: 'rasgueado', direction: 'down' }), true)).toEqual(['strum-down']);
  });

  it('shows nothing for techniques that have no glyph, and for plain notes', () => {
    expect(glyphsForNote(note({ kind: 'let-ring' }, { kind: 'staccato' }, { kind: 'accent' }))).toEqual([]);
    expect(glyphsForNote({})).toEqual([]);
    expect(glyphsForNote({ techniques: [] })).toEqual([]);
  });

  it('never stacks more than two, and never repeats one', () => {
    expect(
      glyphsForNote(note({ kind: 'vibrato' }, { kind: 'harmonic' }, { kind: 'bend' }, { kind: 'tambora' })),
    ).toEqual(['vibrato', 'harmonic']);
    expect(glyphsForNote(note({ kind: 'vibrato' }, { kind: 'vibrato' }, { kind: 'harmonic' }))).toEqual([
      'vibrato',
      'harmonic',
    ]);
  });
});
