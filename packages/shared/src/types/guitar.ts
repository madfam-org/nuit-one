/**
 * `nuit.guitar-performance/1`: one guitar performance recovered from audio (and video when
 * available) by the guitar intake engine (`apps/transcriber`). The JSON Schema that the engine
 * validates against lives at
 * `apps/transcriber/src/nuit_transcriber/schema/guitar-performance.v1.schema.json`; these types
 * mirror it field for field.
 */

export const GUITAR_PERFORMANCE_SCHEMA = 'nuit.guitar-performance/1' as const;

export type DynamicMark = 'ppp' | 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff';

export type RightHandFinger = 'p' | 'i' | 'm' | 'a' | 'c';

export type GuitarTechniqueKind =
  | 'vibrato'
  | 'bend'
  | 'slide'
  | 'hammer-on'
  | 'pull-off'
  | 'harmonic'
  | 'rasgueado'
  | 'strum'
  | 'tambora'
  | 'staccato'
  | 'accent'
  | 'let-ring';

export interface GuitarTechnique {
  readonly kind: GuitarTechniqueKind;
  readonly confidence?: number;
  /** vibrato */
  readonly rateHz?: number;
  readonly extentCents?: number;
  /** slide / hammer-on / pull-off: id of the note this one is joined from */
  readonly fromNote?: number;
  /** slide, bend, strum direction */
  readonly direction?: 'up' | 'down';
  /** harmonic: the fret the harmonic is touched over */
  readonly harmonicFret?: number;
}

export interface Barre {
  readonly fret: number;
  /** Player numbering: string 1 is the highest-pitched string. */
  readonly fromString: number;
  readonly toString: number;
}

export interface GuitarNote {
  readonly id: number;
  /** Seconds from the start of the source media. */
  readonly onset: number;
  readonly offset: number;
  readonly midi: number;
  /** Intonation relative to the equal-tempered pitch at the performance's reference A4. */
  readonly cents?: number;
  readonly velocity: number;
  readonly confidence: number;
  /** Player numbering: 1 = highest-pitched string. Null when no playable position was found. */
  readonly string?: number | null;
  /** 0 = open string (or capo). */
  readonly fret?: number | null;
  /** Left-hand finger: 0 = open, 1 = index … 4 = little finger. */
  readonly lhFinger?: number | null;
  readonly rhFinger?: RightHandFinger | null;
  /** 1 = upper voice (melody), 2 = bass (thumb). */
  readonly voice?: number;
  /** Index of the chord event (notes plucked together share it). */
  readonly event?: number;
  readonly measure?: number;
  /** Beat within the measure, 0-based, continuous. */
  readonly beat?: number;
  /** Quantised beat within the measure as an exact fraction, e.g. "9/4". */
  readonly beatQuantized?: string;
  readonly durationBeats?: string;
  readonly timingDeviationBeats?: number;
  readonly barre?: Barre | null;
  readonly techniques?: readonly GuitarTechnique[];
  readonly dynamic?: DynamicMark | null;
  readonly articulation?: 'legato' | 'staccato' | 'accent' | null;
  readonly timbre?: 'ordinario' | 'ponticello' | 'tasto' | null;
  readonly flags?: readonly string[];
}

export interface GuitarStringGeometry {
  readonly stringNumber: number;
  readonly openMidi: number;
  /** [x mm from the nut, y mm from the neck centreline] */
  readonly nut?: readonly [number, number];
  readonly saddle?: readonly [number, number];
}

export interface GuitarGeometryDoc {
  readonly scaleLengthMm: number;
  readonly fretCount: number;
  readonly fretsToBody: number;
  readonly nutWidthMm: number;
  readonly widthAtBodyJointMm?: number;
  readonly stringSpreadNutMm?: number;
  readonly stringSpreadSaddleMm?: number;
  readonly fingerboardRadiusMm?: number | null;
  readonly inlayFrets?: readonly number[];
  /** Nut (index 0) through the last fret, in mm from the nut. */
  readonly fretPositionsMm: readonly number[];
  readonly strings: readonly GuitarStringGeometry[];
}

export interface GuitarTuningDoc {
  readonly name: string;
  /** Lowest string first. */
  readonly openMidi: readonly number[];
  readonly referenceHz: number;
  readonly offsetCents?: number;
  readonly intonationSpreadCents?: number | null;
  readonly capo: number;
}

export interface GuitarInstrumentDoc {
  readonly family: 'guitar';
  readonly variant: string;
  /** Hyperobject / digital-twin reference this geometry came from, when known. */
  readonly twinRef?: string | null;
  readonly geometry: GuitarGeometryDoc;
  readonly tuning: GuitarTuningDoc;
}

export interface GuitarTiming {
  readonly source?: string;
  readonly beats: readonly number[];
  readonly downbeats: readonly number[];
  readonly beatsPerBar: number;
  readonly beatUnit: number;
  readonly tempoBpm: number;
  readonly tempoCurve?: readonly (readonly [number, number])[];
  readonly firstBarStart?: number;
  readonly rubatoIndex?: number | null;
}

export interface GuitarHandPosition {
  readonly start: number;
  readonly end: number;
  /** Fret under the index finger. */
  readonly fret: number;
  readonly confidence?: number;
  readonly source?: 'audio' | 'video' | 'fused';
}

export interface GuitarPercussiveEvent {
  readonly time: number;
  readonly kind: 'golpe' | 'tambora' | 'percussive';
  readonly strength?: number;
  readonly confidence?: number;
}

export interface GuitarPerformance {
  readonly schema: typeof GUITAR_PERFORMANCE_SCHEMA;
  readonly engine: {
    readonly name: string;
    readonly version: string;
    readonly createdAt?: string;
    readonly models?: Readonly<Record<string, string>>;
  };
  readonly source: {
    readonly kind: 'youtube' | 'url' | 'file' | 'synthetic';
    readonly id: string;
    readonly url?: string | null;
    readonly title: string;
    readonly uploader?: string | null;
    readonly durationSec?: number | null;
    readonly uploadDate?: string | null;
    readonly license?: string | null;
    readonly hasVideo?: boolean;
    readonly videoSize?: readonly [number | null, number | null] | null;
  };
  readonly instrument: GuitarInstrumentDoc;
  readonly timing: GuitarTiming;
  readonly notes: readonly GuitarNote[];
  readonly events?: readonly GuitarPercussiveEvent[];
  readonly positions?: readonly GuitarHandPosition[];
  readonly chords?: readonly {
    readonly start: number;
    readonly end: number;
    readonly label: string;
    readonly confidence?: number;
  }[];
  readonly dynamics?: readonly { readonly time: number; readonly mark: DynamicMark }[];
  readonly style?: Readonly<Record<string, unknown>>;
  readonly video?: Readonly<Record<string, unknown>> | null;
  readonly quality: {
    readonly notesTotal: number;
    readonly notesFingered?: number;
    readonly warnings: readonly string[];
  };
}
