import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const API_URL = env.API_URL ?? 'http://localhost:3001';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.accessToken) throw error(401, 'Unauthorized');

  const res = await fetch(`${API_URL}/api/stems/jobs/${params.jobId}`, {
    headers: {
      Authorization: `Bearer ${locals.accessToken}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Job not found' }));
    throw error(res.status, data.error ?? 'Job not found');
  }

  const data = await res.json();
  return json(data);
};
