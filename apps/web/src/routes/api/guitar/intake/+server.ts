import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const API_URL = env.API_URL ?? 'http://localhost:3001';

/** Start guitar intake (string, fret, fingering, techniques) for a track; returns { jobId }. */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const { trackId } = (await request.json()) as { trackId?: string };
  if (!trackId) throw error(400, 'Missing trackId');

  const res = await fetch(`${API_URL}/api/guitar/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${locals.accessToken}`,
    },
    body: JSON.stringify({ trackId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Guitar intake failed' }));
    throw error(res.status, data.error ?? 'Guitar intake failed');
  }

  return json(await res.json());
};
