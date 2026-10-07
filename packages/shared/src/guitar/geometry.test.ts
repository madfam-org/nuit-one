import { describe, expect, it } from 'vitest';
import {
  fretDistanceMm,
  fretFromDistanceMm,
  GUITAR_TWIN_PRESETS,
  instrumentFromTwin,
  neckHalfWidthMm,
  stringYMm,
  twinParametersFromManifest,
} from './geometry.js';

const classical = GUITAR_TWIN_PRESETS['classical-650']!;

describe('fret geometry (same numbers as the Python engine)', () => {
  it('puts fret 12 at half the scale and fret 24 at three quarters', () => {
    expect(fretDistanceMm(650, 12)).toBeCloseTo(325, 9);
    expect(fretDistanceMm(650, 24)).toBeCloseTo(487.5, 9);
  });

  it('matches equal temperament at fret 1 (650 / 17.817 in shop terms)', () => {
    expect(fretDistanceMm(650, 1)).toBeCloseTo(36.4817, 3);
  });

  it('inverts distance back to the fret coordinate', () => {
    for (const fret of [0.5, 3, 7.25, 12, 18.9]) {
      expect(fretFromDistanceMm(648, fretDistanceMm(648, fret))).toBeCloseTo(fret, 9);
    }
    expect(fretFromDistanceMm(650, 650)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('instrumentFromTwin', () => {
  const doc = instrumentFromTwin(classical);

  it('lists the nut and every fret', () => {
    expect(doc.geometry.fretPositionsMm).toHaveLength(20);
    expect(doc.geometry.fretPositionsMm[0]).toBe(0);
    expect(doc.geometry.fretPositionsMm[12]).toBeCloseTo(325, 3);
  });

  it('numbers strings the way players do (1 = highest pitch)', () => {
    expect(doc.geometry.strings[0]?.stringNumber).toBe(6);
    expect(doc.geometry.strings[0]?.openMidi).toBe(40);
    expect(doc.geometry.strings[5]?.stringNumber).toBe(1);
    expect(doc.tuning.openMidi).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it('fans the strings from the nut spread to the saddle spread', () => {
    const g = doc.geometry;
    const nutSpread = stringYMm(g, 5, 0) - stringYMm(g, 0, 0);
    const saddleSpread = stringYMm(g, 5, g.scaleLengthMm) - stringYMm(g, 0, g.scaleLengthMm);
    expect(nutSpread).toBeCloseTo(43, 6);
    expect(saddleSpread).toBeCloseTo(58, 6);
    expect(neckHalfWidthMm(g, 0)).toBeCloseTo(26, 6);
    expect(neckHalfWidthMm(g, 325)).toBeCloseTo(31, 6);
  });

  it('treats the classical board as flat and the electric one as radiused', () => {
    expect(doc.geometry.fingerboardRadiusMm).toBeNull();
    const electric = instrumentFromTwin(GUITAR_TWIN_PRESETS['electric-648']!);
    expect(electric.geometry.fingerboardRadiusMm).toBeCloseTo(241.3, 6);
    expect(electric.geometry.inlayFrets).toContain(12);
  });
});

describe('twinParametersFromManifest', () => {
  it('reads cartridge parameter defaults and keeps the slug as the twin reference', () => {
    const params = twinParametersFromManifest({
      project: { slug: 'guitar-neck' },
      parameters: [
        { id: 'scale_length', default: 647.7 },
        { id: 'fret_count', default: 22 },
        { id: 'frets_to_body', default: 16 },
        { id: 'fingerboard_radius', default: '9.5in' },
        { id: 'tuning', default: 'drop-d' },
      ],
    });
    expect(params.scale_length).toBe(647.7);
    expect(params.fret_count).toBe(22);
    expect(params.nut_width).toBe(classical.nut_width);
    expect(params.twin_ref).toBe('hyperobject:solid/guitar-neck');
    const doc = instrumentFromTwin(params);
    expect(doc.tuning.openMidi[0]).toBe(38);
    expect(doc.geometry.fretPositionsMm).toHaveLength(23);
  });
});
