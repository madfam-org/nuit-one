/**
 * ONNX model loader foundation.
 * Downloads models from R2, caches in IndexedDB, provides progress tracking.
 * Actual ONNX inference deferred to Phase 2 stretch / Phase 3.
 */

const DB_NAME = 'nuit-ai-models';
const STORE_NAME = 'models';
const DB_VERSION = 1;

interface CachedModel {
  key: string;
  data: ArrayBuffer;
  version: string;
  cachedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function getCachedModel(key: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result as CachedModel | undefined;
      resolve(result?.data ?? null);
    };
  });
}

export async function cacheModel(
  key: string,
  data: ArrayBuffer,
  version: string,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry: CachedModel = { key, data, version, cachedAt: Date.now() };
    const request = store.put(entry);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadModel(
  url: string,
  key: string,
  version: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  // Check cache first
  const cached = await getCachedModel(key);
  if (cached) return cached;

  // Download with progress
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download model: ${response.status}`);

  const total = parseInt(response.headers.get('content-length') ?? '0', 10);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }

  // Combine chunks
  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Cache
  await cacheModel(key, data.buffer, version);

  return data.buffer;
}

export async function clearModelCache(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
