import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  AudioFormat,
  SampleRate,
  BufferSize,
  AudioDeviceInfo,
  AudioEngineState,
  AudioProcessingConfig,
  MidiNote,
  MidiEvent,
  MidiTrack,
  TrackStatus,
  StemSource,
  StemType,
  Project,
  Track,
  Stem,
  WorkspaceRole,
  Workspace,
  WorkspaceMember,
  PerformanceScore,
  HitResult,
  NoteHit,
  Performance,
  CalibrationProfile,
  CalibrationStep,
  CalibrationState,
  NoteEvent,
  HitJudgment,
  PerformanceResult,
} from './index.js';

// ---------------------------------------------------------------------------
// Helpers: We create conforming objects at runtime and use expectTypeOf to
// verify the type system accepts or rejects values as expected.
// ---------------------------------------------------------------------------

describe('audio types', () => {
  describe('AudioFormat', () => {
    it('accepts valid audio formats', () => {
      expectTypeOf<'wav'>().toMatchTypeOf<AudioFormat>();
      expectTypeOf<'flac'>().toMatchTypeOf<AudioFormat>();
      expectTypeOf<'mp3'>().toMatchTypeOf<AudioFormat>();
      expectTypeOf<'ogg'>().toMatchTypeOf<AudioFormat>();
    });

    it('rejects invalid audio formats', () => {
      expectTypeOf<'aac'>().not.toMatchTypeOf<AudioFormat>();
      expectTypeOf<'midi'>().not.toMatchTypeOf<AudioFormat>();
      expectTypeOf<number>().not.toMatchTypeOf<AudioFormat>();
    });
  });

  describe('SampleRate', () => {
    it('accepts valid sample rates', () => {
      expectTypeOf<44100>().toMatchTypeOf<SampleRate>();
      expectTypeOf<48000>().toMatchTypeOf<SampleRate>();
      expectTypeOf<96000>().toMatchTypeOf<SampleRate>();
    });

    it('rejects invalid sample rates', () => {
      expectTypeOf<22050>().not.toMatchTypeOf<SampleRate>();
      expectTypeOf<192000>().not.toMatchTypeOf<SampleRate>();
      expectTypeOf<string>().not.toMatchTypeOf<SampleRate>();
    });
  });

  describe('BufferSize', () => {
    it('accepts valid buffer sizes', () => {
      expectTypeOf<64>().toMatchTypeOf<BufferSize>();
      expectTypeOf<128>().toMatchTypeOf<BufferSize>();
      expectTypeOf<256>().toMatchTypeOf<BufferSize>();
      expectTypeOf<512>().toMatchTypeOf<BufferSize>();
      expectTypeOf<1024>().toMatchTypeOf<BufferSize>();
    });

    it('rejects invalid buffer sizes', () => {
      expectTypeOf<32>().not.toMatchTypeOf<BufferSize>();
      expectTypeOf<2048>().not.toMatchTypeOf<BufferSize>();
    });
  });

  describe('AudioEngineState', () => {
    it('accepts all valid engine states', () => {
      expectTypeOf<'uninitialized'>().toMatchTypeOf<AudioEngineState>();
      expectTypeOf<'initializing'>().toMatchTypeOf<AudioEngineState>();
      expectTypeOf<'running'>().toMatchTypeOf<AudioEngineState>();
      expectTypeOf<'suspended'>().toMatchTypeOf<AudioEngineState>();
      expectTypeOf<'error'>().toMatchTypeOf<AudioEngineState>();
    });

    it('rejects invalid engine states', () => {
      expectTypeOf<'stopped'>().not.toMatchTypeOf<AudioEngineState>();
      expectTypeOf<'paused'>().not.toMatchTypeOf<AudioEngineState>();
    });
  });

  describe('AudioDeviceInfo', () => {
    it('has the expected shape', () => {
      expectTypeOf<AudioDeviceInfo>().toHaveProperty('id');
      expectTypeOf<AudioDeviceInfo>().toHaveProperty('name');
      expectTypeOf<AudioDeviceInfo>().toHaveProperty('kind');
      expectTypeOf<AudioDeviceInfo>().toHaveProperty('sampleRates');
      expectTypeOf<AudioDeviceInfo>().toHaveProperty('channelCount');
    });

    it('validates property types', () => {
      expectTypeOf<AudioDeviceInfo['id']>().toBeString();
      expectTypeOf<AudioDeviceInfo['name']>().toBeString();
      expectTypeOf<AudioDeviceInfo['channelCount']>().toBeNumber();
    });

    it('accepts a conforming runtime object', () => {
      const device: AudioDeviceInfo = {
        id: 'dev-1',
        name: 'Built-in Microphone',
        kind: 'input',
        sampleRates: [44100, 48000],
        channelCount: 2,
      };
      expect(device.id).toBe('dev-1');
      expect(device.kind).toBe('input');
    });
  });

  describe('AudioProcessingConfig', () => {
    it('has the expected shape', () => {
      expectTypeOf<AudioProcessingConfig>().toHaveProperty('sampleRate');
      expectTypeOf<AudioProcessingConfig>().toHaveProperty('bufferSize');
      expectTypeOf<AudioProcessingConfig>().toHaveProperty('channelCount');
      expectTypeOf<AudioProcessingConfig>().toHaveProperty('enableMonitoring');
    });

    it('accepts a conforming runtime object', () => {
      const config: AudioProcessingConfig = {
        sampleRate: 44100,
        bufferSize: 256,
        channelCount: 2,
        enableMonitoring: true,
      };
      expect(config.sampleRate).toBe(44100);
      expect(config.enableMonitoring).toBe(true);
    });
  });
});

