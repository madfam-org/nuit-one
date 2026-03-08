// Analysis Web Worker
// Runs chord/key/BPM analysis off the main thread

// --- Chord Detection ---

const CHORD_TEMPLATES = {
  'C':   [1,0,0,0,1,0,0,1,0,0,0,0],
  'C#':  [0,1,0,0,0,1,0,0,1,0,0,0],
  'D':   [0,0,1,0,0,0,1,0,0,1,0,0],
  'D#':  [0,0,0,1,0,0,0,1,0,0,1,0],
  'E':   [0,0,0,0,1,0,0,0,1,0,0,1],
  'F':   [1,0,0,0,0,1,0,0,0,1,0,0],
  'F#':  [0,1,0,0,0,0,1,0,0,0,1,0],
  'G':   [0,0,1,0,0,0,0,1,0,0,0,1],
  'G#':  [1,0,0,1,0,0,0,0,1,0,0,0],
  'A':   [0,1,0,0,1,0,0,0,0,1,0,0],
  'A#':  [0,0,1,0,0,1,0,0,0,0,1,0],
  'B':   [0,0,0,1,0,0,1,0,0,0,0,1],
  'Cm':  [1,0,0,1,0,0,0,1,0,0,0,0],
  'C#m': [0,1,0,0,1,0,0,0,1,0,0,0],
  'Dm':  [0,0,1,0,0,1,0,0,0,1,0,0],
  'D#m': [0,0,0,1,0,0,1,0,0,0,1,0],
  'Em':  [0,0,0,0,1,0,0,1,0,0,0,1],
  'Fm':  [1,0,0,0,0,1,0,0,1,0,0,0],
  'F#m': [0,1,0,0,0,0,1,0,0,1,0,0],
  'Gm':  [0,0,1,0,0,0,0,1,0,0,0,1],
  'G#m': [1,0,0,1,0,0,0,0,1,0,0,0],
  'Am':  [0,1,0,0,1,0,0,0,0,1,0,0],
  'A#m': [0,0,1,0,0,1,0,0,0,0,1,0],
  'Bm':  [0,0,0,1,0,0,1,0,0,0,0,1],
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function computeChroma(samples, sampleRate) {
  const chroma = new Array(12).fill(0);
  const n = samples.length;

  for (let bin = 1; bin < n / 2; bin++) {
    const freq = (bin * sampleRate) / n;
    if (freq < 65 || freq > 2000) continue;

    let real = 0, imag = 0;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * bin * i) / n;
      real += samples[i] * Math.cos(angle);
      imag -= samples[i] * Math.sin(angle);
    }
    const magnitude = Math.sqrt(real * real + imag * imag);
    const midi = 12 * Math.log2(freq / 440) + 69;
    const chromaBin = ((Math.round(midi) % 12) + 12) % 12;
    chroma[chromaBin] += magnitude;
  }

  const max = Math.max(...chroma);
  if (max > 0) for (let i = 0; i < 12; i++) chroma[i] /= max;
  return chroma;
}

function matchChord(chroma) {
  let best = 'N', bestScore = -Infinity;
  for (const [name, template] of Object.entries(CHORD_TEMPLATES)) {
    let score = 0;
    for (let i = 0; i < 12; i++) score += chroma[i] * template[i];
    if (score > bestScore) { bestScore = score; best = name; }
  }
  return best;
}

function detectChords(samples, sampleRate) {
  const hopSize = Math.floor(sampleRate * 0.5);
  const frameSize = Math.min(4096, Math.floor(sampleRate * 1.0));
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  const chords = [];
  let lastChord = '', chordStart = 0;

  for (let f = 0; f <= numFrames; f++) {
    const offset = f * hopSize;
    const frame = samples.slice(offset, offset + frameSize);
    const chord = matchChord(computeChroma(frame, sampleRate));

    if (chord !== lastChord && lastChord) {
      const time = chordStart / sampleRate;
      const duration = (f * hopSize - chordStart) / sampleRate;
      if (duration > 0.25) chords.push({ time, duration, label: lastChord });
    }
    if (chord !== lastChord) { lastChord = chord; chordStart = offset; }
  }

  if (lastChord) {
    const time = chordStart / sampleRate;
    const duration = (samples.length - chordStart) / sampleRate;
    if (duration > 0.25) chords.push({ time, duration, label: lastChord });
  }
  return chords;
}

// --- Key Detection ---

function pearsonCorrelation(a, b) {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; denA += da * da; denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

function detectKey(chords) {
  const chromaProfile = new Array(12).fill(0);
  for (const chord of chords) {
    const isMinor = chord.label.endsWith('m');
    const root = isMinor ? chord.label.slice(0, -1) : chord.label;
    const rootIdx = NOTE_NAMES.indexOf(root);
    if (rootIdx >= 0) chromaProfile[rootIdx] += chord.duration;
  }

  let bestKey = 'C major', bestCorr = -Infinity;
  for (let shift = 0; shift < 12; shift++) {
    const rotated = chromaProfile.map((_, i) => chromaProfile[(i + shift) % 12]);
    const corrMaj = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (corrMaj > bestCorr) { bestCorr = corrMaj; bestKey = `${NOTE_NAMES[shift]} major`; }
    const corrMin = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (corrMin > bestCorr) { bestCorr = corrMin; bestKey = `${NOTE_NAMES[shift]} minor`; }
  }
  return { key: bestKey, confidence: Math.max(0, bestCorr) };
}

// --- BPM Detection ---

function detectBpm(samples, sampleRate) {
  const frameSize = 1024, hopSize = 512;
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  if (numFrames < 2) return 120;

  const envelope = new Float32Array(numFrames);
  let prevEnergy = 0;
  for (let f = 0; f < numFrames; f++) {
    let energy = 0;
    const offset = f * hopSize;
    for (let i = 0; i < frameSize; i++) energy += samples[offset + i] * samples[offset + i];
    envelope[f] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

  const minLag = Math.floor((60 / 200) * sampleRate / hopSize);
  const maxLag = Math.floor((60 / 60) * sampleRate / hopSize);
  let bestLag = minLag, bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, numFrames - 1); lag++) {
    let corr = 0, count = 0;
    for (let i = 0; i < numFrames - lag; i++) { corr += envelope[i] * envelope[i + lag]; count++; }
    corr /= count || 1;
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  return Math.round(60 / ((bestLag * hopSize) / sampleRate) * 10) / 10;
}

// --- Message Handler ---

self.onmessage = function (e) {
  const { type, payload } = e.data;
  const { id } = payload;

  if (type === 'analyze') {
    try {
      const samples = new Float32Array(payload.audioData);
      const sampleRate = payload.sampleRate;
      const totalSteps = 3;

      // Step 1: Chord detection
      self.postMessage({ type: 'progress', payload: { id, progress: 1 / totalSteps } });
      const chords = detectChords(samples, sampleRate);

      // Step 2: Key detection
      self.postMessage({ type: 'progress', payload: { id, progress: 2 / totalSteps } });
      const keyResult = detectKey(chords);

      // Step 3: BPM detection
      self.postMessage({ type: 'progress', payload: { id, progress: 2.5 / totalSteps } });
      const bpm = detectBpm(samples, sampleRate);

      self.postMessage({
        type: 'result',
        payload: {
          id,
          chords,
          key: keyResult.key,
          keyConfidence: keyResult.confidence,
          bpm,
        },
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        payload: { id, message: err.message || 'Analysis failed' },
      });
    }
  }
};
