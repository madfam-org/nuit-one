import { createMiddleware } from 'hono/factory';
import * as jose from 'jose';

interface AuthContext {
  userId: string;
  workspaceId?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

const JANUA_URL = process.env.JANUA_URL ?? 'http://localhost:8000';
let jwks: jose.JSONWebKeySet | null = null;

async function getJWKS(): Promise<jose.JSONWebKeySet> {
  if (!jwks) {
    const response = await fetch(`${JANUA_URL}/.well-known/jwks.json`);
    jwks = await response.json() as jose.JSONWebKeySet;
  }
  return jwks;
}

export const jwtAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization token' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const keySet = await getJWKS();
    const JWKS = jose.createLocalJWKSet(keySet);
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: JANUA_URL,
    });

    c.set('auth', {
      userId: payload.sub as string,
      workspaceId: payload.org_id as string | undefined,
    });

    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});
