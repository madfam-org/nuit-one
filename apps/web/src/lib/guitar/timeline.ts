/**
 * Pure time queries over a guitar performance: what is sounding, what is coming, where we are in the
 * bar, which chord, hand position and dynamic apply. Everything is expressed in seconds of the source
 * media, the same clock as `GuitarNote.onset`.
 *
 * `buildTimeline` does the sorting and indexing once per performance; the query functions are then
 * cheap enough (binary searches) to run every animation frame.
 */

import type {
  Barre,
  DynamicMark,
  GuitarHandPosition,
  GuitarNote,
  GuitarPercussiveEvent,
  GuitarPerformance,
  GuitarTiming,
} from '@nuit-one/shared';
import { GUITAR_PERFORMANCE_SCHEMA } from '@nuit-one/shared';

/** A downbeat this close (seconds) to a beat is that beat. */
const BEAT_TOLERANCE_SECONDS = 0.02;
/** Notes shorter than this are still kept active (and visible) for this long. */
export const MIN_NOTE_SECONDS = 0.12;
/** Notes of one chord or strum start within this window of the first one. */
const CHORD_WINDOW_SECONDS = 0.1;
/** Strummed notes further apart than this belong to different strokes. */
const STRUM_GAP_SECONDS = 0.2;
const MAX_SYNTHETIC_BEATS = 20000;
const MAX_NOTES_PER_DESCRIPTION = 4;

/** A note with a playable position: it can be drawn on the fretboard. */
export interface PlacedNote extends GuitarNote {
  /** Player numbering: 1 = highest-pitched string. */
  readonly string: number;
  /** 0 = open string. */
  readonly fret: number;
}

export interface BeatMark {
  readonly time: number;
  /** Bar number, 1-based. 0 for pickup beats before the first downbeat. */
  readonly measure: number;
  /** Beat within the bar, 1-based. */
  readonly beat: number;
  readonly downbeat: boolean;
}

export interface MeasureBeat {
  readonly measure: number;
  readonly beat: number;
  /** 0..1 progress through the current beat. */
  readonly phase: number;
}

interface TimedLabel {
  readonly start: number;
  readonly end: number;
  readonly label: string;
}

export interface Timeline {
  /** Notes with a playable position, sorted by onset then string. */
  readonly notes: readonly PlacedNote[];
  readonly noteById: ReadonlyMap<number, PlacedNote>;
  /** Longest note in seconds: bounds how far back an active note can start. */
  readonly maxNoteSeconds: number;
  readonly events: readonly GuitarPercussiveEvent[];
  readonly chords: readonly TimedLabel[];
  readonly positions: readonly GuitarHandPosition[];
  readonly dynamics: readonly { readonly time: number; readonly mark: DynamicMark }[];
  readonly beats: readonly BeatMark[];
  readonly beatsPerBar: number;
  readonly tempoBpm: number;
  readonly duration: number;
  readonly stringCount: number;
  readonly fretCount: number;
  /** Ids of the first note of every strum / rasgueado stroke (the arrow is drawn once per stroke). */
  readonly strumLeads: ReadonlySet<number>;
  /** Notes the engine could not place on a string and fret. */
  readonly unplacedNotes: number;
}