describe('midi types', () => {
  describe('MidiNote', () => {
    it('has the expected shape', () => {
      expectTypeOf<MidiNote>().toHaveProperty('pitch');
      expectTypeOf<MidiNote>().toHaveProperty('velocity');
      expectTypeOf<MidiNote>().toHaveProperty('startTime');
      expectTypeOf<MidiNote>().toHaveProperty('duration');
      expectTypeOf<MidiNote>().toHaveProperty('channel');
    });

    it('accepts a conforming runtime object', () => {
      const note: MidiNote = {
        pitch: 60,
        velocity: 100,
        startTime: 0.0,
        duration: 0.5,
        channel: 0,
      };
      expect(note.pitch).toBe(60);
      expect(note.velocity).toBe(100);
      expect(note.channel).toBe(0);
    });
  });

  describe('MidiEvent discriminated union', () => {
    it('accepts a note_on event', () => {
      const event: MidiEvent = {
        type: 'note_on',
        pitch: 60,
        velocity: 100,
        channel: 0,
      };
      expect(event.type).toBe('note_on');
    });

    it('accepts a note_off event', () => {
      const event: MidiEvent = {
        type: 'note_off',
        pitch: 60,
        velocity: 0,
        channel: 0,
      };
      expect(event.type).toBe('note_off');
    });

    it('accepts a control_change event', () => {
      const event: MidiEvent = {
        type: 'control_change',
        controller: 64,
        value: 127,
        channel: 0,
      };
      expect(event.type).toBe('control_change');
    });

    it('accepts a pitch_bend event', () => {
      const event: MidiEvent = {
        type: 'pitch_bend',
        value: 8192,
        channel: 0,
      };
      expect(event.type).toBe('pitch_bend');
    });

    it('narrows correctly on the type discriminant', () => {
      const event: MidiEvent = {
        type: 'control_change',
        controller: 1,
        value: 64,
        channel: 0,
      };

      // Discriminated union narrowing: only control_change has 'controller'
      if (event.type === 'control_change') {
        expect(event.controller).toBe(1);
        expect(event.value).toBe(64);
      } else {
        // This branch should not execute
        expect.unreachable('Expected control_change event');
      }
    });

    it('exhaustive switch covers all event types', () => {
      const events: MidiEvent[] = [
        { type: 'note_on', pitch: 60, velocity: 100, channel: 0 },
        { type: 'note_off', pitch: 60, velocity: 0, channel: 0 },
        { type: 'control_change', controller: 64, value: 127, channel: 0 },
        { type: 'pitch_bend', value: 8192, channel: 0 },
      ];

      const typesSeen = new Set<string>();

      for (const event of events) {
        switch (event.type) {
          case 'note_on':
            typesSeen.add('note_on');
            break;
          case 'note_off':
            typesSeen.add('note_off');
            break;
          case 'control_change':
            typesSeen.add('control_change');
            break;
          case 'pitch_bend':
            typesSeen.add('pitch_bend');
            break;
        }
      }

      expect(typesSeen.size).toBe(4);
      expect(typesSeen).toContain('note_on');
      expect(typesSeen).toContain('note_off');
      expect(typesSeen).toContain('control_change');
      expect(typesSeen).toContain('pitch_bend');
    });

    it('rejects invalid event type at the type level', () => {
      expectTypeOf<'sustain'>().not.toMatchTypeOf<MidiEvent['type']>();
    });
  });

  describe('MidiTrack', () => {
    it('has the expected shape', () => {
      expectTypeOf<MidiTrack>().toHaveProperty('name');
      expectTypeOf<MidiTrack>().toHaveProperty('notes');
      expectTypeOf<MidiTrack>().toHaveProperty('events');
      expectTypeOf<MidiTrack>().toHaveProperty('instrument');
    });

    it('accepts a conforming runtime object', () => {
      const track: MidiTrack = {
        name: 'Piano',
        notes: [{ pitch: 60, velocity: 100, startTime: 0, duration: 1, channel: 0 }],
        events: [{ type: 'note_on', pitch: 60, velocity: 100, channel: 0 }],
        instrument: 'Acoustic Grand Piano',
      };
      expect(track.name).toBe('Piano');
      expect(track.notes).toHaveLength(1);
      expect(track.events).toHaveLength(1);
    });
  });
});

