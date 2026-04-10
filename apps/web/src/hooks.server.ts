import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { refreshAccessToken, verifyToken } from '$lib/server/auth.js';

const PUBLIC_PATH_PREFIXES = ['/auth/login', '/auth/callback', '/auth/logout'];

const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return response;
};

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002';

function clearAuthCookies(cookies: Parameters<Handle>[0]['event']['cookies']): void {
  cookies.delete('nuit_session', { path: '/' });
  cookies.delete('nuit_refresh', { path: '/' });
}

const auth: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Skip auth for public paths (landing page and auth routes)
  if (pathname === '/' || PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
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
    // Attempt refresh if refresh token exists
    const refreshToken = event.cookies.get('nuit_refresh');
    if (refreshToken) {
      try {
        const tokens = await refreshAccessToken(refreshToken);
        event.cookies.set('nuit_session', tokens.access_token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: tokens.expires_in,
        });
        if (tokens.refresh_token) {
          event.cookies.set('nuit_refresh', tokens.refresh_token, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
          });
        }
        const verified = await verifyToken(tokens.access_token);
        event.locals.accessToken = tokens.access_token;
        event.locals.userId = verified.userId;
        event.locals.workspaceId = verified.workspaceId;
        event.locals.roles = verified.roles;
        return resolve(event);
      } catch {
        clearAuthCookies(event.cookies);
      }
    }
    return new Response(null, {
      status: 302,
      headers: { Location: '/auth/login' },
    });
  }

  // Validate JWT against Janua's JWKS endpoint
  try {
    const verified = await verifyToken(sessionToken);
    event.locals.accessToken = sessionToken;
    event.locals.userId = verified.userId;
    event.locals.workspaceId = verified.workspaceId;
    event.locals.roles = verified.roles;
    return resolve(event);
  } catch (_err) {
    // On token expiry, attempt refresh
    const refreshToken = event.cookies.get('nuit_refresh');
    if (refreshToken) {
      try {
        const tokens = await refreshAccessToken(refreshToken);
        event.cookies.set('nuit_session', tokens.access_token, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: tokens.expires_in,
        });
        if (tokens.refresh_token) {
          event.cookies.set('nuit_refresh', tokens.refresh_token, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
          });
        }
        const verified = await verifyToken(tokens.access_token);
        event.locals.accessToken = tokens.access_token;
        event.locals.userId = verified.userId;
        event.locals.workspaceId = verified.workspaceId;
        event.locals.roles = verified.roles;
        return resolve(event);
      } catch {
        // Refresh also failed
      }
    }

    // Token invalid and refresh failed — clear and redirect
    clearAuthCookies(event.cookies);
    return new Response(null, {
      status: 302,
      headers: { Location: '/auth/login' },
    });
  }
};

export const handle = sequence(securityHeaders, auth);

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
  const id = crypto.randomUUID();
  console.error(`[${id}] ${event.request.method} ${event.url.pathname}:`, error);

  return {
    message: status === 404 ? 'Page not found' : 'An internal error occurred',
    id,
  };
};
