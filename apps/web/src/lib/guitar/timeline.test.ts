import type { GuitarNote, GuitarPerformance } from '@nuit-one/shared';
import { GUITAR_TWIN_PRESETS, instrumentFromTwin } from '@nuit-one/shared';
import { describe, expect, it } from 'vitest';
import demoJson from '../data/guitar-demo-performance.json';
import {
  activeBarreAt,
  activeNotesAt,
  beatMarksBetween,
  buildTimeline,
  chordAt,
  describeNote,
  describeUpcoming,
  dynamicAt,
  eventsBetween,
  handPositionAt,
  isGuitarPerformance,
  isPlaceable,
  lookAheadSeconds,
  measureBeatAt,
  type PlacedNote,
  positionLabel,
  sortNotes,
  upcomingNotes,
} from './timeline.js';

const classical = GUITAR_TWIN_PRESETS['classical-650'];
if (!classical) throw new Error('classical-650 preset is missing');

function note(
  id: number,
  onset: number,
  offset: number,
  string: number | null,
  fret: number | null,
  extra: Partial<GuitarNote> = {},
): GuitarNote {
  return { id, onset, offset, midi: 60, velocity: 64, confidence: 1, string, fret, ...extra };
}

function score(notes: GuitarNote[], extra: Partial<GuitarPerformance> = {}): GuitarPerformance {
  return {
    schema: 'nuit.guitar-performance/1',
    engine: { name: 'test', version: '0' },
    source: { kind: 'synthetic', id: 'test', title: 'test' },
    instrument: instrumentFromTwin(classical as NonNullable<typeof classical>),
    timing: { beats: [], downbeats: [], beatsPerBar: 4, beatUnit: 4, tempoBpm: 120 },
    notes,
    quality: { notesTotal: notes.length, warnings: [] },
    ...extra,
  };
}

if (!isGuitarPerformance(demoJson)) throw new Error('the demo document must be a valid guitar performance');
const demo = buildTimeline(demoJson);

function demoNote(id: number): PlacedNote {
  const found = demo.noteById.get(id);
  if (!found) throw new Error(`the demo has no note ${id}`);
  return found;
}

describe('sortNotes', () => {
  it('orders by onset, then the highest string first, without touching the input', () => {
    const input = [note(3, 1, 2, 6, 0), note(1, 0, 1, 2, 1), note(2, 1, 2, 1, 0)];
    const sorted = sortNotes(input);
    expect(sorted.map((n) => n.id)).toEqual([1, 2, 3]);
    expect(input.map((n) => n.id)).toEqual([3, 1, 2]);
  });
});

describe('isPlaceable', () => {
  it('accepts open strings and rejects positions the instrument does not have', () => {
    expect(isPlaceable(note(1, 0, 1, 6, 0), 6, 19)).toBe(true);
    expect(isPlaceable(note(1, 0, 1, null, 3), 6, 19)).toBe(false);
    expect(isPlaceable(note(1, 0, 1, 2, null), 6, 19)).toBe(false);
    expect(isPlaceable(note(1, 0, 1, 7, 3), 6, 19)).toBe(false);
    expect(isPlaceable(note(1, 0, 1, 0, 3), 6, 19)).toBe(false);
    expect(isPlaceable(note(1, 0, 1, 2, 20), 6, 19)).toBe(false);
    expect(isPlaceable(note(1, 0, 1, 2, 3.5), 6, 19)).toBe(false);
    expect(isPlaceable(note(1, Number.NaN, 1, 2, 3), 6, 19)).toBe(false);
  });
});

