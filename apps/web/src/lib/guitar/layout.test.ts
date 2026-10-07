import { GUITAR_TWIN_PRESETS, instrumentFromTwin } from '@nuit-one/shared';
import { describe, expect, it } from 'vitest';
import demoJson from '../data/guitar-demo-performance.json';
import {
  boardEdgesAt,
  createLayout,
  DROP_SECONDS,
  fretSpace,
  gemRadiusFor,
  gemY,
  handWindow,
  notePoint,
  noteX,
  skyY,
  stringYAt,
  visibleFretCount,
} from './layout.js';
import { buildTimeline, isGuitarPerformance } from './timeline.js';

const classical = GUITAR_TWIN_PRESETS['classical-650'];
const electric = GUITAR_TWIN_PRESETS['electric-648'];
if (!classical || !electric) throw new Error('twin presets are missing');
const classicalGeometry = instrumentFromTwin(classical).geometry;
const electricGeometry = instrumentFromTwin(electric).geometry;

if (!isGuitarPerformance(demoJson)) throw new Error('the demo document must be valid');
const demo = buildTimeline(demoJson);

const layout = createLayout(classicalGeometry, { width: 1000, height: 520, visibleFrets: 14 });

describe('visibleFretCount', () => {
  it('shows two frets past the highest one used', () => {
    expect(visibleFretCount(demo.notes, 19)).toBe(14);
  });

  it('never shows fewer than seven frets, nor more than the neck has', () => {
    expect(visibleFretCount([{ fret: 2 }], 19)).toBe(7);
    expect(visibleFretCount([{ fret: 19 }], 19)).toBe(19);
    expect(visibleFretCount([{ fret: 3 }], 5)).toBe(5);
    expect(visibleFretCount([], 19)).toBe(7);
  });
});

describe('fret spacing (the point of the twin)', () => {
  it('puts the nut and the last visible fret at the board edges', () => {
    expect(layout.fretX[0]).toBeCloseTo(layout.nutX, 9);
    expect(layout.fretX[14]).toBeCloseTo(layout.endX, 9);
  });

  it('uses the real equal-tempered positions, not even steps', () => {
    const mm = classicalGeometry.fretPositionsMm;
    const total = (mm[14] ?? 0) - (mm[0] ?? 0);
    for (const fret of [1, 3, 5, 7, 12]) {
      const expected = ((mm[fret] ?? 0) - (mm[0] ?? 0)) / total;
      const actual = ((layout.fretX[fret] ?? 0) - layout.nutX) / (layout.endX - layout.nutX);
      expect(actual).toBeCloseTo(expected, 9);
    }
  });

  it('makes the first fret space nearly twice the twelfth', () => {
    const first = fretSpace(layout, 1);
    const twelfth = fretSpace(layout, 12);
    const ratio = (first.x1 - first.x0) / (twelfth.x1 - twelfth.x0);
    expect(ratio).toBeCloseTo(36.482 / (325 - 305.674), 2);
  });

  it('puts fret 12 at half the scale length', () => {
    const full = createLayout(classicalGeometry, { width: 1000, height: 520, visibleFrets: 19 });
    const half = ((full.fretX[12] ?? 0) - full.nutX) / ((full.fretX[19] ?? 0) - full.nutX);
    expect(half).toBeCloseTo(325 / 433.089, 3);
  });

  it('flags a neck that continues past the right edge', () => {
    expect(layout.truncated).toBe(true);
    expect(createLayout(classicalGeometry, { width: 1000, height: 520, visibleFrets: 19 }).truncated).toBe(false);
  });
});

describe('strings', () => {
  it('draws string 1 at the top, like tablature', () => {
    for (const x of [layout.nutX, (layout.nutX + layout.endX) / 2, layout.endX]) {
      const ys = [1, 2, 3, 4, 5, 6].map((s) => stringYAt(layout, s, x));
      expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    }
  });

  it('fans the strings out toward the body, as the twin does', () => {
    const spreadAtNut = stringYAt(layout, 6, layout.nutX) - stringYAt(layout, 1, layout.nutX);
    const spreadAtEnd = stringYAt(layout, 6, layout.endX) - stringYAt(layout, 1, layout.endX);
    expect(spreadAtEnd).toBeGreaterThan(spreadAtNut);
    // 43 mm at the nut, 43 + 15 * (360.458 / 650) mm at fret 14.
    expect(spreadAtEnd / spreadAtNut).toBeCloseTo((43 + 15 * (360.458 / 650)) / 43, 2);
  });

  it('keeps every string inside the board', () => {
    for (const x of [layout.nutX, layout.endX]) {
      const { top, bottom } = boardEdgesAt(layout, x);
      for (let s = 1; s <= 6; s += 1) {
        expect(stringYAt(layout, s, x)).toBeGreaterThan(top);
        expect(stringYAt(layout, s, x)).toBeLessThan(bottom);
      }
    }
  });

  it('tapers the board toward the nut', () => {
    const atNut = boardEdgesAt(layout, layout.nutX);
    const atEnd = boardEdgesAt(layout, layout.endX);
    expect(atEnd.bottom - atEnd.top).toBeGreaterThan(atNut.bottom - atNut.top);
    expect(layout.boardTop).toBeCloseTo(atEnd.top, 6);
  });
});

