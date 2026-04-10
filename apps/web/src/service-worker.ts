/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE_APP = `nuit-app-${version}`;
const CACHE_AUDIO = 'nuit-audio-v1';

const APP_ASSETS = [...build, ...files];

// Install: precache app shell
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_APP).then((cache) => cache.addAll(APP_ASSETS))
	);
});

// Activate: clean old app caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys
					.filter((k) => k.startsWith('nuit-app-') && k !== CACHE_APP)
					.map((k) => caches.delete(k))
			)
		)
	);
});

// Fetch handler
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only handle GET requests
	if (event.request.method !== 'GET') return;

	// Audio files: cache-first
	if (url.pathname.startsWith('/api/audio/')) {
		event.respondWith(audioCacheFirst(event.request));
		return;
	}

	// App shell assets: cache-first (content-hashed)
	if (APP_ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.match(event.request).then((cached) => cached ?? fetch(event.request))
		);
		return;
	}

	// Everything else: network-first (don't cache API responses, page data, etc.)
});

async function audioCacheFirst(request: Request): Promise<Response> {
	const cached = await caches.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(CACHE_AUDIO);
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		return new Response('Audio unavailable offline', { status: 503 });
	}
}
