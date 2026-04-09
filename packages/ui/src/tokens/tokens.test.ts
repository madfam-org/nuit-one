import { describe, expect, it } from 'vitest';
import { animations } from './animations.js';
import { colors } from './colors.js';
import { effects } from './effects.js';
import { spacing } from './spacing.js';
import { typography } from './typography.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function allValuesMatch(obj: Record<string, string>, pattern: RegExp, label: string) {
  for (const [key, value] of Object.entries(obj)) {
    expect(value, `${label}.${key} ("${value}") should match ${pattern}`).toMatch(pattern);
  }
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

describe('colors', () => {
  it('has all required color categories', () => {
    expect(colors).toHaveProperty('background');
    expect(colors).toHaveProperty('neon');
    expect(colors).toHaveProperty('glass');
    expect(colors).toHaveProperty('text');
    expect(colors).toHaveProperty('status');
  });

  describe('background', () => {
    it('contains base, surface, and elevated', () => {
      expect(colors.background).toHaveProperty('base');
      expect(colors.background).toHaveProperty('surface');
      expect(colors.background).toHaveProperty('elevated');
    });

    it('uses valid hex color strings', () => {
      allValuesMatch(colors.background, HEX_COLOR, 'background');
    });
  });

  describe('neon', () => {
    const expectedKeys = ['cyan', 'magenta', 'violet', 'amber', 'green'] as const;

    it.each(expectedKeys)('includes %s', (key) => {
      expect(colors.neon).toHaveProperty(key);
    });

    it('uses valid hex color strings', () => {
      allValuesMatch(colors.neon, HEX_COLOR, 'neon');
    });
  });

  describe('glass', () => {
    it('contains border, fill, and highlight', () => {
      expect(colors.glass).toHaveProperty('border');
      expect(colors.glass).toHaveProperty('fill');
      expect(colors.glass).toHaveProperty('highlight');
    });

    it('uses rgba values', () => {
      for (const [key, value] of Object.entries(colors.glass)) {
        expect(value, `glass.${key}`).toContain('rgba');
      }
    });
  });

  describe('text', () => {
    it('contains primary, secondary, and muted', () => {
      expect(colors.text).toHaveProperty('primary');
      expect(colors.text).toHaveProperty('secondary');
      expect(colors.text).toHaveProperty('muted');
    });

    it('uses valid hex color strings', () => {
      allValuesMatch(colors.text, HEX_COLOR, 'text');
    });
  });

  describe('status', () => {
    it('contains success, warning, error, and info', () => {
      expect(colors.status).toHaveProperty('success');
      expect(colors.status).toHaveProperty('warning');
      expect(colors.status).toHaveProperty('error');
      expect(colors.status).toHaveProperty('info');
    });

    it('uses valid hex color strings', () => {
      allValuesMatch(colors.status, HEX_COLOR, 'status');
    });
  });
});

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

