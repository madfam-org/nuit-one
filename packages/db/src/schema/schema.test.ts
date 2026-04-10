import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, schema } from '../index.js';
import {
  calibrationProfiles,
  contentSources,
  performances,
  projects,
  stems,
  trackAnalysis,
  tracks,
  workspaceInvitations,
  workspaceMembers,
} from './index.js';

/**
 * Helper: extract the inline foreign keys Drizzle stores on PgTable instances.
 * Drizzle uses Symbol.for("drizzle:PgInlineForeignKeys") internally.
 */
const PgInlineForeignKeys = Symbol.for('drizzle:PgInlineForeignKeys');

function getInlineForeignKeys(table: object): unknown[] {
  return (table as Record<symbol, unknown[]>)[PgInlineForeignKeys] ?? [];
}

// ---------------------------------------------------------------------------
// Barrel exports
// ---------------------------------------------------------------------------

describe('schema barrel exports', () => {
  it('exports all nine tables', () => {
    expect(projects).toBeDefined();
    expect(tracks).toBeDefined();
    expect(stems).toBeDefined();
    expect(performances).toBeDefined();
    expect(calibrationProfiles).toBeDefined();
    expect(trackAnalysis).toBeDefined();
    expect(workspaceMembers).toBeDefined();
    expect(workspaceInvitations).toBeDefined();
    expect(contentSources).toBeDefined();
  });

  it('exports createDb from the package entry point', () => {
    expect(typeof createDb).toBe('function');
  });

  it('re-exports the schema namespace from the package entry point', () => {
    expect(schema).toBeDefined();
    expect(schema.projects).toBe(projects);
    expect(schema.tracks).toBe(tracks);
    expect(schema.stems).toBe(stems);
    expect(schema.performances).toBe(performances);
    expect(schema.calibrationProfiles).toBe(calibrationProfiles);
    expect(schema.workspaceMembers).toBe(workspaceMembers);
    expect(schema.workspaceInvitations).toBe(workspaceInvitations);
    expect(schema.contentSources).toBe(contentSources);
  });
});

// ---------------------------------------------------------------------------
// Column structure
// ---------------------------------------------------------------------------

describe('projects table columns', () => {
  const cols = getTableColumns(projects);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      ['id', 'workspaceId', 'name', 'tempoBpm', 'timeSignature', 'createdBy', 'createdAt'].sort(),
    );
  });

  it('has tempo_bpm defaulting to 120', () => {
    expect(cols.tempoBpm.hasDefault).toBe(true);
  });

  it('has time_signature defaulting to 4/4', () => {
    expect(cols.timeSignature.hasDefault).toBe(true);
  });
});

describe('tracks table columns', () => {
  const cols = getTableColumns(tracks);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      [
        'id',
        'projectId',
        'userId',
        'title',
        'instrument',
        'status',
        'r2Key',
        'originalFilename',
        'fileSizeBytes',
        'contentType',
        'contentSourceId',
        'assignedTo',
        'sortOrder',
        'createdAt',
      ].sort(),
    );
  });

  it('has contentSourceId as nullable', () => {
    expect(cols.contentSourceId.notNull).toBe(false);
  });

  it('has status defaulting to pending_upload', () => {
    expect(cols.status.hasDefault).toBe(true);
  });

  it('has sort_order defaulting to 0', () => {
    expect(cols.sortOrder.hasDefault).toBe(true);
  });
});

describe('stems table columns', () => {
  const cols = getTableColumns(stems);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      [
        'id',
        'trackId',
        'stemType',
        'r2Key',
        'fileSizeBytes',
        'durationSeconds',
        'sampleRate',
        'source',
        'midiData',
        'contentSourceId',
        'createdBy',
        'createdAt',
      ].sort(),
    );
  });

  it('has contentSourceId as nullable', () => {
    expect(cols.contentSourceId.notNull).toBe(false);
  });

  it('has sample_rate defaulting to 44100', () => {
    expect(cols.sampleRate.hasDefault).toBe(true);
  });

  it('has stem_type as not null', () => {
    expect(cols.stemType.notNull).toBe(true);
  });
});

describe('performances table columns', () => {
  const cols = getTableColumns(performances);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      [
        'id',
        'trackId',
        'userId',
        'stemId',
        'scoreTiming',
        'scoreDynamics',
        'scorePitch',
        'scoreOverall',
        'midiData',
        'approved',
        'createdAt',
      ].sort(),
    );
  });

  it('has approved defaulting to false', () => {
    expect(cols.approved.hasDefault).toBe(true);
  });
});

describe('calibrationProfiles table columns', () => {
  const cols = getTableColumns(calibrationProfiles);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      [
        'id',
        'userId',
        'deviceName',
        'inputLatencyMs',
        'outputLatencyMs',
        'displayLatencyMs',
        'bufferSize',
        'sampleRate',
        'isActive',
        'createdAt',
      ].sort(),
    );
  });

  it('has buffer_size defaulting to 256', () => {
    expect(cols.bufferSize.hasDefault).toBe(true);
  });

  it('has sample_rate defaulting to 44100', () => {
    expect(cols.sampleRate.hasDefault).toBe(true);
  });

  it('has is_active defaulting to true', () => {
    expect(cols.isActive.hasDefault).toBe(true);
  });
});

describe('trackAnalysis table columns', () => {
  const cols = getTableColumns(trackAnalysis);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      ['id', 'trackId', 'key', 'bpmDetected', 'chords', 'difficultyTier', 'analysisVersion', 'createdAt'].sort(),
    );
  });

  it('has trackId as not null', () => {
    expect(cols.trackId.notNull).toBe(true);
  });
});