describe('project types', () => {
  describe('TrackStatus', () => {
    it('accepts all valid statuses', () => {
      expectTypeOf<'needs_parts'>().toMatchTypeOf<TrackStatus>();
      expectTypeOf<'in_progress'>().toMatchTypeOf<TrackStatus>();
      expectTypeOf<'delivered'>().toMatchTypeOf<TrackStatus>();
      expectTypeOf<'approved'>().toMatchTypeOf<TrackStatus>();
    });

    it('accepts upload lifecycle statuses', () => {
      expectTypeOf<'pending_upload'>().toMatchTypeOf<TrackStatus>();
      expectTypeOf<'uploaded'>().toMatchTypeOf<TrackStatus>();
      expectTypeOf<'processing'>().toMatchTypeOf<TrackStatus>();
      expectTypeOf<'ready'>().toMatchTypeOf<TrackStatus>();
      expectTypeOf<'error'>().toMatchTypeOf<TrackStatus>();
    });

    it('rejects invalid statuses', () => {
      expectTypeOf<'draft'>().not.toMatchTypeOf<TrackStatus>();
      expectTypeOf<'archived'>().not.toMatchTypeOf<TrackStatus>();
    });

    it('covers all 9 status values at runtime', () => {
      const allStatuses: TrackStatus[] = [
        'pending_upload', 'uploaded', 'processing', 'ready', 'error',
        'needs_parts', 'in_progress', 'delivered', 'approved',
      ];
      expect(allStatuses).toHaveLength(9);
      expect(new Set(allStatuses).size).toBe(9);
    });
  });

  describe('StemSource', () => {
    it('accepts all valid sources', () => {
      expectTypeOf<'upload'>().toMatchTypeOf<StemSource>();
      expectTypeOf<'recording'>().toMatchTypeOf<StemSource>();
      expectTypeOf<'demucs'>().toMatchTypeOf<StemSource>();
      expectTypeOf<'basic_pitch'>().toMatchTypeOf<StemSource>();
    });

    it('rejects invalid sources', () => {
      expectTypeOf<'import'>().not.toMatchTypeOf<StemSource>();
      expectTypeOf<'generated'>().not.toMatchTypeOf<StemSource>();
    });

    it('covers exactly 4 source values at runtime', () => {
      const allSources: StemSource[] = ['upload', 'recording', 'demucs', 'basic_pitch'];
      expect(allSources).toHaveLength(4);
      expect(new Set(allSources).size).toBe(4);
    });
  });

  describe('StemType', () => {
    it('accepts all valid stem types', () => {
      expectTypeOf<'bass'>().toMatchTypeOf<StemType>();
      expectTypeOf<'no_bass'>().toMatchTypeOf<StemType>();
      expectTypeOf<'vocals'>().toMatchTypeOf<StemType>();
      expectTypeOf<'drums'>().toMatchTypeOf<StemType>();
      expectTypeOf<'other'>().toMatchTypeOf<StemType>();
    });

    it('rejects invalid stem types', () => {
      expectTypeOf<'guitar'>().not.toMatchTypeOf<StemType>();
      expectTypeOf<'piano'>().not.toMatchTypeOf<StemType>();
    });

    it('covers exactly 5 stem type values at runtime', () => {
      const allTypes: StemType[] = ['bass', 'no_bass', 'vocals', 'drums', 'other'];
      expect(allTypes).toHaveLength(5);
      expect(new Set(allTypes).size).toBe(5);
    });
  });

  describe('Project', () => {
    it('has the expected shape', () => {
      expectTypeOf<Project>().toHaveProperty('id');
      expectTypeOf<Project>().toHaveProperty('workspaceId');
      expectTypeOf<Project>().toHaveProperty('name');
      expectTypeOf<Project>().toHaveProperty('tempoBpm');
      expectTypeOf<Project>().toHaveProperty('timeSignature');
      expectTypeOf<Project>().toHaveProperty('createdBy');
      expectTypeOf<Project>().toHaveProperty('createdAt');
    });

    it('accepts a conforming runtime object', () => {
      const project: Project = {
        id: 'proj-1',
        workspaceId: 'ws-1',
        name: 'My Song',
        tempoBpm: 120,
        timeSignature: '4/4',
        createdBy: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(project.id).toBe('proj-1');
      expect(project.tempoBpm).toBe(120);
    });
  });

  describe('Track', () => {
    it('has the expected shape', () => {
      expectTypeOf<Track>().toHaveProperty('id');
      expectTypeOf<Track>().toHaveProperty('projectId');
      expectTypeOf<Track>().toHaveProperty('userId');
      expectTypeOf<Track>().toHaveProperty('title');
      expectTypeOf<Track>().toHaveProperty('instrument');
      expectTypeOf<Track>().toHaveProperty('status');
      expectTypeOf<Track>().toHaveProperty('r2Key');
      expectTypeOf<Track>().toHaveProperty('originalFilename');
      expectTypeOf<Track>().toHaveProperty('fileSizeBytes');
      expectTypeOf<Track>().toHaveProperty('contentType');
      expectTypeOf<Track>().toHaveProperty('assignedTo');
      expectTypeOf<Track>().toHaveProperty('sortOrder');
      expectTypeOf<Track>().toHaveProperty('createdAt');
    });

    it('allows assignedTo to be null', () => {
      const track: Track = {
        id: 'track-1',
        projectId: 'proj-1',
        userId: 'user-1',
        title: 'Test Track',
        instrument: 'Guitar',
        status: 'needs_parts',
        r2Key: null,
        originalFilename: null,
        fileSizeBytes: null,
        contentType: null,
        assignedTo: null,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(track.assignedTo).toBeNull();
    });

    it('allows assignedTo to be a string', () => {
      const track: Track = {
        id: 'track-2',
        projectId: 'proj-1',
        userId: 'user-1',
        title: 'Test Track 2',
        instrument: 'Bass',
        status: 'in_progress',
        r2Key: 'tracks/123/original/song.wav',
        originalFilename: 'song.wav',
        fileSizeBytes: 1048576,
        contentType: 'audio/wav',
        assignedTo: 'user-1',
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(track.assignedTo).toBe('user-1');
    });
  });

  describe('Stem', () => {
    it('has the expected shape', () => {
      expectTypeOf<Stem>().toHaveProperty('id');
      expectTypeOf<Stem>().toHaveProperty('trackId');
      expectTypeOf<Stem>().toHaveProperty('stemType');
      expectTypeOf<Stem>().toHaveProperty('r2Key');
      expectTypeOf<Stem>().toHaveProperty('fileSizeBytes');
      expectTypeOf<Stem>().toHaveProperty('durationSeconds');
      expectTypeOf<Stem>().toHaveProperty('sampleRate');
      expectTypeOf<Stem>().toHaveProperty('source');
      expectTypeOf<Stem>().toHaveProperty('midiData');
      expectTypeOf<Stem>().toHaveProperty('createdBy');
      expectTypeOf<Stem>().toHaveProperty('createdAt');
    });

    it('accepts a conforming runtime object', () => {
      const stem: Stem = {
        id: 'stem-1',
        trackId: 'track-1',
        stemType: 'bass',
        r2Key: 'stems/abc123.wav',
        fileSizeBytes: 1048576,
        durationSeconds: 30.5,
        sampleRate: 44100,
        source: 'upload',
        midiData: null,
        createdBy: 'user-1',
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(stem.source).toBe('upload');
      expect(stem.sampleRate).toBe(44100);
    });
  });
});

describe('workspace types', () => {
  describe('WorkspaceRole', () => {
    it('accepts all valid roles', () => {
      expectTypeOf<'owner'>().toMatchTypeOf<WorkspaceRole>();
      expectTypeOf<'admin'>().toMatchTypeOf<WorkspaceRole>();
      expectTypeOf<'manager'>().toMatchTypeOf<WorkspaceRole>();
      expectTypeOf<'member'>().toMatchTypeOf<WorkspaceRole>();
      expectTypeOf<'viewer'>().toMatchTypeOf<WorkspaceRole>();
    });

    it('rejects invalid roles', () => {
      expectTypeOf<'guest'>().not.toMatchTypeOf<WorkspaceRole>();
      expectTypeOf<'superadmin'>().not.toMatchTypeOf<WorkspaceRole>();
    });

    it('covers exactly 5 role values at runtime', () => {
      const allRoles: WorkspaceRole[] = ['owner', 'admin', 'manager', 'member', 'viewer'];
      expect(allRoles).toHaveLength(5);
      expect(new Set(allRoles).size).toBe(5);
    });
  });

  describe('Workspace', () => {
    it('has the expected shape', () => {
      expectTypeOf<Workspace>().toHaveProperty('id');
      expectTypeOf<Workspace>().toHaveProperty('name');
      expectTypeOf<Workspace>().toHaveProperty('slug');
      expectTypeOf<Workspace>().toHaveProperty('avatarUrl');
      expectTypeOf<Workspace>().toHaveProperty('memberCount');
      expectTypeOf<Workspace>().toHaveProperty('role');
    });

    it('allows avatarUrl to be null', () => {
      const workspace: Workspace = {
        id: 'ws-1',
        name: 'My Band',
        slug: 'my-band',
        avatarUrl: null,
        memberCount: 4,
        role: 'owner',
      };
      expect(workspace.avatarUrl).toBeNull();
    });

    it('allows avatarUrl to be a string', () => {
      const workspace: Workspace = {
        id: 'ws-2',
        name: 'Studio',
        slug: 'studio',
        avatarUrl: 'https://example.com/avatar.png',
        memberCount: 2,
        role: 'member',
      };
      expect(workspace.avatarUrl).toBe('https://example.com/avatar.png');
    });
  });

  describe('WorkspaceMember', () => {
    it('has the expected shape', () => {
      expectTypeOf<WorkspaceMember>().toHaveProperty('userId');
      expectTypeOf<WorkspaceMember>().toHaveProperty('displayName');
      expectTypeOf<WorkspaceMember>().toHaveProperty('email');
      expectTypeOf<WorkspaceMember>().toHaveProperty('role');
      expectTypeOf<WorkspaceMember>().toHaveProperty('joinedAt');
    });

    it('accepts a conforming runtime object', () => {
      const member: WorkspaceMember = {
        userId: 'user-1',
        displayName: 'Alice',
        email: 'alice@example.com',
        role: 'admin',
        joinedAt: '2026-01-01T00:00:00Z',
      };
      expect(member.role).toBe('admin');
    });
  });
});

describe('performance types', () => {
  describe('HitResult', () => {
    it('accepts all valid hit results', () => {
      expectTypeOf<'perfect'>().toMatchTypeOf<HitResult>();
      expectTypeOf<'great'>().toMatchTypeOf<HitResult>();
      expectTypeOf<'good'>().toMatchTypeOf<HitResult>();
      expectTypeOf<'miss'>().toMatchTypeOf<HitResult>();
    });

    it('rejects invalid hit results', () => {
      expectTypeOf<'excellent'>().not.toMatchTypeOf<HitResult>();
      expectTypeOf<'bad'>().not.toMatchTypeOf<HitResult>();
    });

    it('covers exactly 4 result values at runtime', () => {
      const allResults: HitResult[] = ['perfect', 'great', 'good', 'miss'];
      expect(allResults).toHaveLength(4);
      expect(new Set(allResults).size).toBe(4);
    });
  });

  describe('PerformanceScore', () => {
    it('has the expected shape', () => {
      expectTypeOf<PerformanceScore>().toHaveProperty('timing');
      expectTypeOf<PerformanceScore>().toHaveProperty('dynamics');
      expectTypeOf<PerformanceScore>().toHaveProperty('pitch');
      expectTypeOf<PerformanceScore>().toHaveProperty('overall');
    });

    it('all score fields are numbers', () => {
      expectTypeOf<PerformanceScore['timing']>().toBeNumber();
      expectTypeOf<PerformanceScore['dynamics']>().toBeNumber();
      expectTypeOf<PerformanceScore['pitch']>().toBeNumber();
      expectTypeOf<PerformanceScore['overall']>().toBeNumber();
    });

    it('accepts a conforming runtime object', () => {
      const score: PerformanceScore = {
        timing: 95,
        dynamics: 88,
        pitch: 92,
        overall: 91,
      };
      expect(score.overall).toBe(91);
    });
  });

  describe('NoteHit', () => {
    it('has the expected shape', () => {
      expectTypeOf<NoteHit>().toHaveProperty('noteIndex');
      expectTypeOf<NoteHit>().toHaveProperty('result');
      expectTypeOf<NoteHit>().toHaveProperty('timingOffsetMs');
      expectTypeOf<NoteHit>().toHaveProperty('pitchOffsetCents');
      expectTypeOf<NoteHit>().toHaveProperty('velocityDelta');
    });

    it('accepts a conforming runtime object', () => {
      const hit: NoteHit = {
        noteIndex: 0,
        result: 'perfect',
        timingOffsetMs: 5.2,
        pitchOffsetCents: -3,
        velocityDelta: 10,
      };
      expect(hit.result).toBe('perfect');
      expect(hit.timingOffsetMs).toBeCloseTo(5.2);
    });
  });

  describe('Performance', () => {
    it('has the expected shape', () => {
      expectTypeOf<Performance>().toHaveProperty('id');
      expectTypeOf<Performance>().toHaveProperty('trackId');
      expectTypeOf<Performance>().toHaveProperty('userId');
      expectTypeOf<Performance>().toHaveProperty('stemId');
      expectTypeOf<Performance>().toHaveProperty('score');
      expectTypeOf<Performance>().toHaveProperty('midiData');
      expectTypeOf<Performance>().toHaveProperty('approved');
      expectTypeOf<Performance>().toHaveProperty('createdAt');
    });

    it('accepts a conforming runtime object', () => {
      const perf: Performance = {
        id: 'perf-1',
        trackId: 'track-1',
        userId: 'user-1',
        stemId: 'stem-1',
        score: { timing: 90, dynamics: 85, pitch: 88, overall: 87 },
        midiData: [{ pitch: 60, velocity: 100, startTime: 0, duration: 0.5, channel: 0 }],
        approved: false,
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(perf.approved).toBe(false);
      expect(perf.midiData).toHaveLength(1);
    });
  });
});

describe('calibration types', () => {
  describe('CalibrationStep', () => {
    it('accepts all valid calibration steps', () => {
      expectTypeOf<'audio_output'>().toMatchTypeOf<CalibrationStep>();
      expectTypeOf<'audio_input'>().toMatchTypeOf<CalibrationStep>();
      expectTypeOf<'display'>().toMatchTypeOf<CalibrationStep>();
      expectTypeOf<'complete'>().toMatchTypeOf<CalibrationStep>();
    });

    it('rejects invalid calibration steps', () => {
      expectTypeOf<'midi'>().not.toMatchTypeOf<CalibrationStep>();
      expectTypeOf<'network'>().not.toMatchTypeOf<CalibrationStep>();
    });

    it('covers exactly 4 step values at runtime', () => {
      const allSteps: CalibrationStep[] = ['audio_output', 'audio_input', 'display', 'complete'];
      expect(allSteps).toHaveLength(4);
      expect(new Set(allSteps).size).toBe(4);
    });
  });

  describe('CalibrationProfile', () => {
    it('has the expected shape', () => {
      expectTypeOf<CalibrationProfile>().toHaveProperty('id');
      expectTypeOf<CalibrationProfile>().toHaveProperty('userId');
      expectTypeOf<CalibrationProfile>().toHaveProperty('deviceName');
      expectTypeOf<CalibrationProfile>().toHaveProperty('inputLatencyMs');
      expectTypeOf<CalibrationProfile>().toHaveProperty('outputLatencyMs');
      expectTypeOf<CalibrationProfile>().toHaveProperty('displayLatencyMs');
      expectTypeOf<CalibrationProfile>().toHaveProperty('bufferSize');
      expectTypeOf<CalibrationProfile>().toHaveProperty('sampleRate');
      expectTypeOf<CalibrationProfile>().toHaveProperty('isActive');
      expectTypeOf<CalibrationProfile>().toHaveProperty('createdAt');
    });

    it('accepts a conforming runtime object', () => {
      const profile: CalibrationProfile = {
        id: 'cal-1',
        userId: 'user-1',
        deviceName: 'Scarlett 2i2',
        inputLatencyMs: 5.8,
        outputLatencyMs: 6.2,
        displayLatencyMs: 16.7,
        bufferSize: 256,
        sampleRate: 48000,
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(profile.deviceName).toBe('Scarlett 2i2');
      expect(profile.isActive).toBe(true);
      expect(profile.bufferSize).toBe(256);
    });
  });

  describe('CalibrationState', () => {
    it('has the expected shape', () => {
      expectTypeOf<CalibrationState>().toHaveProperty('currentStep');
      expectTypeOf<CalibrationState>().toHaveProperty('measurements');
      expectTypeOf<CalibrationState>().toHaveProperty('deviceName');
    });

    it('accepts a conforming runtime object', () => {
      const state: CalibrationState = {
        currentStep: 'audio_output',
        measurements: [5.1, 5.3, 5.0, 5.2],
        deviceName: 'Built-in Audio',
      };
      expect(state.currentStep).toBe('audio_output');
      expect(state.measurements).toHaveLength(4);
    });
  });
});

describe('game types', () => {
  describe('NoteEvent', () => {
    it('has the expected shape', () => {
      expectTypeOf<NoteEvent>().toHaveProperty('startTime');
      expectTypeOf<NoteEvent>().toHaveProperty('duration');
      expectTypeOf<NoteEvent>().toHaveProperty('pitch');
      expectTypeOf<NoteEvent>().toHaveProperty('velocity');
    });

    it('all fields are numbers', () => {
      expectTypeOf<NoteEvent['startTime']>().toBeNumber();
      expectTypeOf<NoteEvent['duration']>().toBeNumber();
      expectTypeOf<NoteEvent['pitch']>().toBeNumber();
      expectTypeOf<NoteEvent['velocity']>().toBeNumber();
    });

    it('accepts a conforming runtime object', () => {
      const note: NoteEvent = {
        startTime: 1.5,
        duration: 0.25,
        pitch: 40,
        velocity: 80,
      };
      expect(note.startTime).toBe(1.5);
      expect(note.pitch).toBe(40);
    });

    it('accepts bass guitar range MIDI notes', () => {
      const lowE: NoteEvent = { startTime: 0, duration: 1, pitch: 28, velocity: 100 };
      const highG: NoteEvent = { startTime: 1, duration: 1, pitch: 67, velocity: 90 };
      expect(lowE.pitch).toBe(28);
      expect(highG.pitch).toBe(67);
    });
  });

  describe('HitJudgment', () => {
    it('is an alias for HitResult', () => {
      expectTypeOf<HitJudgment>().toEqualTypeOf<HitResult>();
    });

    it('accepts all valid judgments', () => {
      expectTypeOf<'perfect'>().toMatchTypeOf<HitJudgment>();
      expectTypeOf<'great'>().toMatchTypeOf<HitJudgment>();
      expectTypeOf<'good'>().toMatchTypeOf<HitJudgment>();
      expectTypeOf<'miss'>().toMatchTypeOf<HitJudgment>();
    });
  });

  describe('PerformanceResult', () => {
    it('has the expected shape', () => {
      expectTypeOf<PerformanceResult>().toHaveProperty('totalScore');
      expectTypeOf<PerformanceResult>().toHaveProperty('maxCombo');
      expectTypeOf<PerformanceResult>().toHaveProperty('perfectCount');
      expectTypeOf<PerformanceResult>().toHaveProperty('greatCount');
      expectTypeOf<PerformanceResult>().toHaveProperty('goodCount');
      expectTypeOf<PerformanceResult>().toHaveProperty('missCount');
      expectTypeOf<PerformanceResult>().toHaveProperty('accuracy');
    });

    it('all fields are numbers', () => {
      expectTypeOf<PerformanceResult['totalScore']>().toBeNumber();
      expectTypeOf<PerformanceResult['maxCombo']>().toBeNumber();
      expectTypeOf<PerformanceResult['perfectCount']>().toBeNumber();
      expectTypeOf<PerformanceResult['greatCount']>().toBeNumber();
      expectTypeOf<PerformanceResult['goodCount']>().toBeNumber();
      expectTypeOf<PerformanceResult['missCount']>().toBeNumber();
      expectTypeOf<PerformanceResult['accuracy']>().toBeNumber();
    });

    it('accepts a conforming runtime object', () => {
      const result: PerformanceResult = {
        totalScore: 12500,
        maxCombo: 42,
        perfectCount: 30,
        greatCount: 15,
        goodCount: 5,
        missCount: 2,
        accuracy: 87.5,
      };
      expect(result.totalScore).toBe(12500);
      expect(result.maxCombo).toBe(42);
      expect(result.accuracy).toBe(87.5);
    });

    it('accepts a perfect score result', () => {
      const perfect: PerformanceResult = {
        totalScore: 50000,
        maxCombo: 100,
        perfectCount: 100,
        greatCount: 0,
        goodCount: 0,
        missCount: 0,
        accuracy: 100,
      };
      expect(perfect.missCount).toBe(0);
      expect(perfect.accuracy).toBe(100);
    });
  });
});

describe('barrel re-exports from types/index', () => {
  it('all type modules are accessible from the barrel', () => {
    // This test verifies at compile time that all types are re-exported.
    // If any export were missing from types/index.ts, TypeScript would
    // produce a compile error on the import block at the top of this file.
    //
    // We create one object per module to prove runtime accessibility of the
    // structural shapes.

    const audioDevice: AudioDeviceInfo = {
      id: 'a', name: 'A', kind: 'input', sampleRates: [44100], channelCount: 1,
    };
    const midiNote: MidiNote = {
      pitch: 60, velocity: 100, startTime: 0, duration: 1, channel: 0,
    };
    const project: Project = {
      id: 'p', workspaceId: 'w', name: 'P', tempoBpm: 120,
      timeSignature: '4/4', createdBy: 'u', createdAt: '',
    };
    const workspace: Workspace = {
      id: 'w', name: 'W', slug: 'w', avatarUrl: null, memberCount: 1, role: 'owner',
    };
    const score: PerformanceScore = {
      timing: 0, dynamics: 0, pitch: 0, overall: 0,
    };
    const calibrationState: CalibrationState = {
      currentStep: 'complete', measurements: [], deviceName: 'test',
    };

    // Runtime assertions to confirm objects are well-formed
    expect(audioDevice.id).toBeDefined();
    expect(midiNote.pitch).toBeDefined();
    expect(project.id).toBeDefined();
    expect(workspace.id).toBeDefined();
    expect(score.overall).toBeDefined();
    expect(calibrationState.currentStep).toBe('complete');
  });
});