describe('typography', () => {
  describe('fontFamily', () => {
    it('includes sans and mono families', () => {
      expect(typography.fontFamily).toHaveProperty('sans');
      expect(typography.fontFamily).toHaveProperty('mono');
    });

    it('sans family starts with Inter', () => {
      expect(typography.fontFamily.sans).toMatch(/^"Inter"/);
    });

    it('mono family starts with JetBrains Mono', () => {
      expect(typography.fontFamily.mono).toMatch(/^"JetBrains Mono"/);
    });
  });

  describe('fontSize', () => {
    const expectedKeys = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'] as const;

    it.each(expectedKeys)('includes size %s', (key) => {
      expect(typography.fontSize).toHaveProperty(key);
    });

    it('all sizes are valid rem strings', () => {
      for (const [key, value] of Object.entries(typography.fontSize)) {
        expect(value, `fontSize.${key}`).toMatch(/^\d+(\.\d+)?rem$/);
      }
    });

    it('sizes increase monotonically', () => {
      const ordered = expectedKeys.map((k) => parseFloat(typography.fontSize[k]));
      for (let i = 1; i < ordered.length; i++) {
        expect(
          ordered[i]!,
          `fontSize ${expectedKeys[i]} (${ordered[i]!}) should be >= ${expectedKeys[i - 1]} (${ordered[i - 1]!})`,
        ).toBeGreaterThanOrEqual(ordered[i - 1]!);
      }
    });
  });

  describe('fontWeight', () => {
    const expectedKeys = ['normal', 'medium', 'semibold', 'bold'] as const;

    it.each(expectedKeys)('includes weight %s', (key) => {
      expect(typography.fontWeight).toHaveProperty(key);
    });

    it('weights are numeric strings between 100 and 900', () => {
      for (const [key, value] of Object.entries(typography.fontWeight)) {
        const num = Number(value);
        expect(Number.isNaN(num), `fontWeight.${key} should be numeric`).toBe(false);
        expect(num, `fontWeight.${key}`).toBeGreaterThanOrEqual(100);
        expect(num, `fontWeight.${key}`).toBeLessThanOrEqual(900);
      }
    });

    it('weights increase in order', () => {
      const ordered = expectedKeys.map((k) => Number(typography.fontWeight[k]));
      for (let i = 1; i < ordered.length; i++) {
        expect(ordered[i]!).toBeGreaterThan(ordered[i - 1]!);
      }
    });
  });

  describe('lineHeight', () => {
    it('includes tight, normal, and relaxed', () => {
      expect(typography.lineHeight).toHaveProperty('tight');
      expect(typography.lineHeight).toHaveProperty('normal');
      expect(typography.lineHeight).toHaveProperty('relaxed');
    });

    it('values are unitless numeric strings', () => {
      for (const [key, value] of Object.entries(typography.lineHeight)) {
        expect(Number.isNaN(Number(value)), `lineHeight.${key}`).toBe(false);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

describe('spacing', () => {
  const expectedKeys = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20] as const;

  it.each(expectedKeys)('includes scale value %i', (key) => {
    expect(spacing).toHaveProperty(String(key));
  });

  it('zero value is "0"', () => {
    expect(spacing[0]).toBe('0');
  });

  it('non-zero values are valid rem strings', () => {
    for (const key of expectedKeys) {
      if (key === 0) continue;
      const value = spacing[key];
      expect(value, `spacing[${key}]`).toMatch(/^\d+(\.\d+)?rem$/);
    }
  });

  it('spacing values increase with key', () => {
    for (let i = 1; i < expectedKeys.length; i++) {
      const prev = expectedKeys[i - 1]!;
      const curr = expectedKeys[i]!;
      const prevVal = prev === 0 ? 0 : parseFloat(spacing[prev]);
      const currVal = parseFloat(spacing[curr]);
      expect(currVal, `spacing[${curr}] (${currVal}) should be > spacing[${prev}] (${prevVal})`).toBeGreaterThan(
        prevVal,
      );
    }
  });

  it('follows 0.25rem base increment (value = key * 0.25rem)', () => {
    for (const key of expectedKeys) {
      if (key === 0) continue;
      const expected = key * 0.25;
      const actual = parseFloat(spacing[key]);
      expect(actual, `spacing[${key}]`).toBeCloseTo(expected, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

describe('effects', () => {
  describe('glass', () => {
    it('includes backdrop, border, and shadow', () => {
      expect(effects.glass).toHaveProperty('backdrop');
      expect(effects.glass).toHaveProperty('border');
      expect(effects.glass).toHaveProperty('shadow');
    });

    it('backdrop contains blur function', () => {
      expect(effects.glass.backdrop).toContain('blur(');
    });

    it('backdrop contains saturate function', () => {
      expect(effects.glass.backdrop).toContain('saturate(');
    });

    it('border is a valid CSS border shorthand', () => {
      expect(effects.glass.border).toMatch(/^\d+px\s+solid\s+rgba/);
    });

    it('shadow is a valid CSS box-shadow value', () => {
      expect(effects.glass.shadow).toMatch(/^\d+\s+\d+px\s+\d+px\s+rgba/);
    });
  });

  describe('glow', () => {
    const expectedKeys = ['cyan', 'magenta', 'violet'] as const;

    it.each(expectedKeys)('includes %s glow', (key) => {
      expect(effects.glow).toHaveProperty(key);
    });

    it('all glow values are box-shadow strings containing rgba', () => {
      for (const [key, value] of Object.entries(effects.glow)) {
        expect(value, `glow.${key}`).toContain('rgba');
      }
    });
  });

  describe('transition', () => {
    const expectedKeys = ['fast', 'base', 'slow'] as const;

    it.each(expectedKeys)('includes %s transition', (key) => {
      expect(effects.transition).toHaveProperty(key);
    });

    it('all transitions contain a duration in ms', () => {
      for (const [key, value] of Object.entries(effects.transition)) {
        expect(value, `transition.${key}`).toMatch(/\d+ms/);
      }
    });

    it('all transitions contain a cubic-bezier easing', () => {
      for (const [key, value] of Object.entries(effects.transition)) {
        expect(value, `transition.${key}`).toContain('cubic-bezier');
      }
    });

    it('durations increase from fast to slow', () => {
      const extractMs = (v: string) => parseInt(v.match(/(\d+)ms/)![1]!, 10);
      const fast = extractMs(effects.transition.fast);
      const base = extractMs(effects.transition.base);
      const slow = extractMs(effects.transition.slow);

      expect(base).toBeGreaterThan(fast);
      expect(slow).toBeGreaterThan(base);
    });
  });
});

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

describe('animations', () => {
  const expectedKeys = ['fadeIn', 'slideUp', 'pulseGlow', 'shimmer'] as const;

  it.each(expectedKeys)('includes %s animation', (key) => {
    expect(animations).toHaveProperty(key);
  });

  describe.each(expectedKeys)('%s', (key) => {
    it('has a keyframes string containing @keyframes', () => {
      expect(animations[key].keyframes).toContain('@keyframes');
    });

    it('has a duration property', () => {
      expect(animations[key]).toHaveProperty('duration');
      expect(animations[key].duration).toMatch(/^\d+(\.\d+)?(ms|s)$/);
    });

    it('has an easing property', () => {
      expect(animations[key]).toHaveProperty('easing');
      expect(animations[key].easing).toBeTruthy();
    });

    it('has a name property matching the keyframes declaration', () => {
      expect(animations[key]).toHaveProperty('name');
      expect(animations[key].keyframes).toContain(animations[key].name);
    });
  });

  it('all animation names are prefixed with "nuit-"', () => {
    for (const key of expectedKeys) {
      expect(animations[key].name, `animations.${key}.name`).toMatch(/^nuit-/);
    }
  });
});

// ---------------------------------------------------------------------------
// Barrel export (index)
// ---------------------------------------------------------------------------

describe('tokens barrel export', () => {
  // Importing from the barrel to verify re-exports work correctly
  it('re-exports all token modules', async () => {
    const barrel = await import('./index.js');
    expect(barrel.colors).toBeDefined();
    expect(barrel.typography).toBeDefined();
    expect(barrel.spacing).toBeDefined();
    expect(barrel.effects).toBeDefined();
    expect(barrel.animations).toBeDefined();
  });

  it('barrel colors matches direct import', async () => {
    const barrel = await import('./index.js');
    expect(barrel.colors).toStrictEqual(colors);
  });

  it('barrel typography matches direct import', async () => {
    const barrel = await import('./index.js');
    expect(barrel.typography).toStrictEqual(typography);
  });

  it('barrel spacing matches direct import', async () => {
    const barrel = await import('./index.js');
    expect(barrel.spacing).toStrictEqual(spacing);
  });

  it('barrel effects matches direct import', async () => {
    const barrel = await import('./index.js');
    expect(barrel.effects).toStrictEqual(effects);
  });

  it('barrel animations matches direct import', async () => {
    const barrel = await import('./index.js');
    expect(barrel.animations).toStrictEqual(animations);
  });
});
