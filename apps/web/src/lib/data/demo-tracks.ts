export const DEMO_PROJECT_ID = 'demo0000-0000-0000-0000-000000000001';

export const DEMO_TRACKS = [
  {
    id: 'demo0000-0000-0000-0000-000000000010',
    title: 'Neon Groove (Demo)',
    stems: [
      {
        stemType: 'bass' as const,
        r2Key: 'demo/neon-groove/bass.wav',
        notes: generateBassLine(120, 30),
      },
      {
        stemType: 'drums' as const,
        r2Key: 'demo/neon-groove/drums.wav',
        notes: generateDrumPattern(120, 30),
      },
      {
        stemType: 'vocals' as const,
        r2Key: 'demo/neon-groove/vocals.wav',
        notes: generateMelody(120, 30),
      },
      {
        stemType: 'other' as const,
        r2Key: 'demo/neon-groove/other.wav',
        notes: generateChordProgression(120, 30),
      },
    ],
  },
  {
    id: 'demo0000-0000-0000-0000-000000000020',
    title: 'Midnight Riff (Demo)',
    stems: [
      {
        stemType: 'bass' as const,
        r2Key: 'demo/midnight-riff/bass.wav',
        notes: generateBassLine(90, 40),
      },
      {
        stemType: 'drums' as const,
        r2Key: 'demo/midnight-riff/drums.wav',
        notes: generateDrumPattern(90, 40),
      },
      {
        stemType: 'vocals' as const,
        r2Key: 'demo/midnight-riff/vocals.wav',
        notes: generateMelody(90, 40),
      },
      {
        stemType: 'other' as const,
        r2Key: 'demo/midnight-riff/other.wav',
        notes: generateChordProgression(90, 40),
      },
    ],
  },
];

// Generate a simple bass line pattern (8th notes on root + fifth)
function generateBassLine(bpm: number, durationSec: number) {
  const beatDur = 60 / bpm;
  const notes: Array<{ startTime: number; duration: number; pitch: number; velocity: number }> = [];
  const pattern = [40, 40, 47, 40, 43, 43, 47, 43]; // E2, E2, B2, E2, G2, G2, B2, G2
  let time = 0;
  let i = 0;
  while (time < durationSec) {
    notes.push({
      startTime: time,
      duration: beatDur * 0.45,
      pitch: pattern[i % pattern.length]!,
      velocity: 80 + Math.round(Math.sin(i * 0.7) * 20),
    });
    time += beatDur * 0.5;
    i++;
  }
  return notes;
}

// Generate a simple drum pattern (kick on 1,3; snare on 2,4; hi-hat on 8ths)
function generateDrumPattern(bpm: number, durationSec: number) {
  const beatDur = 60 / bpm;
  const notes: Array<{ startTime: number; duration: number; pitch: number; velocity: number }> = [];
  let time = 0;
  let beat = 0;
  while (time < durationSec) {
    const beatInBar = beat % 4;
    // Kick on 1, 3
    if (beatInBar === 0 || beatInBar === 2) {
      notes.push({ startTime: time, duration: 0.1, pitch: 36, velocity: 100 });
    }
    // Snare on 2, 4
    if (beatInBar === 1 || beatInBar === 3) {
      notes.push({ startTime: time, duration: 0.1, pitch: 38, velocity: 90 });
    }
    // Hi-hat on every 8th
    notes.push({ startTime: time, duration: 0.05, pitch: 42, velocity: 70 });
    notes.push({ startTime: time + beatDur * 0.5, duration: 0.05, pitch: 42, velocity: 60 });
    time += beatDur;
    beat++;
  }
  return notes;
}

// Generate a simple melody (pentatonic scale)
function generateMelody(bpm: number, durationSec: number) {
  const beatDur = 60 / bpm;
  const scale = [64, 67, 69, 71, 74, 76, 79]; // E pentatonic, octave 4-5
  const notes: Array<{ startTime: number; duration: number; pitch: number; velocity: number }> = [];
  let time = beatDur * 4; // start after 4-beat intro
  let i = 0;
  while (time < durationSec - 2) {
    const dur = (i % 3 === 0 ? 2 : 1) * beatDur;
    notes.push({
      startTime: time,
      duration: dur * 0.9,
      pitch: scale[i % scale.length]!,
      velocity: 85 + Math.round(Math.sin(i * 0.5) * 15),
    });
    time += dur;
    i++;
  }
  return notes;
}

// Generate chord progression (sustained chords, 2 beats each)
function generateChordProgression(bpm: number, durationSec: number) {
  const beatDur = 60 / bpm;
  const chordRoots = [52, 55, 57, 52]; // E3, G3, A3, E3
  const notes: Array<{ startTime: number; duration: number; pitch: number; velocity: number }> = [];
  let time = 0;
  let i = 0;
  while (time < durationSec) {
    const root = chordRoots[i % chordRoots.length]!;
    notes.push({ startTime: time, duration: beatDur * 1.8, pitch: root, velocity: 75 });
    notes.push({ startTime: time, duration: beatDur * 1.8, pitch: root + 4, velocity: 70 });
    notes.push({ startTime: time, duration: beatDur * 1.8, pitch: root + 7, velocity: 70 });
    time += beatDur * 2;
    i++;
  }
  return notes;
}
