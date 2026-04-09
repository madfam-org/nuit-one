import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCodeForTokens } from '$lib/server/auth.js';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // OAuth error from provider
  if (error) {
    return redirect(302, '/auth/login?error=access_denied');
  }

  // Missing required params
  if (!code || !state) {
    return redirect(302, '/auth/login?error=invalid_callback');
  }

  // Retrieve and validate CSRF state
  const oauthStateCookie = cookies.get('nuit_oauth_state');
  if (!oauthStateCookie) {
    return redirect(302, '/auth/login?error=state_expired');
  }

  let savedState: string;
  let codeVerifier: string;
  try {
    const parsed = JSON.parse(oauthStateCookie) as { state: string; codeVerifier: string };
    savedState = parsed.state;
    codeVerifier = parsed.codeVerifier;
  } catch {
    return redirect(302, '/auth/login?error=state_expired');
  }

  // Delete state cookie immediately to prevent replay
  cookies.delete('nuit_oauth_state', { path: '/' });

  // CSRF check
  if (state !== savedState) {
    return redirect(302, '/auth/login?error=state_mismatch');
  }

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, codeVerifier);
  } catch {
    return redirect(302, '/auth/login?error=token_exchange_failed');
  }

  // Store access token as session cookie
  cookies.set('nuit_session', tokens.access_token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: tokens.expires_in,
  });

  // Store refresh token if provided
  if (tokens.refresh_token) {
    cookies.set('nuit_refresh', tokens.refresh_token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return redirect(302, '/dashboard');
};
