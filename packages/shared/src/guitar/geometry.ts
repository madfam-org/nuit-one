/**
 * Guitar geometry shared by the web app and the guitar intake engine.
 *
 * Fret n sits at d(n) = L · (1 − 2^(−n/12)) from the nut, where L is the scale length; fret 12 is
 * exactly L / 2. The Python engine (`apps/transcriber/src/nuit_transcriber/instrument.py`) uses the
 * same formula and the same field names, so a performance document, the video fit and the karaoke
 * fretboard always agree.
 *
 * Guitar twins come from the MADFAM hyperobjects commons. The commons' frame grammar cannot express
 * exponentiation, so consumers read a cartridge's *parameters* (ids below) and derive the fret
 * positions here.
 */

import type { GuitarGeometryDoc, GuitarInstrumentDoc, GuitarStringGeometry, GuitarTuningDoc } from '../types/guitar.js';

/** Open-string MIDI pitches, lowest string first. */
export const GUITAR_TUNINGS: Readonly<Record<string, readonly number[]>> = {
  standard: [40, 45, 50, 55, 59, 64],
  'drop-d': [38, 45, 50, 55, 59, 64],
  'half-step-down': [39, 44, 49, 54, 58, 63],
  'whole-step-down': [38, 43, 48, 53, 57, 62],
  dadgad: [38, 45, 50, 55, 57, 62],
  'open-g': [38, 43, 50, 55, 59, 62],
  'open-d': [38, 45, 50, 54, 57, 62],
  'open-e': [40, 47, 52, 56, 59, 64],
  'drop-c': [36, 43, 48, 53, 57, 62],
  'standard-7': [35, 40, 45, 50, 55, 59, 64],
};

/** Fingerboard radius select keys shared with the commons `capo` cartridge (mm; null = flat). */
export const FINGERBOARD_RADII_MM: Readonly<Record<string, number | null>> = {
  '7.25in': 184.15,
  '9.5in': 241.3,
  '12in': 304.8,
  '16in': 406.4,
  flat: null,
};

export interface GuitarTwinParameters {
  readonly variant: string;
  readonly scale_length: number;
  readonly fret_count: number;
  readonly frets_to_body: number;
  readonly nut_width: number;
  readonly width_at_body_joint: number;
  readonly string_count: number;
  readonly string_spacing_at_saddle: number;
  readonly fingerboard_radius: string;
  readonly tuning: string;
  readonly twin_ref?: string | null;
}

/** Reference twins. Parameter ids match the proposed commons `guitar-neck` cartridge. */
export const GUITAR_TWIN_PRESETS: Readonly<Record<string, GuitarTwinParameters>> = {
  'classical-650': {
    variant: 'classical',
    scale_length: 650,
    fret_count: 19,
    frets_to_body: 12,
    nut_width: 52,
    width_at_body_joint: 62,
    string_count: 6,
    string_spacing_at_saddle: 58,
    fingerboard_radius: 'flat',
    tuning: 'standard',
  },
  'steel-string-645': {
    variant: 'steel-string',
    scale_length: 645.16,
    fret_count: 20,
    frets_to_body: 14,
    nut_width: 43,
    width_at_body_joint: 55,
    string_count: 6,
    string_spacing_at_saddle: 54,
    fingerboard_radius: '16in',
    tuning: 'standard',
  },
  'electric-648': {
    variant: 'electric',
    scale_length: 647.7,
    fret_count: 22,
    frets_to_body: 16,
    nut_width: 42,
    width_at_body_joint: 56,
    string_count: 6,
    string_spacing_at_saddle: 52.5,
    fingerboard_radius: '9.5in',
    tuning: 'standard',
  },
  'electric-628': {
    variant: 'electric',
    scale_length: 628.65,
    fret_count: 22,
    frets_to_body: 16,
    nut_width: 43,
    width_at_body_joint: 56,
    string_count: 6,
    string_spacing_at_saddle: 52,
    fingerboard_radius: '12in',
    tuning: 'standard',
  },
};

export function fretDistanceMm(scaleLengthMm: number, fret: number): number {
  return scaleLengthMm * (1 - 2 ** (-fret / 12));
}

/** Continuous fret coordinate of a point `distanceMm` from the nut (inverse of fretDistanceMm). */
export function fretFromDistanceMm(scaleLengthMm: number, distanceMm: number): number {
  const ratio = 1 - distanceMm / scaleLengthMm;
  if (ratio <= 0) return Number.POSITIVE_INFINITY;
  return -12 * Math.log2(ratio);
}

/** Centre-to-centre spread of the outer strings at the nut: nut width minus the edge margins. */
export function stringSpreadAtNutMm(nutWidthMm: number, variant: string): number {
  const margin = variant === 'classical' ? 4.5 : 3.2;
  return Math.max(nutWidthMm - 2 * margin, nutWidthMm * 0.6);
}

/**
 * Across-neck coordinate of a string at `xMm` from the nut. y = 0 is the centreline; the lowest
 * string (index 0) has negative y. Strings fan linearly from the nut spread to the saddle spread.
 */
