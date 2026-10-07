import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const API_URL = env.API_URL ?? 'http://localhost:3001';

/** The track's guitar performance document (null until transcribed) and engine availability. */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const res = await fetch(`${API_URL}/api/guitar/${encodeURIComponent(params.trackId)}`, {
    headers: { Authorization: `Bearer ${locals.accessToken}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Guitar performance unavailable' }));
    throw error(res.status, data.error ?? 'Guitar performance unavailable');
  }

  return json(await res.json());
};
