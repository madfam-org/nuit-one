import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const PUBLIC_PATHS = ['/auth/login', '/auth/callback', '/'];

const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return response;
};

const auth: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Skip auth for public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return resolve(event);
  }

  // TODO Phase 0: Integrate Janua JWT validation
  // For now, check for session cookie
  const sessionToken = event.cookies.get('nuit_session');
  if (!sessionToken) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/auth/login' },
    });
  }

  // Placeholder: extract user info from session
  // In production, validate JWT against Janua's JWKS endpoint
  event.locals.accessToken = sessionToken;
  event.locals.userId = 'dev-user';
  event.locals.workspaceId = 'dev-workspace';

  return resolve(event);
};

export const handle = sequence(securityHeaders, auth);