export function stringYMm(geometry: GuitarGeometryDoc, stringIndexFromLowest: number, xMm: number): number {
  const n = geometry.strings.length;
  if (n < 2) return 0;
  const nutSpread = geometry.stringSpreadNutMm ?? stringSpreadAtNutMm(geometry.nutWidthMm, 'classical');
  const saddleSpread = geometry.stringSpreadSaddleMm ?? nutSpread * 1.3;
  const t = Math.min(Math.max(xMm / geometry.scaleLengthMm, 0), 1);
  const spread = nutSpread + (saddleSpread - nutSpread) * t;
  return -spread / 2 + (spread * stringIndexFromLowest) / (n - 1);
}

/** Half the fingerboard width at `xMm` (linear taper from the nut to the body joint). */
export function neckHalfWidthMm(geometry: GuitarGeometryDoc, xMm: number): number {
  const xJoint = fretDistanceMm(geometry.scaleLengthMm, geometry.fretsToBody);
  const joint = geometry.widthAtBodyJointMm ?? geometry.nutWidthMm * 1.2;
  const t = xJoint > 0 ? xMm / xJoint : 0;
  return (geometry.nutWidthMm + (joint - geometry.nutWidthMm) * t) / 2;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Build the instrument document (same shape the engine writes) from twin parameters. */
export function instrumentFromTwin(params: GuitarTwinParameters, referenceHz = 440): GuitarInstrumentDoc {
  const openMidi = GUITAR_TUNINGS[params.tuning] ?? GUITAR_TUNINGS.standard ?? [40, 45, 50, 55, 59, 64];
  const strings = openMidi.slice(0, params.string_count);
  const spreadNut = stringSpreadAtNutMm(params.nut_width, params.variant);
  const spreadSaddle = params.string_spacing_at_saddle;
  const fretPositionsMm = Array.from({ length: params.fret_count + 1 }, (_, n) =>
    round3(fretDistanceMm(params.scale_length, n)),
  );
  const nStrings = strings.length;
  const stringGeometry: GuitarStringGeometry[] = strings.map((openPitch, i) => {
    const yNut = nStrings > 1 ? -spreadNut / 2 + (spreadNut * i) / (nStrings - 1) : 0;
    const ySaddle = nStrings > 1 ? -spreadSaddle / 2 + (spreadSaddle * i) / (nStrings - 1) : 0;
    return {
      stringNumber: nStrings - i,
      openMidi: openPitch,
      nut: [0, round3(yNut)] as const,
      saddle: [params.scale_length, round3(ySaddle)] as const,
    };
  });
  const geometry: GuitarGeometryDoc = {
    scaleLengthMm: params.scale_length,
    fretCount: params.fret_count,
    fretsToBody: params.frets_to_body,
    nutWidthMm: params.nut_width,
    widthAtBodyJointMm: params.width_at_body_joint,
    stringSpreadNutMm: round3(spreadNut),
    stringSpreadSaddleMm: spreadSaddle,
    fingerboardRadiusMm: FINGERBOARD_RADII_MM[params.fingerboard_radius] ?? null,
    inlayFrets:
      params.variant === 'classical' ? [] : [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].filter((f) => f <= params.fret_count),
    fretPositionsMm,
    strings: stringGeometry,
  };
  const tuning: GuitarTuningDoc = {
    name: params.tuning in GUITAR_TUNINGS ? params.tuning : 'standard',
    openMidi: strings,
    referenceHz,
    capo: 0,
  };
  return { family: 'guitar', variant: params.variant, twinRef: params.twin_ref ?? null, geometry, tuning };
}

interface ManifestParameter {
  readonly id?: unknown;
  readonly default?: unknown;
}

/**
 * Read twin parameters from a hyperobject `project.json` (its `parameters[].default` values),
 * falling back to the classical preset for anything the manifest does not define.
 */
export function twinParametersFromManifest(
  manifest: { readonly project?: { readonly slug?: unknown }; readonly parameters?: readonly ManifestParameter[] },
  fallback: GuitarTwinParameters = GUITAR_TWIN_PRESETS['classical-650'] as GuitarTwinParameters,
): GuitarTwinParameters {
  const values = new Map<string, unknown>();
  for (const p of manifest.parameters ?? []) {
    if (typeof p.id === 'string') values.set(p.id, p.default);
  }
  const num = (id: keyof GuitarTwinParameters, d: number): number => {
    const v = values.get(id);
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
    return Number.isFinite(n) ? n : d;
  };
  const str = (id: keyof GuitarTwinParameters, d: string): string => {
    const v = values.get(id);
    return typeof v === 'string' && v.length > 0 ? v : d;
  };
  const slug = typeof manifest.project?.slug === 'string' ? manifest.project.slug : null;
  return {
    variant: str('variant', fallback.variant),
    scale_length: num('scale_length', fallback.scale_length),
    fret_count: Math.round(num('fret_count', fallback.fret_count)),
    frets_to_body: Math.round(num('frets_to_body', fallback.frets_to_body)),
    nut_width: num('nut_width', fallback.nut_width),
    width_at_body_joint: num('width_at_body_joint', fallback.width_at_body_joint),
    string_count: Math.round(num('string_count', fallback.string_count)),
    string_spacing_at_saddle: num('string_spacing_at_saddle', fallback.string_spacing_at_saddle),
    fingerboard_radius: str('fingerboard_radius', fallback.fingerboard_radius),
    tuning: str('tuning', fallback.tuning),
    twin_ref: slug ? `hyperobject:solid/${slug}` : (fallback.twin_ref ?? null),
  };
}
