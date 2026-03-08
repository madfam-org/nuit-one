import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return redirect(302, '/auth/login');
  }

  // TODO: Exchange code for tokens with Janua
  // const tokens = await exchangeCode(code);
  // Set session cookie
  cookies.set('nuit_session', 'dev-session-token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  return redirect(302, '/dashboard');
};
