import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const API_URL = env.API_URL ?? 'http://localhost:3001';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const { trackId } = (await request.json()) as { trackId: string };
  if (!trackId) throw error(400, 'Missing trackId');

  const res = await fetch(`${API_URL}/api/stems/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${locals.accessToken}`,
    },
    body: JSON.stringify({ trackId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Transcription failed' }));
    throw error(res.status, data.error ?? 'Transcription failed');
  }

  return json(await res.json());
};