describe('buildTimeline', () => {
  it('indexes the demo étude', () => {
    expect(demo.notes).toHaveLength(43);
    expect(demo.unplacedNotes).toBe(0);
    expect(demo.stringCount).toBe(6);
    expect(demo.fretCount).toBe(19);
    expect(demo.duration).toBeCloseTo(18.667, 3);
    expect(demoNote(26).techniques?.[0]?.kind).toBe('slide');
  });

  it('leaves out notes without a playable position and counts them', () => {
    const timeline = buildTimeline(score([note(1, 0, 1, 2, 3), note(2, 1, 2, null, null), note(3, 2, 3, 9, 1)]));
    expect(timeline.notes.map((n) => n.id)).toEqual([1]);
    expect(timeline.unplacedNotes).toBe(2);
  });

  it('keeps a zero-length note alive long enough to be seen', () => {
    const timeline = buildTimeline(score([note(1, 2, 2, 3, 2)]));
    expect(activeNotesAt(timeline, 2.1).map((n) => n.id)).toEqual([1]);
  });

  it('marks only the first note of a strum stroke as its lead', () => {
    expect([...demo.strumLeads]).toEqual([32]);
  });

  it('derives dynamics from the notes when the document has none', () => {
    const timeline = buildTimeline(
      score([
        note(1, 0, 1, 2, 3, { dynamic: 'p' }),
        note(2, 1, 2, 2, 3, { dynamic: 'p' }),
        note(3, 2, 3, 2, 3, { dynamic: 'f' }),
      ]),
    );
    expect(timeline.dynamics).toEqual([
      { time: 0, mark: 'p' },
      { time: 2, mark: 'f' },
    ]);
  });
});

describe('activeNotesAt', () => {
  it('returns the notes sounding at t, oldest first', () => {
    expect(activeNotesAt(demo, 0.4).map((n) => n.id)).toEqual([0, 1]);
    expect(activeNotesAt(demo, 8.2).map((n) => n.id)).toEqual([25, 24]);
  });

  it('treats onset as inclusive and offset as exclusive', () => {
    expect(activeNotesAt(demo, 0.3333).map((n) => n.id)).toContain(1);
    expect(activeNotesAt(demo, 0.6667).map((n) => n.id)).not.toContain(1);
    expect(activeNotesAt(demo, 0.6667).map((n) => n.id)).toContain(2);
  });

  it('finds a long note that began many short notes ago', () => {
    const notes = [note(1, 0, 10, 6, 0)];
    for (let i = 0; i < 18; i += 1) notes.push(note(10 + i, 1 + i * 0.5, 1.5 + i * 0.5, 2, 3));
    const timeline = buildTimeline(score(notes));
    expect(activeNotesAt(timeline, 9.2).map((n) => n.id)).toEqual([1, 26]);
  });

  it('keeps a note for `tail` seconds after it ends', () => {
    expect(activeNotesAt(demo, 1.4).map((n) => n.id)).not.toContain(3);
    expect(activeNotesAt(demo, 1.4, 0.2).map((n) => n.id)).toContain(3);
  });

  it('is empty before the first note and after the last', () => {
    expect(activeNotesAt(demo, -1)).toEqual([]);
    expect(activeNotesAt(demo, 30)).toEqual([]);
  });
});

describe('upcomingNotes', () => {
  it('returns the notes starting after t within the look-ahead', () => {
    expect(upcomingNotes(demo, 0.4, 1).map((n) => n.id)).toEqual([2, 3, 4]);
  });

  it('excludes a note starting exactly at t (it is active, not upcoming)', () => {
    expect(upcomingNotes(demo, 0.6667, 0.4).map((n) => n.id)).toEqual([3]);
  });

  it('includes a note starting exactly at the edge of the window', () => {
    expect(upcomingNotes(demo, 0, 0.3333).map((n) => n.id)).toEqual([1]);
  });

  it('honours a limit', () => {
    expect(upcomingNotes(demo, 0, 5, 2).map((n) => n.id)).toEqual([1, 2]);
  });
});

