import type { GuitarPerformance } from '@nuit-one/shared';
import { describe, expect, it } from 'vitest';
import demoJson from '../data/guitar-demo-performance.json';
import { drawGlyph, type GlyphKind } from './glyphs.js';
import { createLayout, visibleFretCount } from './layout.js';
import { createPalette } from './palette.js';
import { type Frame, FretboardPainter, pitchClassName } from './renderer.js';
import { buildTimeline, isGuitarPerformance, lookAheadSeconds } from './timeline.js';

// ---------------------------------------------------------------------------------------------
// A 2D context that accepts every call and remembers it, so the painter can run without a browser.
// ---------------------------------------------------------------------------------------------

function describeArg(value: unknown): string {
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
  if (typeof value === 'string') return value;
  return Object.prototype.toString.call(value);
}

function createRecording() {
  const state: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    font: '10px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
    lineJoin: 'miter',
  };
  const log: string[] = [];
  const counts = new Map<string, number>();
  const texts: string[] = [];
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        counts.set(prop, (counts.get(prop) ?? 0) + 1);
        log.push(`${prop}(${args.map(describeArg).join(',')})`);
        if (prop === 'fillText') texts.push(String(args[0]));
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
          return { addColorStop: () => undefined };
        if (prop === 'measureText') return { width: 8 };
        return undefined;
      };
    },
    set(target, prop, value) {
      if (typeof prop === 'string') {
        target[prop] = value;
        log.push(`${prop}=${describeArg(value)}`);
      }
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log, texts, count: (method: string) => counts.get(method) ?? 0 };
}

const palette = createPalette({
  background: { base: '#0a0a0f', surface: '#12121a', elevated: '#1a1a2e' },
  neon: { cyan: '#00f5ff', magenta: '#ff00e5', violet: '#8b5cf6', amber: '#f59e0b', green: '#00ff88' },
  text: { primary: '#f0f0f5', secondary: '#a0a0b0', muted: '#606070' },
});

if (!isGuitarPerformance(demoJson)) throw new Error('the demo document must be valid');
const demo: GuitarPerformance = demoJson;

function setup(score: GuitarPerformance = demo, width = 1000, height = 520, dpr = 1) {
  const offscreen = createRecording();
  const timeline = buildTimeline(score);
  const painter = new FretboardPainter({
    palette,
    fontFamily: 'monospace',
    createCanvas: (w, h) => ({ width: w, height: h, getContext: () => offscreen.ctx }) as unknown as HTMLCanvasElement,
  });
  painter.configure(
    createLayout(score.instrument.geometry, {
      width,
      height,
      visibleFrets: visibleFretCount(timeline.notes, timeline.fretCount),
    }),
    dpr,
  );
  const frameAt = (t: number, reducedMotion = false): Frame => ({
    timeline,
    t,
    lookAhead: lookAheadSeconds(timeline),
    reducedMotion,
  });
  return { painter, offscreen, timeline, frameAt };
}

function paintOnce(painter: FretboardPainter, frame: Frame) {
  const main = createRecording();
  painter.paint(main.ctx, frame);
  return main;
}

describe('pitchClassName', () => {
  it('names the open strings of a guitar', () => {
    expect([40, 45, 50, 55, 59, 64].map(pitchClassName)).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    expect(pitchClassName(61)).toBe('C#');
    expect(pitchClassName(-1)).toBe('B');
  });
});

