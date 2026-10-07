# Guitar intake and the guitar twin

Last Updated: 2026-10-07

> Boundary note: this is the public design. Operational detail (deployment state,
> owner decisions, production findings) is kept in MADFAM's private operations
> record, not here.

## Goal

Give Nuit One a guitar intake: take any guitar performance video, from YouTube or
an uploaded file, and recover what was played well enough to teach it:

- **pitch and timing** of every note, with its intonation in cents and the
  performance's tuning reference;
- **where it was played:** string and fret, left-hand fingers (1–4, barré), and
  classical right-hand fingering (p-i-m-a);
- **how it was played:** vibrato, bends, slides, hammer-ons and pull-offs
  (ligados), harmonics, percussive effects, dynamics, articulation, tone colour,
  tempo map and rubato, and accent patterns (for example tango 3-3-2).

The result drives the guitar "visual instrumental karaoke": a fretboard rendered
from a guitar digital twin, with each upcoming note shown at its string, fret and
finger. It also exports to MusicXML (notation and TAB) and MIDI.

## Pipeline

```
URL / file ─► acquire ─► audio ─► notes (Basic Pitch + guitar clean-up) ─► exact pitch per note
                │                    │                                      │
                │                    └► beats / downbeats / meter ──────────┤
                │                                                           ▼
                └► video ─► neck fit (twin fret ladder) ─► hand position ─► fingering solver
                                                                            │
                                         techniques (pitch tracks, onsets) ◄┘
                                                                            ▼
                         nuit.guitar-performance/1 JSON ─► MusicXML · MIDI · karaoke chart
```

Implementation: the Python package in [`apps/transcriber`](../../apps/transcriber/README.md).
The API invokes it as a subprocess, the same way it already runs Demucs and
Basic Pitch.

## Stages and the evidence behind them

The first case is a solo classical (nylon-string) performance of Piazzolla's
*Libertango*: a static stage camera, 720p, 25 fps, 3:37.

**Acquisition.** The same video exposes different formats depending on the
yt-dlp version and the YouTube client. An out-of-date yt-dlp saw only a muxed
360p file; a current yt-dlp with a JavaScript runtime saw 720p H.264 plus Opus
audio. Every format selector therefore ends in a muxed fallback (`…/b`).

**Notes.** Basic Pitch on CPU takes 28 s for the 217 s clip and returns about
2,000 notes from E2 to D♯6. Its typical guitar errors are partials of loud bass
notes reported as notes (A2 → A4), and one sustained note split in two. The
engine removes a note only when a lower simultaneous note sits a harmonic
interval below it, carries more energy, and the upper note has no onset of its
own. It merges same-pitch continuations that have no onset peak. Each note's
frequency is then re-measured from its harmonics on a long-window STFT, with
parabolic peak interpolation. That per-frame pitch track (in cents) feeds the
tuning reference, intonation, vibrato, bends and slides.

**Rhythm.** Beat This! finds 4/4 and roughly 100–125 BPM with strong rubato.
Classical rubato is that tracker's weakest case, so the tempo map is kept
per beat rather than as one global tempo, and notes are quantised per beat to
16ths or triplets, recording their timing deviation.

**Video.** MediaPipe Hands reliably finds the plucking hand in full 720p frames,
but in a sample it found the fretting hand in only 3 of 6 frames: a curled
fretting hand seen from the front is an unusual pose. The fretboard itself is
very readable: fret wires are bright lines, and their spacing follows
`d(n) = L·(1 − 2^(−n/12))`. The video reader therefore:

1. fits the twin's fret ladder (a 1-D projective map from millimetres along
   the neck to pixels) to the fret-wire profile, anchored at the nut, and tracks
   it over time;
2. rectifies the neck into fret space and measures where skin covers the
   fingerboard: the edge nearest the nut gives the hand's position;
3. runs MediaPipe on an upscaled neck crop for per-finger detail when it
   succeeds.

At 720p one fret spans roughly 18–33 px, enough to read the hand position to
about one fret. That is what resolves the ambiguity audio alone cannot: the
same E4 can be played in five places.

**Fingering.** A beam search over chord events chooses a string and fret for
every note. Costs: hand-position movement scaled by the time available, fret
span, cutting a string that is still ringing, string crossings in fast
passages, open-string use, and distance from the hand position seen in the
video. Left-hand fingers follow from the position (one finger per fret, with
barré detection); classical right-hand fingering follows from string and voice
(p on the bass strings, i-m-a alternation in the trebles). Published learned
tablature models (MIDI-to-Tab, Fretting-Transformer) have no released
weights, so this is the strongest open approach; adding audio and video
evidence is what lifts accuracy in the recent literature.

