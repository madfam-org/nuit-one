import { describe, expect, it } from 'vitest';
import { ecosystemLink, isOwnHost } from './ecosystem-links.js';
import { ECOSYSTEM_PLATFORMS, MADFAM_OWNED_DOMAINS } from './ecosystem-platforms.js';

describe('ecosystem banner links (2026-10-11 fix)', () => {
  it('links Forgesight to forgesight.app, never the retired forgesight.quest', () => {
    const urls = ECOSYSTEM_PLATFORMS.map((p) => p.url);
    expect(urls).toContain('https://forgesight.app');
    expect(urls.some((u) => u.includes('forgesight.quest'))).toBe(false);
  });

  it('treats every default ticker destination as a MADFAM-owned host', () => {
    for (const p of ECOSYSTEM_PLATFORMS) {
      expect(isOwnHost(new URL(p.url).hostname, MADFAM_OWNED_DOMAINS)).toBe(true);
    }
  });

  it('tags an own-site link with rel=noopener and the ecosystem UTM set', () => {
    const link = ecosystemLink('https://forgesight.app', {
      surface: 'banner',
      originHost: 'www.karafiel.mx',
      ownedDomains: MADFAM_OWNED_DOMAINS,
    });
    expect(link.rel).toBe('noopener');
    const url = new URL(link.href);
    expect(url.hostname).toBe('forgesight.app');
    expect(url.searchParams.get('utm_source')).toBe('karafiel.mx');
    expect(url.searchParams.get('utm_medium')).toBe('ecosystem');
    expect(url.searchParams.get('utm_campaign')).toBe('banner');
  });

  it('tags every banner link with utm_source=nuit.one, although nuit.one itself is not an owned destination', () => {
    expect(isOwnHost('nuit.one', MADFAM_OWNED_DOMAINS)).toBe(false);
    for (const p of ECOSYSTEM_PLATFORMS) {
      const link = ecosystemLink(p.url, {
        surface: 'banner',
        originHost: 'nuit.one',
        ownedDomains: MADFAM_OWNED_DOMAINS,
      });
      expect(link.rel).toBe('noopener');
      const url = new URL(link.href);
      expect(url.searchParams.get('utm_source')).toBe('nuit.one');
      expect(url.searchParams.get('utm_medium')).toBe('ecosystem');
      expect(url.searchParams.get('utm_campaign')).toBe('banner');
    }
  });

  it('adds no UTM on the same host, from localhost or before mount', () => {
    for (const originHost of ['forgesight.app', 'localhost', '127.0.0.1', undefined]) {
      expect(
        ecosystemLink('https://forgesight.app', {
          surface: 'banner',
          originHost,
          ownedDomains: MADFAM_OWNED_DOMAINS,
        }),
      ).toEqual({ href: 'https://forgesight.app', rel: 'noopener' });
    }
  });

  it('keeps noreferrer and adds no UTM on a third-party link', () => {
    expect(
      ecosystemLink('https://github.com/madfam-org', {
        surface: 'banner',
        originHost: 'nuit.one',
        ownedDomains: MADFAM_OWNED_DOMAINS,
      }),
    ).toEqual({ href: 'https://github.com/madfam-org', rel: 'noopener noreferrer' });
  });
});
