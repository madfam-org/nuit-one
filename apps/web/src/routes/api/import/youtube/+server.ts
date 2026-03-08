import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const API_URL = env.API_URL ?? 'http://localhost:3001';

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const { url } = (await request.json()) as { url: string };
  if (!url) throw error(400, 'Missing url');

  const res = await fetch(`${API_URL}/api/import/youtube`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${locals.accessToken}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Import failed' }));
    throw error(res.status, data.error ?? 'Import failed');
  }

  const data = await res.json();
  return json(data);
};
