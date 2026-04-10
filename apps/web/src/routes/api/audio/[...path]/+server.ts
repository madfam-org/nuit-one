import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDownloadUrl, isLocalStorage, readLocalFile } from '$lib/server/storage.js';
import type { RequestHandler } from './$types';

/**
 * COEP-safe audio proxy.
 * In local mode: reads file directly from filesystem.
 * In R2 mode: fetches audio using a signed URL on the server side,
 * then streams it to the client with same-origin CORP headers.
 * Demo files are served directly from the static directory.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const r2Key = params.path;
  if (!r2Key) throw error(400, 'Missing path');

  // Block path traversal and null bytes for all paths
  if (r2Key.includes('..') || r2Key.includes('\0')) {
    throw error(403, 'Invalid path');
  }

  // Serve demo audio files from static directory
  if (r2Key.startsWith('demo/')) {
    const staticDir = resolve('static');
    const staticPath = resolve('static', r2Key);
    // Validate path doesn't escape static dir
    if (!staticPath.startsWith(staticDir)) {
      throw error(403, 'Forbidden');
    }
    try {
      const data = await readFile(staticPath);
      return new Response(data, {
        headers: {
          'Content-Type': 'audio/wav',
          'Cross-Origin-Resource-Policy': 'same-origin',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    } catch {
      throw error(404, 'Demo audio not found');
    }
  }

  // Only allow audio file paths — block traversal
  if (!r2Key.startsWith('tracks/')) {
    throw error(403, 'Forbidden path');
  }

  if (isLocalStorage()) {
    try {
      const data = await readLocalFile(r2Key);
      return new Response(data as Uint8Array<ArrayBuffer>, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': String(data.byteLength),
          'Cross-Origin-Resource-Policy': 'same-origin',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch {
      throw error(404, 'Audio file not found');
    }
  }

  const signedUrl = await getDownloadUrl(r2Key);
  const upstream = await fetch(signedUrl);

  if (!upstream.ok) {
    throw error(upstream.status, 'Failed to fetch audio from storage');
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'audio/wav',
      'Content-Length': upstream.headers.get('Content-Length') ?? '',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