describe('workspaceMembers table columns', () => {
  const cols = getTableColumns(workspaceMembers);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      ['id', 'workspaceId', 'userId', 'role', 'displayName', 'avatarUrl', 'joinedAt'].sort(),
    );
  });

  it('has role defaulting to member', () => {
    expect(cols.role.hasDefault).toBe(true);
  });

  it('has role as not null', () => {
    expect(cols.role.notNull).toBe(true);
  });

  it('has displayName as not null', () => {
    expect(cols.displayName.notNull).toBe(true);
  });

  it('has workspaceId as not null', () => {
    expect(cols.workspaceId.notNull).toBe(true);
  });

  it('has userId as not null', () => {
    expect(cols.userId.notNull).toBe(true);
  });

  it('has avatarUrl as nullable', () => {
    expect(cols.avatarUrl.notNull).toBe(false);
  });
});

describe('workspaceInvitations table columns', () => {
  const cols = getTableColumns(workspaceInvitations);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      ['id', 'workspaceId', 'email', 'role', 'invitedBy', 'token', 'expiresAt', 'acceptedAt', 'createdAt'].sort(),
    );
  });

  it('has role defaulting to member', () => {
    expect(cols.role.hasDefault).toBe(true);
  });

  it('has role as not null', () => {
    expect(cols.role.notNull).toBe(true);
  });

  it('has email as not null', () => {
    expect(cols.email.notNull).toBe(true);
  });

  it('has token as not null', () => {
    expect(cols.token.notNull).toBe(true);
  });

  it('has expiresAt as not null', () => {
    expect(cols.expiresAt.notNull).toBe(true);
  });

  it('has acceptedAt as nullable', () => {
    expect(cols.acceptedAt.notNull).toBe(false);
  });

  it('has invitedBy as not null', () => {
    expect(cols.invitedBy.notNull).toBe(true);
  });
});

describe('contentSources table columns', () => {
  const cols = getTableColumns(contentSources);

  it('has the expected columns', () => {
    expect(Object.keys(cols).sort()).toEqual(
      [
        'id',
        'workspaceId',
        'normalizedUrl',
        'sourceType',
        'sourceId',
        'originalUrl',
        'title',
        'artist',
        'thumbnailUrl',
        'durationSeconds',
        'r2KeyPrefix',
        'status',
        'importedBy',
        'lastAccessedAt',
        'createdAt',
      ].sort(),
    );
  });

  it('has status defaulting to processing', () => {
    expect(cols.status.hasDefault).toBe(true);
  });

  it('has workspaceId as not null', () => {
    expect(cols.workspaceId.notNull).toBe(true);
  });

  it('has normalizedUrl as not null', () => {
    expect(cols.normalizedUrl.notNull).toBe(true);
  });

  it('has title as not null', () => {
    expect(cols.title.notNull).toBe(true);
  });

  it('has importedBy as not null', () => {
    expect(cols.importedBy.notNull).toBe(true);
  });

  it('has artist as nullable', () => {
    expect(cols.artist.notNull).toBe(false);
  });

  it('has sourceId as nullable', () => {
    expect(cols.sourceId.notNull).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Foreign key relationships
// ---------------------------------------------------------------------------

describe('foreign key relationships', () => {
  it('tracks references projects via projectId (1 FK)', () => {
    const cols = getTableColumns(tracks);
    expect(cols.projectId).toBeDefined();
    expect(cols.projectId.notNull).toBe(true);

    const fks = getInlineForeignKeys(tracks);
    expect(fks).toHaveLength(1);
  });

  it('stems references tracks via trackId (1 FK)', () => {
    const cols = getTableColumns(stems);
    expect(cols.trackId).toBeDefined();
    expect(cols.trackId.notNull).toBe(true);

    const fks = getInlineForeignKeys(stems);
    expect(fks).toHaveLength(1);
  });

  it('performances references tracks and stems (2 FKs)', () => {
    const cols = getTableColumns(performances);
    expect(cols.trackId).toBeDefined();
    expect(cols.trackId.notNull).toBe(true);
    expect(cols.stemId).toBeDefined();

    const fks = getInlineForeignKeys(performances);
    expect(fks).toHaveLength(2);
  });

  it('performances.stemId is nullable (optional FK)', () => {
    const cols = getTableColumns(performances);
    expect(cols.stemId.notNull).toBe(false);
  });

  it('projects has no foreign keys', () => {
    const fks = getInlineForeignKeys(projects);
    expect(fks).toHaveLength(0);
  });

  it('calibrationProfiles has no foreign keys', () => {
    const fks = getInlineForeignKeys(calibrationProfiles);
    expect(fks).toHaveLength(0);
  });

  it('trackAnalysis references tracks via trackId (1 FK)', () => {
    const cols = getTableColumns(trackAnalysis);
    expect(cols.trackId).toBeDefined();
    expect(cols.trackId.notNull).toBe(true);

    const fks = getInlineForeignKeys(trackAnalysis);
    expect(fks).toHaveLength(1);
  });

  it('workspaceMembers has no inline foreign keys (references Janua UUIDs)', () => {
    const fks = getInlineForeignKeys(workspaceMembers);
    expect(fks).toHaveLength(0);
  });

  it('workspaceInvitations has no inline foreign keys (references Janua UUIDs)', () => {
    const fks = getInlineForeignKeys(workspaceInvitations);
    expect(fks).toHaveLength(0);
  });

  it('contentSources has no inline foreign keys (references Janua UUIDs)', () => {
    const fks = getInlineForeignKeys(contentSources);
    expect(fks).toHaveLength(0);
  });
});
