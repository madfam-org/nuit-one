import * as jose from 'jose';
import { env } from '$env/dynamic/private';

// --- Environment helpers ---

function januaUrl(): string {
  return env.JANUA_URL ?? 'http://localhost:8000';
}

function clientId(): string {
  const id = env.JANUA_CLIENT_ID;
  if (!id) throw new Error('JANUA_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const secret = env.JANUA_CLIENT_SECRET;
  if (!secret) throw new Error('JANUA_CLIENT_SECRET is not set');
  return secret;
}

function redirectUri(): string {
  return env.JANUA_REDIRECT_URI ?? 'http://localhost:5173/auth/callback';
}

// --- JWKS cache with TTL ---

let cachedJwks: jose.JSONWebKeySet | null = null;
let jwksFetchedAt = 0;
const JWKS_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getJWKS(): Promise<jose.JSONWebKeySet> {
  const now = Date.now();
  if (cachedJwks && now - jwksFetchedAt < JWKS_TTL_MS) {
    return cachedJwks;
  }

  const response = await fetch(`${januaUrl()}/.well-known/jwks.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }
  cachedJwks = (await response.json()) as jose.JSONWebKeySet;
  jwksFetchedAt = now;
  return cachedJwks;
}

// --- Token verification ---

export interface VerifiedToken {
  userId: string;
  workspaceId?: string;
  roles?: string[];
}

export async function verifyToken(token: string): Promise<VerifiedToken> {
  const keySet = await getJWKS();
  const JWKS = jose.createLocalJWKSet(keySet);
  const { payload } = await jose.jwtVerify(token, JWKS, {
    issuer: januaUrl(),
  });

  return {
    userId: payload.sub as string,
    workspaceId: payload.org_id as string | undefined,
    roles: payload.roles as string[] | undefined,
  };
}

// --- PKCE helpers ---

export function generateRandomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- OAuth URL construction ---

export async function generateAuthUrl(state: string, codeVerifier: string): Promise<string> {
  const codeChallenge = await computeCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    redirect_uri: redirectUri(),
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${januaUrl()}/oauth/authorize?${params.toString()}`;
}

// --- Token exchange ---

interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenResponse> {
  const response = await fetch(`${januaUrl()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: clientId(),
      client_secret: clientSecret(),
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return (await response.json()) as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const response = await fetch(`${januaUrl()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return (await response.json()) as TokenResponse;
}

// --- UserInfo endpoint ---

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(`${januaUrl()}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`UserInfo request failed: ${response.status}`);
  }

  return (await response.json()) as UserInfo;
}
