import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { env } from '$env/dynamic/private';

const STORAGE_MODE = env.STORAGE_MODE ?? 'r2';
const LOCAL_STORAGE_PATH = resolve(env.LOCAL_STORAGE_PATH ?? './storage');

function localPath(key: string): string {
  return join(LOCAL_STORAGE_PATH, key);
}

export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  if (STORAGE_MODE === 'local') {
    return `/api/storage/upload?key=${encodeURIComponent(key)}`;
  } else {
    const { getUploadUrl: r2Upload } = await import('./r2.js');
    return r2Upload(key, contentType);
  }
}

export async function getDownloadUrl(key: string): Promise<string> {
  if (STORAGE_MODE === 'local') {
    return `local://${key}`;
  } else {
    const { getDownloadUrl: r2Download } = await import('./r2.js');
    return r2Download(key);
  }
}

export async function readLocalFile(key: string): Promise<Uint8Array> {
  const buf = await readFile(localPath(key));
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export async function writeLocalFile(key: string, data: Buffer | Uint8Array): Promise<void> {
  const dest = localPath(key);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, data);
}

export function isLocalStorage(): boolean {
  return STORAGE_MODE === 'local';
}
