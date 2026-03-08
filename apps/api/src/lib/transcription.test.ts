import { describe, it, expect } from 'vitest';
import { parseNoteEventsCsv } from './transcription.js';

describe('parseNoteEventsCsv', () => {
  it('parses Basic Pitch 0.4+ CSV with start_time and end_time columns', () => {
    const csv = [
      'start_time_s,end_time_s,pitch_midi,velocity,pitch_bend',
      '0.500,1.200,45,80,0.0',
      '1.300,2.000,48,100,0.0',
      '2.100,2.500,52,60,0.0',
    ].join('\n');

    const notes = parseNoteEventsCsv(csv);

    expect(notes).toHaveLength(3);
    expect(notes[0]).toEqual({
      startTime: 0.5,
      duration: expect.closeTo(0.7, 5),
      pitch: 45,
      velocity: 80,
    });
    expect(notes[1]).toEqual({
      startTime: 1.3,
      duration: expect.closeTo(0.7, 5),
      pitch: 48,
      velocity: 100,
    });
    expect(notes[2]).toEqual({
      startTime: 2.1,
      duration: expect.closeTo(0.4, 5),
      pitch: 52,
      velocity: 60,
    });
  });

  it('skips rows with fewer than 4 columns', () => {
    const csv = [
      'start_time_s,end_time_s,pitch_midi,velocity',
      '0.5,1.0,45,80',
      '1.0,1.5', // incomplete row
      '2.0,2.5,50,90',
    ].join('\n');

    const notes = parseNoteEventsCsv(csv);
    expect(notes).toHaveLength(2);
  });

  it('rounds pitch and velocity to integers', () => {
    const csv = [
      'start_time_s,end_time_s,pitch_midi,velocity,pitch_bend',
      '0.0,1.0,44.7,79.6,0.0',
    ].join('\n');

    const notes = parseNoteEventsCsv(csv);
    expect(notes[0]!.pitch).toBe(45);
    expect(notes[0]!.velocity).toBe(80);
  });

  it('returns empty array for header-only CSV', () => {
    const csv = 'start_time_s,end_time_s,pitch_midi,velocity';
    const notes = parseNoteEventsCsv(csv);
    expect(notes).toHaveLength(0);
  });
});
