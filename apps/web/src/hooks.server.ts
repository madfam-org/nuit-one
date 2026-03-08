import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const PUBLIC_PATHS = ['/auth/login', '/auth/callback', '/'];

const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return response;
};

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002';

const auth: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Skip auth for public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return resolve(event);
  }

  // Dev bypass: auto-set session cookie in non-production
  if (process.env.NODE_ENV !== 'production') {
    let sessionToken = event.cookies.get('nuit_session');
    if (!sessionToken) {
      sessionToken = 'dev-session-token';
      event.cookies.set('nuit_session', sessionToken, { path: '/', httpOnly: true, sameSite: 'lax' });
    }
    event.locals.accessToken = sessionToken;
    event.locals.userId = DEV_USER_ID;
    event.locals.workspaceId = DEV_WORKSPACE_ID;
    return resolve(event);
  }

  // Production: check for session cookie
  const sessionToken = event.cookies.get('nuit_session');
  if (!sessionToken) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/auth/login' },
    });
  }

  // TODO: validate JWT against Janua's JWKS endpoint
  event.locals.accessToken = sessionToken;
  event.locals.userId = DEV_USER_ID;
  event.locals.workspaceId = DEV_WORKSPACE_ID;

  return resolve(event);
};

export const handle = sequence(securityHeaders, auth);
