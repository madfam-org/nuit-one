export interface NormalizedUrl {
  normalizedUrl: string;
  sourceType: string;
  sourceId: string | null;
}

/** Normalize a URL for deduplication */
export function normalizeUrl(rawUrl: string): NormalizedUrl {
  const url = new URL(rawUrl);

  // Lowercase hostname
  url.hostname = url.hostname.toLowerCase();

  // Strip common tracking params
  const trackingParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'ref',
    'fbclid',
    'gclid',
  ];
  for (const param of trackingParams) {
    url.searchParams.delete(param);
  }

  // YouTube normalization
  if (
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('youtu.be') ||
    url.hostname.includes('music.youtube.com')
  ) {
    return normalizeYouTube(url, rawUrl);
  }

  // SoundCloud normalization
  if (url.hostname.includes('soundcloud.com')) {
    return normalizeSoundCloud(url);
  }

  // Generic: strip trailing slash, sort params
  url.searchParams.sort();
  const normalized = url.toString().replace(/\/+$/, '');
  return {
    normalizedUrl: normalized,
    sourceType: url.hostname.replace('www.', ''),
    sourceId: null,
  };
}

function normalizeYouTube(url: URL, rawUrl: string): NormalizedUrl {
  let videoId: string | null = null;

  if (url.hostname.includes('youtu.be')) {
    videoId = url.pathname.slice(1).split('/')[0] ?? null;
  } else {
    videoId = url.searchParams.get('v');
  }

  if (!videoId) {
    return { normalizedUrl: rawUrl, sourceType: 'youtube', sourceId: null };
  }

  return {
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    sourceType: 'youtube',
    sourceId: videoId,
  };
}

function normalizeSoundCloud(url: URL): NormalizedUrl {
  // Strip tracking params specific to SoundCloud
  url.searchParams.delete('si');
  url.searchParams.delete('in');

  const path = url.pathname.replace(/\/+$/, '');
  const normalized = `https://soundcloud.com${path}`;
  const parts = path.split('/').filter(Boolean);
  const sourceId = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;

  return { normalizedUrl: normalized, sourceType: 'soundcloud', sourceId };
}