describe('FretboardPainter', () => {
  it('draws nothing until it has a layout', () => {
    const painter = new FretboardPainter({ palette, fontFamily: 'monospace' });
    const main = createRecording();
    painter.paint(main.ctx, { timeline: buildTimeline(demo), t: 1, lookAhead: 2, reducedMotion: false });
    expect(main.log).toEqual([]);
  });

  it('builds the board once into a cached layer and blits it each frame', () => {
    const { painter, offscreen, frameAt } = setup();
    expect(offscreen.count('fillRect')).toBeGreaterThan(0);
    const fretsDrawn = offscreen.count('stroke');
    expect(fretsDrawn).toBeGreaterThan(0);

    const main = paintOnce(painter, frameAt(1));
    expect(main.count('drawImage')).toBeGreaterThanOrEqual(1);
    // Painting a frame does not rebuild the static layer.
    expect(offscreen.count('stroke')).toBe(fretsDrawn);
  });

  it('labels the strings with number and pitch, and the frets with numerals', () => {
    const { painter, frameAt } = setup();
    const main = paintOnce(painter, frameAt(1));
    for (const label of ['1', '2', '3', '4', '5', '6', 'E', 'A', 'D', 'G', 'B']) expect(main.texts).toContain(label);
    for (const fret of ['1', '5', '12', '14']) expect(main.texts).toContain(fret);
  });

  it('draws the string labels after the glows, so a ringing open string never washes them out', () => {
    const { painter, frameAt } = setup();
    // t = 0.4: the open A string is ringing, so its gem has a halo (drawn additively).
    const main = paintOnce(painter, frameAt(0.4));
    const lastGlow = main.log.lastIndexOf('globalCompositeOperation=lighter');
    const label = main.log.findIndex((line) => line.startsWith('fillText(A,29,'));
    expect(lastGlow).toBeGreaterThan(-1);
    expect(label).toBeGreaterThan(lastGlow);
  });

  it('shows the left-hand finger inside what is sounding, and the right-hand letter beside it', () => {
    const { painter, frameAt } = setup();
    // t = 0.4: the open A (thumb) rings and string 3 fret 2 (finger 2, index) has just been struck.
    const main = paintOnce(painter, frameAt(0.4));
    expect(main.texts).toContain('0');
    expect(main.texts).toContain('2');
    expect(main.texts).toContain('p');
    expect(main.texts).toContain('i');
  });

  it('shows upcoming notes with their finger numbers', () => {
    const { painter, frameAt } = setup();
    const main = paintOnce(painter, frameAt(8.5));
    expect(main.texts).toContain('1');
    expect(main.texts).toContain('3');
  });

  it('draws the barré as one extra rounded bar', () => {
    const withBarre = setup();
    const stripped = setup({
      ...demo,
      notes: demo.notes.map((n) => ({ ...n, barre: null })),
    });
    const a = paintOnce(withBarre.painter, withBarre.frameAt(13.6));
    const b = paintOnce(stripped.painter, stripped.frameAt(13.6));
    // A rounded rectangle is four arcs.
    expect(a.count('arcTo') - b.count('arcTo')).toBe(4);
  });

  it('draws an event (the golpe) falling in the body strip and flashing when it lands', () => {
    // Only the event: any difference in what is drawn is the event.
    const { painter, frameAt } = setup({ ...demo, notes: [], chords: [], events: [{ time: 5, kind: 'golpe' }] });
    const falling = paintOnce(painter, frameAt(4));
    const landed = paintOnce(painter, frameAt(5.1));
    const faded = paintOnce(painter, frameAt(5.6));
    const absent = setup({ ...demo, notes: [], chords: [], events: [] });
    const nothing = paintOnce(absent.painter, absent.frameAt(4));
    expect(falling.count('arc')).toBeGreaterThan(nothing.count('arc'));
    expect(landed.count('arc')).toBeGreaterThan(nothing.count('arc'));
    expect(faded.count('arc')).toBe(nothing.count('arc'));
  });

  it('is a pure function of time: the same instant always draws the same thing', () => {
    const { painter, frameAt } = setup();
    const first = paintOnce(painter, frameAt(5.2));
    paintOnce(painter, frameAt(11));
    paintOnce(painter, frameAt(0));
    const again = paintOnce(painter, frameAt(5.2));
    expect(again.log).toEqual(first.log);
  });

  it('leaves out strike ripples and string wobble when motion is reduced', () => {
    const { painter, frameAt } = setup();
    // 50 ms after the note at 1.0 starts.
    const lively = paintOnce(painter, frameAt(1.05, false));
    const calm = paintOnce(painter, frameAt(1.05, true));
    expect(calm.count('arc')).toBeLessThan(lively.count('arc'));
    expect(calm.count('lineTo')).toBeLessThan(lively.count('lineTo'));
  });

  it('never produces a NaN or an infinity, at any time, size or pixel ratio', () => {
    const times = [
      -1, 0, 0.001, 0.4, 1, 1.05, 2.67, 5.2, 8, 8.78, 9.85, 11, 12.1, 13.35, 13.55, 16, 17.2, 17.4, 18.6, 21,
    ];
    for (const [width, height, dpr] of [
      [320, 300, 2],
      [1000, 520, 1],
      [1600, 800, 3],
    ] as const) {
      const { painter, frameAt } = setup(demo, width, height, dpr);
      for (const t of times) {
        for (const reduced of [false, true]) {
          const main = paintOnce(painter, frameAt(t, reduced));
          const bad = main.log.find((line) => /NaN|Infinity/.test(line));
          expect(bad, `at t=${t} ${width}x${height}`).toBeUndefined();
        }
      }
    }
  }, 30_000);

  it('copes with a performance that has no notes, no chords and no beats', () => {
    const empty: GuitarPerformance = { ...demo, notes: [], chords: [], positions: [], dynamics: [], events: [] };
    const { painter, frameAt } = setup({ ...empty, timing: { ...demo.timing, beats: [], downbeats: [] } });
    expect(() => paintOnce(painter, frameAt(3))).not.toThrow();
  });

  it('draws only the notes that have a playable position', () => {
    const { painter, frameAt } = setup({
      ...demo,
      notes: demo.notes.map((n) => (n.id === 1 ? { ...n, string: null, fret: null } : n)),
    });
    expect(() => paintOnce(painter, frameAt(0.4))).not.toThrow();
  });
});

describe('drawGlyph', () => {
  const kinds: GlyphKind[] = [
    'slide-up',
    'slide-down',
    'hammer',
    'pull',
    'vibrato',
    'harmonic',
    'strum-down',
    'strum-up',
    'tambora',
    'bend',
  ];

  for (const kind of kinds) {
    it(`draws ${kind}`, () => {
      const rec = createRecording();
      drawGlyph(rec.ctx, kind, 50, 50, 6, '#ff00e5', 'monospace');
      expect(rec.count('stroke') + rec.count('fillText')).toBeGreaterThan(0);
      expect(rec.log.find((line) => /NaN|Infinity/.test(line))).toBeUndefined();
    });
  }

  it('writes H and P as letters and everything else as strokes', () => {
    const letters = createRecording();
    drawGlyph(letters.ctx, 'hammer', 0, 0, 6, '#fff', 'monospace');
    drawGlyph(letters.ctx, 'pull', 0, 0, 6, '#fff', 'monospace');
    expect(letters.texts).toEqual(['H', 'P']);
    const shapes = createRecording();
    drawGlyph(shapes.ctx, 'harmonic', 0, 0, 6, '#fff', 'monospace');
    expect(shapes.texts).toEqual([]);
  });
});
