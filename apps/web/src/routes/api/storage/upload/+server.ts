import { error } from '@sveltejs/kit';
import { writeLocalFile } from '$lib/server/storage.js';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, url, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const key = url.searchParams.get('key');
  if (!key) throw error(400, 'Missing key parameter');

  // Only allow track file paths
  if (!key.startsWith('tracks/')) {
    throw error(403, 'Forbidden path');
  }

  const body = await request.arrayBuffer();
  await writeLocalFile(key, new Uint8Array(body));

  return new Response(null, { status: 200 });
};