describe('measureBeatAt', () => {
  it('counts bars and beats from the demo grid (4/4, 90 BPM)', () => {
    expect(measureBeatAt(demo, 0)).toMatchObject({ measure: 1, beat: 1 });
    expect(measureBeatAt(demo, 0.7)).toMatchObject({ measure: 1, beat: 2 });
    expect(measureBeatAt(demo, 2.6667)).toMatchObject({ measure: 2, beat: 1 });
    expect(measureBeatAt(demo, 7.9)).toMatchObject({ measure: 3, beat: 4 });
    expect(measureBeatAt(demo, 8)).toMatchObject({ measure: 4, beat: 1 });
  });

  it('reports progress through the beat', () => {
    expect(measureBeatAt(demo, 0.33335).phase).toBeCloseTo(0.5, 2);
    expect(measureBeatAt(demo, 0).phase).toBe(0);
  });

  it('is bar 0, beat 0 before the first beat', () => {
    expect(measureBeatAt(demo, -2)).toEqual({ measure: 0, beat: 0, phase: 0 });
  });

  it('lays a grid from the tempo when the document has no beat tracking', () => {
    const timeline = buildTimeline(
      score([note(1, 0, 4, 3, 2)], {
        timing: { beats: [], downbeats: [], beatsPerBar: 3, beatUnit: 4, tempoBpm: 120 },
      }),
    );
    expect(measureBeatAt(timeline, 0.1)).toMatchObject({ measure: 1, beat: 1 });
    expect(measureBeatAt(timeline, 1.1)).toMatchObject({ measure: 1, beat: 3 });
    expect(measureBeatAt(timeline, 1.6)).toMatchObject({ measure: 2, beat: 1 });
  });

  it('numbers a pickup bar 0 and counts it back from the downbeat', () => {
    const timeline = buildTimeline(
      score([note(1, 0.5, 3, 3, 2)], {
        timing: { beats: [0.5, 1, 1.5, 2, 2.5, 3], downbeats: [1, 3], beatsPerBar: 4, beatUnit: 4, tempoBpm: 120 },
      }),
    );
    expect(measureBeatAt(timeline, 0.7)).toMatchObject({ measure: 0, beat: 4 });
    expect(measureBeatAt(timeline, 1.2)).toMatchObject({ measure: 1, beat: 1 });
    expect(measureBeatAt(timeline, 2.7)).toMatchObject({ measure: 1, beat: 4 });
    expect(measureBeatAt(timeline, 3.1)).toMatchObject({ measure: 2, beat: 1 });
  });

  it('merges a downbeat that is a hair off its beat, and rolls a bar over when no downbeat arrives', () => {
    const timeline = buildTimeline(
      score([note(1, 0, 6, 3, 2)], {
        timing: { beats: [0, 1, 2, 3, 4, 5], downbeats: [0, 2.005], beatsPerBar: 2, beatUnit: 4, tempoBpm: 60 },
      }),
    );
    expect(timeline.beats.filter((m) => m.downbeat).map((m) => m.time)).toEqual([0, 2, 4]);
    expect(measureBeatAt(timeline, 2.5)).toMatchObject({ measure: 2, beat: 1 });
    expect(measureBeatAt(timeline, 4.5)).toMatchObject({ measure: 3, beat: 1 });
  });
});

describe('beatMarksBetween', () => {
  it('lists the beats in a window and flags the downbeats', () => {
    const marks = beatMarksBetween(demo, 0, 2.7);
    expect(marks.map((m) => m.time)).toEqual([0, 0.6667, 1.3333, 2, 2.6667]);
    expect(marks.map((m) => m.downbeat)).toEqual([true, false, false, false, true]);
    expect(marks.map((m) => m.measure)).toEqual([1, 1, 1, 1, 2]);
  });

  it('is empty outside the music', () => {
    expect(beatMarksBetween(demo, 40, 50)).toEqual([]);
  });
});

describe('eventsBetween', () => {
  it('finds the golpe', () => {
    expect(eventsBetween(demo, 17, 18).map((e) => e.kind)).toEqual(['golpe']);
    expect(eventsBetween(demo, 17.3333, 18)).toEqual([]);
  });
});

describe('activeBarreAt', () => {
  it('returns the barré while the strummed F is sounding, and null otherwise', () => {
    expect(activeBarreAt(demo, 14)).toEqual({ fret: 1, fromString: 6, toString: 1 });
    expect(activeBarreAt(demo, 1)).toBeNull();
    expect(activeBarreAt(demo, 16.5)).toBeNull();
  });
});

describe('chordAt', () => {
  it('follows the chord track and is null in the gaps', () => {
    expect(chordAt(demo, 1)).toBe('Am');
    expect(chordAt(demo, 6)).toBe('Dm');
    expect(chordAt(demo, 10)).toBeNull();
    expect(chordAt(demo, 14)).toBe('F');
    expect(chordAt(demo, 17)).toBe('Am');
    expect(chordAt(demo, -1)).toBeNull();
    expect(chordAt(demo, 18.7)).toBeNull();
  });
});

describe('handPositionAt', () => {
  it('follows the positions and holds the last one when the track ends', () => {
    expect(handPositionAt(demo, 3)?.fret).toBe(1);
    expect(handPositionAt(demo, 8)?.fret).toBe(5);
    expect(handPositionAt(demo, 13.5)?.fret).toBe(1);
    expect(handPositionAt(demo, 25)?.fret).toBe(1);
    expect(handPositionAt(demo, -1)).toBeNull();
  });
});

