import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getPusher } from '$lib/server/pusher.js';
import type { RequestHandler } from './$types';

const API_URL = env.API_URL ?? 'http://localhost:3001';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const body = await request.json();
  if (!body.trackId) throw error(400, 'Missing trackId');

  const res = await fetch(`${API_URL}/api/performances`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${locals.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to save performance' }));
    throw error(res.status, data.error ?? 'Failed to save performance');
  }

  const result = await res.json();

  // Broadcast performance completion via Soketi (non-fatal)
  try {
    const pusher = getPusher();
    if (locals.workspaceId) {
      await pusher.trigger(`private-workspace-${locals.workspaceId}`, 'performance:completed', {
        userId: locals.userId,
        trackId: body.trackId,
        totalScore: body.totalScore,
        accuracy: body.accuracy,
      });
    }
  } catch {
    // Non-fatal: don't fail the request if Soketi is unavailable
  }

  return json(result);
};

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const trackId = url.searchParams.get('trackId');
  if (!trackId) throw error(400, 'Missing trackId');

  const res = await fetch(`${API_URL}/api/performances/${trackId}`, {
    headers: {
      Authorization: `Bearer ${locals.accessToken}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to load performances' }));
    throw error(res.status, data.error ?? 'Failed to load performances');
  }

  return json(await res.json());
};