// ---------------------------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/** First index whose key is greater than `x` (the array must be sorted by `key`). */
function upperBoundBy<T>(items: readonly T[], x: number, key: (item: T) => number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const item = items[mid];
    if (item !== undefined && key(item) <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose key is greater than or equal to `x`. */
function lowerBoundBy<T>(items: readonly T[], x: number, key: (item: T) => number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const item = items[mid];
    if (item !== undefined && key(item) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const noteOnset = (n: PlacedNote): number => n.onset;
const markTime = (m: BeatMark): number => m.time;
const eventTime = (e: GuitarPercussiveEvent): number => e.time;
const spanStart = (s: { readonly start: number }): number => s.start;
const dynamicTime = (d: { readonly time: number }): number => d.time;

// ---------------------------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------------------------

/** A sorted copy: by onset, then highest string (1) first, then id. */
export function sortNotes<T extends { readonly id: number; readonly onset: number; readonly string?: number | null }>(
  notes: readonly T[],
): T[] {
  return [...notes].sort((a, b) => a.onset - b.onset || (a.string ?? 99) - (b.string ?? 99) || a.id - b.id);
}

/** True when the note has a string and fret that exist on the instrument, and finite timing. */
export function isPlaceable(
  note: GuitarNote,
  stringCount: number,
  fretCount: number,
): note is GuitarNote & { readonly string: number; readonly fret: number } {
  return (
    isFiniteNumber(note.onset) &&
    isFiniteNumber(note.offset) &&
    typeof note.string === 'number' &&
    Number.isInteger(note.string) &&
    note.string >= 1 &&
    note.string <= stringCount &&
    typeof note.fret === 'number' &&
    Number.isInteger(note.fret) &&
    note.fret >= 0 &&
    note.fret <= fretCount
  );
}

function isBarre(barre: Barre | null | undefined): barre is Barre {
  return !!barre && isFiniteNumber(barre.fret) && isFiniteNumber(barre.fromString) && isFiniteNumber(barre.toString);
}

function strumDirection(note: GuitarNote): 'up' | 'down' | null {
  for (const technique of note.techniques ?? []) {
    if (technique.kind === 'rasgueado' || technique.kind === 'strum') return technique.direction ?? 'down';
  }
  return null;
}

/** Ids of the first note of each strum stroke: later notes of the same stroke share its arrow. */
function findStrumLeads(notes: readonly PlacedNote[]): Set<number> {
  const leads = new Set<number>();
  let previousOnset = Number.NEGATIVE_INFINITY;
  let previousDirection: 'up' | 'down' | null = null;
  for (const note of notes) {
    const direction = strumDirection(note);
    if (!direction) continue;
    const continuesStroke = direction === previousDirection && note.onset - previousOnset <= STRUM_GAP_SECONDS;
    if (!continuesStroke) leads.add(note.id);
    previousOnset = note.onset;
    previousDirection = direction;
  }
  return leads;
}

// ---------------------------------------------------------------------------------------------
// Beats and bars
// ---------------------------------------------------------------------------------------------

function collectBeatTimes(timing: GuitarTiming, duration: number): { time: number; down: boolean }[] {
  const byTime = (a: number, b: number): number => a - b;
  let beats = (timing.beats ?? []).filter(isFiniteNumber).sort(byTime);
  const downbeats = (timing.downbeats ?? []).filter(isFiniteNumber).sort(byTime);

  if (beats.length === 0 && downbeats.length === 0 && timing.tempoBpm > 0) {
    // No beat tracking: lay a grid from the nominal tempo so the bar counter still works.
    const secondsPerBeat = 60 / timing.tempoBpm;
    const start = isFiniteNumber(timing.firstBarStart) ? timing.firstBarStart : 0;
    const count =
      duration > start ? Math.min(MAX_SYNTHETIC_BEATS, Math.floor((duration - start) / secondsPerBeat) + 1) : 0;
    beats = Array.from({ length: count }, (_, i) => start + i * secondsPerBeat);
  }

  const marks = beats.map((time) => ({ time, down: false }));
  for (const downbeat of downbeats) {
    const at = lowerBoundBy(marks, downbeat - BEAT_TOLERANCE_SECONDS, (m) => m.time);
    const near = marks[at];
    if (near && Math.abs(near.time - downbeat) <= BEAT_TOLERANCE_SECONDS) {
      near.down = true;
    } else {
      marks.splice(at, 0, { time: downbeat, down: true });
    }
  }
  return marks;
}

/** Number every beat: bar (1-based; 0 for a pickup) and beat within the bar (1-based). */
function buildBeatMarks(timing: GuitarTiming, duration: number): BeatMark[] {
  const beatsPerBar = Math.max(1, Math.round(timing.beatsPerBar) || 4);
  const raw = collectBeatTimes(timing, duration);
  if (raw.length === 0) return [];

  let firstDown = raw.findIndex((m) => m.down);
  if (firstDown === -1) {
    // Without downbeats the first beat opens bar 1.
    const first = raw[0];
    if (first) first.down = true;
    firstDown = 0;
  }

  const marks: BeatMark[] = [];
  let measure = 0;
  let beat = 0;
  raw.forEach((m, i) => {
    if (i < firstDown) {
      // Pickup: counted backwards from the first downbeat, so a one-beat pickup is the bar's last beat.
      marks.push({ time: m.time, measure: 0, beat: Math.max(1, beatsPerBar - (firstDown - i) + 1), downbeat: false });
      return;
    }
    if (m.down) {
      measure += 1;
      beat = 1;
    } else {
      // A bar that runs past `beatsPerBar` beats without a detected downbeat rolls over by itself.
      beat += 1;
      if (beat > beatsPerBar) {
        measure += 1;
        beat = 1;
      }
    }
    marks.push({ time: m.time, measure, beat, downbeat: beat === 1 });
  });
  return marks;
}

// ---------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------

function normaliseSpans(
  spans: readonly { readonly start: number; readonly end: number; readonly label: string }[] | undefined,
): TimedLabel[] {
  return (spans ?? [])
    .filter((s) => isFiniteNumber(s.start) && isFiniteNumber(s.end) && s.end > s.start && typeof s.label === 'string')
    .map((s) => ({ start: s.start, end: s.end, label: s.label }))
    .sort((a, b) => a.start - b.start);
}

function deriveDynamicsFromNotes(notes: readonly PlacedNote[]): { time: number; mark: DynamicMark }[] {
  const out: { time: number; mark: DynamicMark }[] = [];
  let current: DynamicMark | null = null;
  for (const note of notes) {
    if (note.dynamic && note.dynamic !== current) {
      current = note.dynamic;
      out.push({ time: note.onset, mark: note.dynamic });
    }
  }
  return out;
}

export function buildTimeline(score: GuitarPerformance): Timeline {
  const geometry = score.instrument.geometry;
  const stringCount = Math.max(1, geometry.strings.length);
  const fretCount = Math.max(0, Math.min(geometry.fretCount, geometry.fretPositionsMm.length - 1));

  const placed: PlacedNote[] = [];
  let unplacedNotes = 0;
  for (const note of score.notes) {
    if (!isPlaceable(note, stringCount, fretCount)) {
      unplacedNotes += 1;
      continue;
    }
    placed.push({
      ...note,
      string: note.string,
      fret: note.fret,
      offset: Math.max(note.offset, note.onset + MIN_NOTE_SECONDS),
    });
  }
  const notes = sortNotes(placed);

  const noteById = new Map<number, PlacedNote>();
  let maxNoteSeconds = 0;
  let lastOffset = 0;
  for (const note of notes) {
    noteById.set(note.id, note);
    maxNoteSeconds = Math.max(maxNoteSeconds, note.offset - note.onset);
    lastOffset = Math.max(lastOffset, note.offset);
  }

  const declaredDuration = isFiniteNumber(score.source.durationSec) ? score.source.durationSec : 0;
  const duration = Math.max(lastOffset, declaredDuration);
  const beats = buildBeatMarks(score.timing, duration);

  const dynamics = (score.dynamics ?? [])
    .filter((d) => isFiniteNumber(d.time) && typeof d.mark === 'string')
    .map((d) => ({ time: d.time, mark: d.mark }))
    .sort((a, b) => a.time - b.time);

  return {
    notes,
    noteById,
    maxNoteSeconds,
    events: (score.events ?? []).filter((e) => isFiniteNumber(e.time)).sort((a, b) => a.time - b.time),
    chords: normaliseSpans(score.chords),
    positions: (score.positions ?? [])
      .filter((p) => isFiniteNumber(p.start) && isFiniteNumber(p.end) && isFiniteNumber(p.fret) && p.end > p.start)
      .sort((a, b) => a.start - b.start),
    dynamics: dynamics.length > 0 ? dynamics : deriveDynamicsFromNotes(notes),
    beats,
    beatsPerBar: Math.max(1, Math.round(score.timing.beatsPerBar) || 4),
    tempoBpm: score.timing.tempoBpm > 0 ? score.timing.tempoBpm : 120,
    duration: Math.max(duration, beats[beats.length - 1]?.time ?? 0),
    stringCount,
    fretCount,
    strumLeads: findStrumLeads(notes),
    unplacedNotes,
  };
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/**
 * Notes sounding at `t`: onset <= t < offset (+ `tail` seconds, used to fade a note out after it
 * ends). Returned oldest first.
 */
export function activeNotesAt(timeline: Timeline, t: number, tail = 0): PlacedNote[] {
  const { notes } = timeline;
  const out: PlacedNote[] = [];
  const after = upperBoundBy(notes, t, noteOnset);
  const earliest = t - timeline.maxNoteSeconds - tail;
  for (let i = after - 1; i >= 0; i -= 1) {
    const note = notes[i];
    if (!note || note.onset < earliest) break;
    if (note.offset + tail > t) out.push(note);
  }
  return out.reverse();
}

/** Notes that start after `t` and no later than `t + lookAhead`, in onset order. */
export function upcomingNotes(
  timeline: Timeline,
  t: number,
  lookAhead: number,
  limit = Number.POSITIVE_INFINITY,
): PlacedNote[] {
  const { notes } = timeline;
  const from = upperBoundBy(notes, t, noteOnset);
  const to = upperBoundBy(notes, t + lookAhead, noteOnset);
  return notes.slice(from, Math.min(to, from + limit));
}

/** Bar, beat and progress through the beat at `t`. Before the first beat: bar 0, beat 0. */
export function measureBeatAt(timeline: Timeline, t: number): MeasureBeat {
  const { beats } = timeline;
  const index = upperBoundBy(beats, t, markTime) - 1;
  const current = beats[index];
  if (!current) return { measure: 0, beat: 0, phase: 0 };
  const next = beats[index + 1];
  const span = next ? next.time - current.time : 60 / timeline.tempoBpm;
  return { measure: current.measure, beat: current.beat, phase: span > 0 ? clamp((t - current.time) / span, 0, 1) : 0 };
}

/** Beat marks with `from <= time <= to`, in order. */
export function beatMarksBetween(timeline: Timeline, from: number, to: number): readonly BeatMark[] {
  const { beats } = timeline;
  return beats.slice(lowerBoundBy(beats, from, markTime), upperBoundBy(beats, to, markTime));
}

/** Percussive events (golpe, tambora) with `from < time <= to`. */
export function eventsBetween(timeline: Timeline, from: number, to: number): readonly GuitarPercussiveEvent[] {
  const { events } = timeline;
  return events.slice(upperBoundBy(events, from, eventTime), upperBoundBy(events, to, eventTime));
}

/** The barré held at `t`: the one on the most recently struck sounding note that carries one. */
export function activeBarreAt(timeline: Timeline, t: number): Barre | null {
  let chosen: Barre | null = null;
  for (const note of activeNotesAt(timeline, t)) {
    if (isBarre(note.barre)) chosen = note.barre;
  }
  return chosen;
}

function labelAt(spans: readonly TimedLabel[], t: number): string | null {
  const index = upperBoundBy(spans, t, spanStart) - 1;
  const span = spans[index];
  return span && t < span.end ? span.label : null;
}

/** Chord label at `t`, or null between chords. */
export function chordAt(timeline: Timeline, t: number): string | null {
  return labelAt(timeline.chords, t);
}

/**
 * Where the left hand is at `t`: the position whose span contains `t`, else the most recent earlier
 * one (the hand stays where it was between positions), else null before the first.
 */
export function handPositionAt(timeline: Timeline, t: number): GuitarHandPosition | null {
  const index = upperBoundBy(timeline.positions, t, spanStart) - 1;
  return timeline.positions[index] ?? null;
}

/** The dynamic in force at `t`: the latest mark at or before it. */
export function dynamicAt(timeline: Timeline, t: number): DynamicMark | null {
  const index = upperBoundBy(timeline.dynamics, t, dynamicTime) - 1;
  return timeline.dynamics[index]?.mark ?? null;
}

/** How many seconds of upcoming notes to show: about one bar, kept in a readable range. */
export function lookAheadSeconds(timeline: Timeline): number {
  return clamp((60 / timeline.tempoBpm) * 4, 1.6, 4);
}

// ---------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------

const ROMAN: readonly (readonly [number, string])[] = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Hand positions are named by the fret under the index finger, in Roman numerals. */
export function positionLabel(fret: number): string {
  if (!Number.isInteger(fret) || fret < 1 || fret > 39) return String(fret);
  let rest = fret;
  let out = '';
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

const TECHNIQUE_WORDS: Readonly<Record<string, string>> = {
  vibrato: 'vibrato',
  bend: 'bend',
  harmonic: 'harmonic',
  rasgueado: 'rasgueado',
  strum: 'strum',
  tambora: 'tambora',
  'hammer-on': 'hammer-on',
  'pull-off': 'pull-off',
};

function techniqueWords(note: GuitarNote, includeStrum: boolean): string[] {
  const words: string[] = [];
  for (const technique of note.techniques ?? []) {
    if (technique.kind === 'slide') {
      words.push(technique.direction === 'down' ? 'slide down' : 'slide up');
    } else if (includeStrum || (technique.kind !== 'rasgueado' && technique.kind !== 'strum')) {
      const word = TECHNIQUE_WORDS[technique.kind];
      if (word) words.push(word);
    }
  }
  return words;
}

/**
 * "string 2 fret 3 finger 3": the note in the words a teacher would use. Techniques follow
 * ("... with hammer-on"); pass `strum: false` to leave the strum words out (a stroke is announced
 * once, not per string).
 */
export function describeNote(note: PlacedNote, options: { readonly strum?: boolean } = {}): string {
  const where = note.fret === 0 ? `string ${note.string} open` : `string ${note.string} fret ${note.fret}`;
  const finger = typeof note.lhFinger === 'number' && note.lhFinger > 0 ? ` finger ${note.lhFinger}` : '';
  const techniques = techniqueWords(note, options.strum ?? true);
  return `${where}${finger}${techniques.length > 0 ? ` with ${techniques.join(' and ')}` : ''}`;
}

function describeGroup(timeline: Timeline, group: readonly PlacedNote[]): string {
  const shown = group
    .slice(0, MAX_NOTES_PER_DESCRIPTION)
    .map((n) => describeNote(n, { strum: timeline.strumLeads.has(n.id) }));
  const more = group.length - shown.length;
  const barre = group.map((n) => n.barre).find(isBarre);
  let text = shown.join('; ');
  if (more > 0) text += ` and ${more} more`;
  if (barre) text += `, barre at fret ${barre.fret}`;
  return text;
}

/**
 * The next `groups` onsets in words, for a live region: notes plucked together (a chord or strum) are
 * one group. Empty when nothing is coming within `lookAhead`.
 */
export function describeUpcoming(timeline: Timeline, t: number, lookAhead: number, groups = 2): string {
  const upcoming = upcomingNotes(timeline, t, lookAhead);
  const described: string[] = [];
  let index = 0;
  while (index < upcoming.length && described.length < groups) {
    const first = upcoming[index];
    if (!first) break;
    const group: PlacedNote[] = [];
    while (index < upcoming.length) {
      const note = upcoming[index];
      if (!note || note.onset - first.onset > CHORD_WINDOW_SECONDS) break;
      group.push(note);
      index += 1;
    }
    described.push(describeGroup(timeline, group));
  }
  return described.join(', then ');
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Guards data that came over the network before it reaches the renderer: right schema, a usable
 * instrument geometry, usable timing and note times. It does not validate every optional field.
 */
export function isGuitarPerformance(value: unknown): value is GuitarPerformance {
  if (!isRecord(value) || value.schema !== GUITAR_PERFORMANCE_SCHEMA) return false;
  const { instrument, timing, notes, source } = value;
  if (!isRecord(source) || !Array.isArray(notes)) return false;
  if (!isRecord(instrument) || !isRecord(instrument.geometry) || !isRecord(instrument.tuning)) return false;
  const geometry = instrument.geometry;
  const positions = geometry.fretPositionsMm;
  if (!isFiniteNumber(geometry.scaleLengthMm) || geometry.scaleLengthMm <= 0) return false;
  if (!isFiniteNumber(geometry.fretCount) || !Array.isArray(positions) || positions.length < 2) return false;
  if (!positions.every(isFiniteNumber) || positions.some((p, i) => i > 0 && p <= (positions[i - 1] as number)))
    return false;
  if (!Array.isArray(geometry.strings) || geometry.strings.length < 1) return false;
  if (!isRecord(timing) || !Array.isArray(timing.beats) || !Array.isArray(timing.downbeats)) return false;
  if (!isFiniteNumber(timing.beatsPerBar) || !isFiniteNumber(timing.tempoBpm)) return false;
  return notes.every((n) => isRecord(n) && isFiniteNumber(n.id) && isFiniteNumber(n.onset) && isFiniteNumber(n.offset));
}
