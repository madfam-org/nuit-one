import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { generateRandomState, generateCodeVerifier, generateAuthUrl } from '$lib/server/auth.js';

export const load: PageServerLoad = async ({ cookies }) => {
  // In dev mode, let the page render with the dev bypass button
  if (process.env.NODE_ENV !== 'production') {
    return { devMode: true };
  }

  // Production: generate OAuth state and PKCE, redirect to Janua
  const state = generateRandomState();
  const codeVerifier = generateCodeVerifier();

  // Store state + verifier in a short-lived httpOnly cookie
  cookies.set('nuit_oauth_state', JSON.stringify({ state, codeVerifier }), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  const authorizeUrl = await generateAuthUrl(state, codeVerifier);
  return redirect(302, authorizeUrl);
};
