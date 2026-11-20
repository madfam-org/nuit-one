import { error, redirect } from '@sveltejs/kit';
import { generateAuthUrl, generateCodeVerifier, generateRandomState, missingAuthConfig } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  // In dev mode, let the page render with the dev bypass button
  if (process.env.NODE_ENV !== 'production') {
    return { devMode: true };
  }

  // Without the Janua settings the redirect below throws and visitors get a
  // bare 500. Say plainly that sign-in is down, and log which settings are
  // missing (names only) so the operator sees the cause in the pod logs.
  const missing = missingAuthConfig();
  if (missing.length > 0) {
    console.error(`[auth] sign-in unavailable: ${missing.join(', ')} not set`);
    error(503, "Sign-in isn't available right now. Please try again later.");
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
