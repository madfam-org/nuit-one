import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { load } = await import('./+page.server.js');

const FULL_CONFIG = {
  JANUA_URL: 'https://auth.example.test',
  JANUA_CLIENT_ID: 'nuit-one',
  JANUA_CLIENT_SECRET: 'placeholder',
  JANUA_REDIRECT_URI: 'https://nuit.example.test/auth/callback',
};

function event() {
  return { cookies: { set: vi.fn() } } as unknown as Parameters<typeof load>[0];
}

describe('/auth/login load (production)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('answers 503 with a plain message, not a 500, when the Janua client id is missing', async () => {
    Object.assign(mockEnv, FULL_CONFIG, { JANUA_CLIENT_ID: undefined });
    await expect(load(event())).rejects.toMatchObject({
      status: 503,
      body: { message: "Sign-in isn't available right now. Please try again later." },
    });
    expect(console.error).toHaveBeenCalledWith('[auth] sign-in unavailable: JANUA_CLIENT_ID not set');
  });

  it('names every missing setting and never logs values', async () => {
    Object.assign(mockEnv, { JANUA_CLIENT_SECRET: 'placeholder' });
    await expect(load(event())).rejects.toMatchObject({ status: 503 });
    const logged = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(logged).toBe('[auth] sign-in unavailable: JANUA_URL, JANUA_CLIENT_ID, JANUA_REDIRECT_URI not set');
    expect(logged).not.toContain('placeholder');
  });

  it('redirects to Janua with PKCE when configured', async () => {
    Object.assign(mockEnv, FULL_CONFIG);
    const ev = event();
    const thrown = (await Promise.resolve(load(ev)).catch((e: unknown) => e)) as { status: number; location: string };
    expect(thrown.status).toBe(302);
    const location = new URL(thrown.location);
    expect(location.origin + location.pathname).toBe('https://auth.example.test/oauth/authorize');
    expect(location.searchParams.get('client_id')).toBe('nuit-one');
    expect(location.searchParams.get('redirect_uri')).toBe(FULL_CONFIG.JANUA_REDIRECT_URI);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(ev.cookies.set).toHaveBeenCalledWith('nuit_oauth_state', expect.any(String), expect.any(Object));
  });
});
