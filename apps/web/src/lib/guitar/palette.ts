/**
 * The fretboard's colours. Everything is derived from the Nuit design tokens (`@nuit-one/ui` colors),
 * so the canvas shares one palette with the rest of the app:
 *
 * - the board is wood and nickel, tinted from the surface and amber tokens (a warm ebony),
 * - neon is reserved for music: cyan = sounding now, violet = coming next, amber = where the hand is,
 *   magenta = technique (slides, hammer-ons, barré).
 */

export interface PaletteTokens {
  readonly background: { readonly base: string; readonly surface: string; readonly elevated: string };
  readonly neon: {
    readonly cyan: string;
    readonly magenta: string;
    readonly violet: string;
    readonly amber: string;
    readonly green: string;
  };
  readonly text: { readonly primary: string; readonly secondary: string; readonly muted: string };
}

type Rgb = readonly [number, number, number];

const parsed = new Map<string, Rgb>();

/** `#rgb` or `#rrggbb` to channels. Anything unparsable is black, never an exception. */
export function parseColor(color: string): Rgb {
  const cached = parsed.get(color);
  if (cached) return cached;
  let hex = color.trim().replace(/^#/, '');
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const value = Number.parseInt(hex, 16);
  const rgb: Rgb = /^[0-9a-f]{6}$/i.test(hex) ? [(value >> 16) & 255, (value >> 8) & 255, value & 255] : [0, 0, 0];
  parsed.set(color, rgb);
  return rgb;
}

function toHex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, '0');
}

/** Linear blend in sRGB: `t` = 0 gives `a`, 1 gives `b`. Returns `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseColor(a);
  const [br, bg, bb] = parseColor(b);
  const k = Math.min(1, Math.max(0, t));
  return `#${toHex(ar + (br - ar) * k)}${toHex(ag + (bg - ag) * k)}${toHex(ab + (bb - ab) * k)}`;
}

/** `rgba()` string for a token colour at an opacity. */
export function rgba(color: string, alpha: number): string {
  const [r, g, b] = parseColor(color);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export interface Palette {
  readonly base: string;
  readonly surface: string;
  readonly elevated: string;
  readonly cyan: string;
  readonly magenta: string;
  readonly violet: string;
  readonly amber: string;
  readonly text: string;
  readonly textSoft: string;
  /** The board: dark ebony at the edges, a warmer lit centre. */
  readonly woodDark: string;
  readonly woodLight: string;
  readonly woodGrain: string;
  readonly fretMetal: string;
  readonly nutBone: string;
  readonly nutShade: string;
  readonly steel: string;
  readonly bronze: string;
  readonly bronzeLight: string;
  /** From cyan (about to sound) to violet (far away). */
  readonly approach: readonly string[];
}

const APPROACH_STEPS = 16;

export function createPalette(tokens: PaletteTokens): Palette {
  const { background, neon, text } = tokens;
  return {
    base: background.base,
    surface: background.surface,
    elevated: background.elevated,
    cyan: neon.cyan,
    magenta: neon.magenta,
    violet: neon.violet,
    amber: neon.amber,
    text: text.primary,
    textSoft: text.secondary,
    woodDark: mix(background.base, neon.amber, 0.09),
    woodLight: mix(background.elevated, neon.amber, 0.17),
    woodGrain: mix(background.elevated, neon.amber, 0.3),
    fretMetal: mix(text.secondary, text.primary, 0.55),
    nutBone: mix(text.primary, neon.amber, 0.12),
    nutShade: mix(text.secondary, neon.amber, 0.25),
    steel: mix(text.secondary, text.primary, 0.45),
    bronze: mix(neon.amber, text.secondary, 0.5),
    bronzeLight: mix(neon.amber, text.primary, 0.55),
    approach: Array.from({ length: APPROACH_STEPS }, (_, i) => mix(neon.cyan, neon.violet, i / (APPROACH_STEPS - 1))),
  };
}

/** Colour of something `u` of the way from "now" (0) to "far" (1). */
export function approachColor(palette: Palette, u: number): string {
  const index = Math.round(Math.min(1, Math.max(0, u)) * (palette.approach.length - 1));
  return palette.approach[index] ?? palette.cyan;
}
