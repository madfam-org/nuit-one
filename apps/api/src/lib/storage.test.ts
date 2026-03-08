import { describe, it, expect, vi } from 'vitest';

describe('storage module (local mode)', () => {
  it('exports downloadFile, uploadFile, and getFileDownloadUrl', async () => {
    vi.stubEnv('STORAGE_MODE', 'local');
    const storage = await import('./storage.js');
    expect(typeof storage.downloadFile).toBe('function');
    expect(typeof storage.uploadFile).toBe('function');
    expect(typeof storage.getFileDownloadUrl).toBe('function');
    vi.unstubAllEnvs();
  });

  it('getFileDownloadUrl returns local:// prefix when STORAGE_MODE=local', async () => {
    vi.stubEnv('STORAGE_MODE', 'local');
    // Re-import to pick up the stubbed env
    const { getFileDownloadUrl } = await import('./storage.js');

    // The module reads STORAGE_MODE at load time, so if it loaded as 'local',
    // this should return local:// prefix. If the module was already cached with
    // a different mode, we still verify the function exists.
    const url = await getFileDownloadUrl('tracks/abc/original/song.wav');
    expect(url).toBe('local://tracks/abc/original/song.wav');
    vi.unstubAllEnvs();
  });
});
