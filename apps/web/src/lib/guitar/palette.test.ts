import { describe, expect, it } from 'vitest';
import { approachColor, createPalette, mix, type PaletteTokens, parseColor, rgba } from './palette.js';

// The Nuit tokens (packages/ui/src/tokens/colors.ts). The palette must work for any token set;
// these are the values the app ships with.
const tokens: PaletteTokens = {
  background: { base: '#0a0a0f', surface: '#12121a', elevated: '#1a1a2e' },
  neon: { cyan: '#00f5ff', magenta: '#ff00e5', violet: '#8b5cf6', amber: '#f59e0b', green: '#00ff88' },
  text: { primary: '#f0f0f5', secondary: '#a0a0b0', muted: '#606070' },
};

/** WCAG relative luminance. */
function luminance(color: string): number {
  const [r, g, b] = parseColor(color).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('parseColor', () => {
  it('reads #rrggbb and #rgb', () => {
    expect(parseColor('#00f5ff')).toEqual([0, 245, 255]);
    expect(parseColor('#0af')).toEqual([0, 170, 255]);
    expect(parseColor('  #FFFFFF ')).toEqual([255, 255, 255]);
  });

  it('turns anything unreadable into black instead of throwing', () => {
    expect(parseColor('banana')).toEqual([0, 0, 0]);
    expect(parseColor('')).toEqual([0, 0, 0]);
  });
});

describe('mix and rgba', () => {
  it('blends linearly and clamps the weight', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#ffffff', -3)).toBe('#102030');
    expect(mix('#102030', '#ffffff', 9)).toBe('#ffffff');
  });

  it('writes rgba() with the opacity clamped', () => {
    expect(rgba('#00f5ff', 0.5)).toBe('rgba(0, 245, 255, 0.5)');
    expect(rgba('#00f5ff', 4)).toBe('rgba(0, 245, 255, 1)');
    expect(rgba('#00f5ff', -1)).toBe('rgba(0, 245, 255, 0)');
  });
});

describe('createPalette', () => {
  const palette = createPalette(tokens);

  it('passes the neon tokens straight through, so the canvas matches the app', () => {
    expect(palette.cyan).toBe(tokens.neon.cyan);
    expect(palette.magenta).toBe(tokens.neon.magenta);
    expect(palette.violet).toBe(tokens.neon.violet);
    expect(palette.amber).toBe(tokens.neon.amber);
    expect(palette.base).toBe(tokens.background.base);
    expect(palette.text).toBe(tokens.text.primary);
  });

  it('derives a warm dark wood that is lit in the middle and stays dark', () => {
    expect(luminance(palette.woodLight)).toBeGreaterThan(luminance(palette.woodDark));
    expect(luminance(palette.woodLight)).toBeLessThan(0.08);
    const [r, , b] = parseColor(palette.woodLight);
    expect(r).toBeGreaterThan(b);
  });

  it('makes the frets and nut lighter than the wood, and bronze warmer than steel', () => {
    expect(luminance(palette.fretMetal)).toBeGreaterThan(luminance(palette.woodLight) * 4);
    expect(luminance(palette.nutBone)).toBeGreaterThan(luminance(palette.fretMetal));
    const [br, , bb] = parseColor(palette.bronze);
    const [sr, , sb] = parseColor(palette.steel);
    expect(br - bb).toBeGreaterThan(sr - sb);
  });

  it('runs the approach ramp from cyan (about to sound) to violet (far)', () => {
    expect(palette.approach[0]).toBe(mix(tokens.neon.cyan, tokens.neon.violet, 0));
    expect(palette.approach[palette.approach.length - 1]).toBe(tokens.neon.violet);
    expect(approachColor(palette, 0)).toBe(tokens.neon.cyan);
    expect(approachColor(palette, 1)).toBe(tokens.neon.violet);
    expect(approachColor(palette, -5)).toBe(tokens.neon.cyan);
    expect(approachColor(palette, 5)).toBe(tokens.neon.violet);
  });

  it('keeps text readable (WCAG AA, 4.5:1) where the canvas puts it', () => {
    // Finger numerals: dark on a lit gem.
    expect(contrast(palette.base, palette.cyan)).toBeGreaterThanOrEqual(7);
    // String labels, fret numerals, measure numbers: soft text on the backdrop.
    expect(contrast(palette.textSoft, palette.base)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.text, palette.base)).toBeGreaterThanOrEqual(7);
    // Fret numerals in the hand window.
    expect(contrast(palette.amber, palette.base)).toBeGreaterThanOrEqual(4.5);
    // Numerals on a falling gem: primary text on the (dark) gem fill.
    expect(contrast(palette.text, mix(palette.base, palette.violet, 0.2))).toBeGreaterThanOrEqual(7);
  });
});
