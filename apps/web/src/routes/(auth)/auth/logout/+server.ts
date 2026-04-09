import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete('nuit_session', { path: '/' });
  cookies.delete('nuit_refresh', { path: '/' });

  return redirect(302, '/');
};