describe('note placement', () => {
  it('centres a fretted note in its fret space, on its string', () => {
    const point = notePoint(layout, 2, 3);
    expect(point.x).toBeCloseTo(((layout.fretX[2] ?? 0) + (layout.fretX[3] ?? 0)) / 2, 9);
    expect(point.y).toBeCloseTo(stringYAt(layout, 2, point.x), 9);
  });

  it('draws open strings left of the nut, on the string line at the nut', () => {
    const point = notePoint(layout, 1, 0);
    expect(point.x).toBeLessThan(layout.nutX);
    expect(point.x).toBe(noteX(layout, 0));
    expect(point.y).toBeCloseTo(stringYAt(layout, 1, layout.nutX), 9);
  });

  it('keeps open-string gems clear of the string labels', () => {
    expect(layout.openX - layout.gemRadius).toBeGreaterThanOrEqual(38);
  });

  it('shrinks gems to fit narrow fret spaces', () => {
    const wide = createLayout(electricGeometry, { width: 520, height: 400, visibleFrets: 22 });
    expect(gemRadiusFor(wide, 1)).toBeGreaterThan(gemRadiusFor(wide, 21));
    expect(gemRadiusFor(wide, 21)).toBeGreaterThanOrEqual(6.5);
    expect(gemRadiusFor(wide, 0)).toBe(wide.gemRadius);
  });
});

describe('hand window', () => {
  it('covers the four frets from the index finger', () => {
    const window = handWindow(layout, 5);
    expect(window?.x0).toBeCloseTo(layout.fretX[4] ?? 0, 9);
    expect(window?.x1).toBeCloseTo(layout.fretX[8] ?? 0, 9);
  });

  it('starts at the nut for position I and is clipped at the end of the board', () => {
    expect(handWindow(layout, 1)?.x0).toBeCloseTo(layout.nutX, 9);
    expect(handWindow(layout, 13)?.x1).toBeCloseTo(layout.endX, 9);
  });

  it('is null when the window lies past the visible neck', () => {
    expect(handWindow(layout, 17)).toBeNull();
  });
});

describe('layout fits every size we can be given', () => {
  const sizes: [number, number][] = [
    [320, 300],
    [390, 420],
    [640, 360],
    [1000, 520],
    [1600, 800],
    [2400, 1100],
  ];

  for (const [geometryName, geometry] of [
    ['classical', classicalGeometry],
    ['electric', electricGeometry],
  ] as const) {
    for (const [width, height] of sizes) {
      for (const visibleFrets of [5, 7, 14, 19]) {
        it(`${geometryName} ${width}x${height}, ${visibleFrets} frets`, () => {
          const l = createLayout(geometry, { width, height, visibleFrets });
          for (const value of [
            l.nutX,
            l.endX,
            l.xScale,
            l.yScale,
            l.centerY,
            l.boardTop,
            l.boardBottom,
            l.rowGap,
            l.gemRadius,
            l.openX,
            l.hitY,
            l.skyTop,
            l.labelY,
            l.bodyX,
          ]) {
            expect(Number.isFinite(value)).toBe(true);
          }
          expect(l.endX).toBeLessThanOrEqual(width);
          expect(l.bodyX).toBeGreaterThan(l.endX);
          expect(l.nutX).toBeLessThan(l.endX);
          expect(l.skyTop).toBeLessThan(l.hitY);
          expect(l.hitY).toBeLessThan(l.boardTop);
          expect(l.boardTop).toBeGreaterThan(0);
          expect(l.labelY).toBeLessThan(height);
          expect(l.openX - l.gemRadius).toBeGreaterThanOrEqual(38);
          expect(l.gemRadius).toBeGreaterThanOrEqual(6.5);
          // The sky keeps a usable share of the height.
          expect(l.hitY - l.skyTop).toBeGreaterThanOrEqual(30);
          for (const x of [l.nutX, l.endX]) {
            const { top, bottom } = boardEdgesAt(l, x);
            expect(stringYAt(l, 1, x)).toBeGreaterThan(top);
            expect(stringYAt(l, l.stringCount, x)).toBeLessThan(bottom);
          }
        });
      }
    }
  }
});

describe('the sky', () => {
  const lookAhead = 2.5;
  const landing = notePoint(layout, 6, 3).y;

  it('lands a note on its string exactly at its onset', () => {
    expect(gemY(layout, 0, lookAhead, landing)).toBeCloseTo(landing, 9);
  });

  it('brings a note to the board edge as the drop begins, and to the sky top at the look-ahead', () => {
    expect(gemY(layout, DROP_SECONDS, lookAhead, landing)).toBeCloseTo(layout.hitY, 9);
    expect(gemY(layout, lookAhead, lookAhead, landing)).toBeCloseTo(layout.skyTop, 9);
  });

  it('only ever moves down as time runs out', () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (let dt = lookAhead; dt >= 0; dt -= 0.01) {
      const y = gemY(layout, dt, lookAhead, landing);
      expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = y;
    }
  });

  it('keeps its speed when the sky turns into the drop (no hitch)', () => {
    const delta = 0.0002;
    const above = gemY(layout, DROP_SECONDS + delta, lookAhead, landing);
    const at = gemY(layout, DROP_SECONDS, lookAhead, landing);
    const below = gemY(layout, DROP_SECONDS - delta, lookAhead, landing);
    expect((below - at) / (at - above)).toBeCloseTo(1, 1);
  });

  it('places beat lines with the same speed as falling notes', () => {
    const lineEarly = skyY(layout, 1.5, lookAhead);
    const lineLate = skyY(layout, 1.0, lookAhead);
    const noteEarly = gemY(layout, 1.5, lookAhead, landing);
    const noteLate = gemY(layout, 1.0, lookAhead, landing);
    expect(lineEarly).toBeCloseTo(noteEarly, 9);
    expect(lineLate - lineEarly).toBeCloseTo(noteLate - noteEarly, 9);
  });
});
