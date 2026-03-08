import { getAudioContext } from '$lib/audio/audio-context.js';
import { createPlayerStore, type PlayerStore } from './player.svelte.js';

export type SessionType = 'studio' | 'perform' | 'idle';

let activePlayer = $state<PlayerStore | null>(null);
let activeTrackId = $state<string | null>(null);
let activeProjectId = $state<string | null>(null);
let activeTrackTitle = $state<string | null>(null);
let sessionType = $state<SessionType>('idle');

export function getSessionStore() {
  return {
    get activePlayer() { return activePlayer; },
    get activeTrackId() { return activeTrackId; },
    get activeProjectId() { return activeProjectId; },
    get activeTrackTitle() { return activeTrackTitle; },
    get sessionType() { return sessionType; },

    /** Create a new player backed by the shared AudioContext */
    createPlayer(): PlayerStore {
      // Destroy existing player if any
      activePlayer?.destroy();
      const ctx = getAudioContext();
      const store = createPlayerStore(ctx);
      activePlayer = store;
      return store;
    },

    setActiveTrack(trackId: string, title: string) {
      activeTrackId = trackId;
      activeTrackTitle = title;
    },

    setActiveProject(projectId: string) {
      activeProjectId = projectId;
    },

    setSessionType(type: SessionType) {
      sessionType = type;
    },

    /** Stop playback and clear session state */
    clearSession() {
      activePlayer?.destroy();
      activePlayer = null;
      activeTrackId = null;
      activeProjectId = null;
      activeTrackTitle = null;
      sessionType = 'idle';
    },
  };
}

export type SessionStore = ReturnType<typeof getSessionStore>;