describe('dynamicAt', () => {
  it('returns the mark in force', () => {
    expect(dynamicAt(demo, 0)).toBe('mp');
    expect(dynamicAt(demo, 9)).toBe('mf');
    expect(dynamicAt(demo, 11)).toBe('f');
    expect(dynamicAt(demo, 12.5)).toBe('p');
    expect(dynamicAt(demo, -1)).toBeNull();
  });
});

describe('lookAheadSeconds', () => {
  it('is about a bar of beats, kept in a readable range', () => {
    expect(lookAheadSeconds(demo)).toBeCloseTo(2.667, 2);
    const fast = buildTimeline(
      score([], { timing: { beats: [], downbeats: [], beatsPerBar: 4, beatUnit: 4, tempoBpm: 200 } }),
    );
    const slow = buildTimeline(
      score([], { timing: { beats: [], downbeats: [], beatsPerBar: 4, beatUnit: 4, tempoBpm: 40 } }),
    );
    expect(lookAheadSeconds(fast)).toBe(1.6);
    expect(lookAheadSeconds(slow)).toBe(4);
  });
});

describe('positionLabel', () => {
  it('names positions in Roman numerals', () => {
    expect(positionLabel(1)).toBe('I');
    expect(positionLabel(5)).toBe('V');
    expect(positionLabel(7)).toBe('VII');
    expect(positionLabel(9)).toBe('IX');
    expect(positionLabel(12)).toBe('XII');
    expect(positionLabel(19)).toBe('XIX');
    expect(positionLabel(0)).toBe('0');
  });
});

describe('describeNote', () => {
  it('speaks string, fret and finger', () => {
    expect(describeNote(demoNote(1))).toBe('string 3 fret 2 finger 2');
  });

  it('calls fret 0 open and leaves out finger 0', () => {
    expect(describeNote(demoNote(3))).toBe('string 1 open');
  });

  it('adds techniques', () => {
    expect(describeNote(demoNote(26))).toBe('string 1 fret 7 finger 1 with slide up');
    expect(describeNote(demoNote(28))).toBe('string 2 fret 3 finger 3 with hammer-on');
  });

  it('can leave the strum words out', () => {
    expect(describeNote(demoNote(33))).toBe('string 5 fret 3 finger 3 with rasgueado');
    expect(describeNote(demoNote(33), { strum: false })).toBe('string 5 fret 3 finger 3');
  });
});

describe('describeUpcoming', () => {
  it('describes the next two onsets', () => {
    expect(describeUpcoming(demo, 0.2, 1)).toBe('string 3 fret 2 finger 2, then string 2 fret 1 finger 1');
  });

  it('treats a strum as one group, announces the stroke once and names the barré', () => {
    const text = describeUpcoming(demo, 13, 0.5, 1);
    expect(text.startsWith('string 6 fret 1 finger 1 with rasgueado; string 5 fret 3 finger 3; ')).toBe(true);
    expect(text).toContain('and 2 more');
    expect(text.endsWith(', barre at fret 1')).toBe(true);
    expect(text.match(/rasgueado/g)).toHaveLength(1);
  });

  it('is empty when nothing is coming', () => {
    expect(describeUpcoming(demo, 30, 3)).toBe('');
  });
});

describe('isGuitarPerformance', () => {
  it('accepts the demo document', () => {
    expect(isGuitarPerformance(demoJson)).toBe(true);
  });

  it('rejects anything that would crash the renderer', () => {
    expect(isGuitarPerformance(null)).toBe(false);
    expect(isGuitarPerformance({})).toBe(false);
    expect(isGuitarPerformance({ ...demoJson, schema: 'something-else' })).toBe(false);
    expect(isGuitarPerformance({ ...demoJson, notes: 'nope' })).toBe(false);
    expect(isGuitarPerformance({ ...demoJson, notes: [{ id: 1, onset: 'late', offset: 2 }] })).toBe(false);
    expect(
      isGuitarPerformance({
        ...demoJson,
        instrument: {
          ...demoJson.instrument,
          geometry: { ...demoJson.instrument.geometry, fretPositionsMm: [0, 40, 30] },
        },
      }),
    ).toBe(false);
    expect(isGuitarPerformance({ ...demoJson, timing: { ...demoJson.timing, beats: undefined } })).toBe(false);
  });
});
