import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const STORAGE_MODE = process.env.STORAGE_MODE ?? 'r2';
const LOCAL_STORAGE_PATH = resolve(process.env.LOCAL_STORAGE_PATH ?? './storage');

function localPath(key: string): string {
  return join(LOCAL_STORAGE_PATH, key);
}

export async function downloadFile(key: string, destPath: string): Promise<void> {
  if (STORAGE_MODE === 'local') {
    await mkdir(dirname(destPath), { recursive: true });
    await copyFile(localPath(key), destPath);
  } else {
    const { downloadFromR2 } = await import('./r2.js');
    await downloadFromR2(key, destPath);
  }
}

export async function uploadFile(key: string, filePath: string, contentType: string): Promise<void> {
  if (STORAGE_MODE === 'local') {
    const dest = localPath(key);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(filePath, dest);
  } else {
    const { uploadToR2 } = await import('./r2.js');
    await uploadToR2(key, filePath, contentType);
  }
}

export async function getFileDownloadUrl(key: string): Promise<string> {
  if (STORAGE_MODE === 'local') {
    return `local://${key}`;
  } else {
    const { getDownloadUrl } = await import('./r2.js');
    return getDownloadUrl(key);
  }
}

export async function deleteObjects(prefix: string): Promise<void> {
  if (STORAGE_MODE === 'local') {
    const dir = localPath(prefix);
    // Remove the entire directory tree under the prefix
    await rm(dir, { recursive: true, force: true });
  } else {
    const { deleteR2Objects } = await import('./r2.js');
    await deleteR2Objects(prefix);
  }
}
