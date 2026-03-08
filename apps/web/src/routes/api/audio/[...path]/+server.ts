import { error } from '@sveltejs/kit';
import { getDownloadUrl } from '$lib/server/r2.js';
import type { RequestHandler } from './$types';

/**
 * COEP-safe audio proxy.
 * Fetches audio from R2 using a signed URL on the server side,
 * then streams it to the client with same-origin CORP headers.
 * This avoids COEP blocking cross-origin R2 URLs.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const r2Key = params.path;
  if (!r2Key) throw error(400, 'Missing path');

  // Only allow audio file paths
  if (!r2Key.startsWith('tracks/')) {
    throw error(403, 'Forbidden path');
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