**Techniques.** These come from the per-note pitch tracks and onset evidence:
- vibrato: periodic 4–8 Hz modulation;
- bends: a monotonic rise;
- slides: a continuous glide between notes on one string;
- ligados: a new pitch on the same string without a pluck transient;
- harmonics: pure spectra at the 12th/7th/5th-fret pitches;
- percussive golpe and tambora: onsets without new pitch, or many short notes struck together.

Dynamics come from per-note loudness, relative to the performance. No open
classifier exists for nylon-string techniques, so these are signal-processing
detectors with confidence values, not learned models.

## Output contract: `nuit.guitar-performance/1`

One JSON document per intake:
- **source:** id, title, duration;
- **instrument:** twin geometry, tuning, reference A4 in Hz, capo;
- **timing:** beats, downbeats, meter, tempo map;
- **notes:** onset, offset, MIDI, cents, velocity, confidence, string, fret,
  left-hand finger, right-hand finger, voice, quantised position, techniques;
- **hand positions;** **percussive events;** **harmony;** **style summary;**
- **quality report:** what was used, what was missing, warnings.

The TypeScript types in `packages/shared` and the karaoke view consume this
document.

## The guitar twin

The fretboard the karaoke view draws, and the geometry the video reader fits,
come from the same source: a guitar digital twin from the MADFAM hyperobjects
commons.

- **Hyperobject.** A parametric `guitar-neck` cartridge in
  [`madfam-org/solid-hyperobjects`](https://github.com/madfam-org/solid-hyperobjects)
  is proposed. Its parameters are scale length, fret count, frets to the body,
  nut width, width at the body joint, string count, string spacing at the
  saddle, fingerboard radius and tuning.
- **Contract.** The commons' frame-expression grammar has no exponentiation, so
  fret positions cannot be declared as frames. Consumers read the cartridge's
  *parameters* and apply the documented fret formula themselves.
  `instrument.from_geometry()` does exactly that, and `geometry_to_doc()` writes
  the same fields back into the performance document.
- **Twin record.** Type shells for commons cartridges are generated from the
  cartridge by the commons tooling, not written by hand. A player's own guitar
  becomes an *instance* of that type: scale length, string set and tuning as
  measured.

The same parameters give a 650 mm, 12-to-the-body classical guitar or a 648 mm
electric, so the intake, the video fit and the karaoke view stay consistent per
instrument.

## Candidate upgrades (sweep of 2026-10)

The sweep screened open components for commercial use, covering both code and weights.

| Candidate | What it adds | Published licence |
|---|---|---|
| alphaTab | TAB and notation from Guitar Pro, MusicXML or alphaTex, with fingering, techniques, playback, a karaoke cursor and per-note hit/miss colouring | MPL-2.0 |
| Signalsmith Stretch | Slow-down, loop and transpose practice, compiled into the C++→WASM engine | MIT |
| pitchy and our own spectral-flux onsets in the worklet | Low-latency live feedback that checks the *expected* notes (target-conditioned scoring) | 0BSD/MIT |
| all-in-one, lv-chordia | Song sections, beats, downbeats; chords | MIT |
| Matchmaker (pymatchmaker) | Live score following: where the player is | Apache-2.0 |
| MediaPipe Tasks Vision | In-browser fretting-hand coaching from the webcam | Apache-2.0 |
| SpessaSynth with MuseScore_General / FreePats nylon | Better playback of transcriptions | Apache-2.0; MIT / CC0 |
| Magenta RT 2, ACE-Step 1.5 | Player-following accompaniment prototype; offline backing tracks | Apache-2.0 + CC-BY-4.0; MIT |
| tuttut | Reference HMM/Viterbi tablature implementation | MIT |
| GAPS classical-guitar CRNN (ISMIR 2024) | Onset F ≈ 94 on nylon classical guitar | not adopted: training data is CC BY-NC-SA |
| CC BY 4.0 guitar data (GuitarSet, Guitar-TECHS, EGDB-PG, EGFxSet, Slakh2100, AG-PT-set, EG-IPT) | Training our own transcription and technique models | CC BY 4.0 |

## Next steps

1. Fingering solver and video reader, evaluated on the first case by overlaying
   the predicted positions on frames.
2. Technique detectors and the JSON/MusicXML/MIDI exporters.
3. API job and karaoke view (`FretboardHighway`) driven by the twin geometry.
4. `guitar-neck` cartridge proposal in the commons.
