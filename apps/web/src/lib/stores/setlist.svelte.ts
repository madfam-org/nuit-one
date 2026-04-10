import type { PerformanceResult, PlayableInstrument } from '@nuit-one/shared';

export interface SetlistTrack {
  trackId: string;
  title: string;
}

export interface SetlistTrackResult {
  trackId: string;
  title: string;
  results: Record<string, PerformanceResult>;
  completedAt: number;
}

export interface SetlistPlayerConfig {
  instrument: PlayableInstrument | null;
  deviceId: string | null;
}

// Module-level singleton state
let tracks = $state<SetlistTrack[]>([]);
let currentIndex = $state(0);
let trackResults = $state<SetlistTrackResult[]>([]);
let isActive = $state(false);
let playerConfigs = $state<SetlistPlayerConfig[]>([]);

export function getSetlistStore() {
  return {
    get tracks() {
      return tracks;
    },
    get currentIndex() {
      return currentIndex;
    },
    get trackResults() {
      return trackResults;
    },
    get isActive() {
      return isActive;
    },
    get playerConfigs() {
      return playerConfigs;
    },

    // Derived
    get currentTrack(): SetlistTrack | null {
      return tracks[currentIndex] ?? null;
    },
    get nextTrack(): SetlistTrack | null {
      return tracks[currentIndex + 1] ?? null;
    },
    get isLastTrack(): boolean {
      return currentIndex >= tracks.length - 1;
    },
    get totalTracks(): number {
      return tracks.length;
    },
    get completedCount(): number {
      return trackResults.length;
    },

    /** Activate the setlist for playback */
    start() {
      if (tracks.length === 0) return;
      currentIndex = 0;
      trackResults = [];
      isActive = true;
    },

    /** Add a track to the setlist */
    addTrack(track: SetlistTrack) {
      tracks = [...tracks, track];
    },

    /** Remove a track by index */
    removeTrack(index: number) {
      if (index < 0 || index >= tracks.length) return;
      tracks = tracks.filter((_, i) => i !== index);
    },

    /** Move a track from one position to another */
    moveTrack(fromIndex: number, toIndex: number) {
      if (
        fromIndex < 0 ||
        fromIndex >= tracks.length ||
        toIndex < 0 ||
        toIndex >= tracks.length ||
        fromIndex === toIndex
      ) {
        return;
      }
      const updated = [...tracks];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved!);
      tracks = updated;
    },

    /** Record the result for the current track */
    recordResult(results: Record<string, PerformanceResult>) {
      const current = tracks[currentIndex];
      if (!current) return;
      trackResults = [
        ...trackResults,
        {
          trackId: current.trackId,
          title: current.title,
          results,
          completedAt: Date.now(),
        },
      ];
    },

    /** Advance to the next track in the setlist */
    advance() {
      if (currentIndex < tracks.length - 1) {
        currentIndex++;
      }
    },

    /** Get cumulative stats across all completed tracks */
    getCumulativeStats(): {
      totalScore: number;
      avgAccuracy: number;
      bestCombo: number;
      tracksPlayed: number;
    } {
      if (trackResults.length === 0) {
        return { totalScore: 0, avgAccuracy: 0, bestCombo: 0, tracksPlayed: 0 };
      }

      let totalScore = 0;
      let totalAccuracy = 0;
      let bestCombo = 0;
      let resultCount = 0;

      for (const tr of trackResults) {
        for (const result of Object.values(tr.results)) {
          totalScore += result.totalScore;
          totalAccuracy += result.accuracy;
          bestCombo = Math.max(bestCombo, result.maxCombo);
          resultCount++;
        }
      }

      return {
        totalScore,
        avgAccuracy: resultCount > 0 ? Math.round(totalAccuracy / resultCount) : 0,
        bestCombo,
        tracksPlayed: trackResults.length,
      };
    },

    /** Clear the setlist and reset all state */
    clear() {
      tracks = [];
      currentIndex = 0;
      trackResults = [];
      isActive = false;
      playerConfigs = [];
    },

    /** Save player configurations for persistence across tracks */
    setPlayerConfigs(configs: SetlistPlayerConfig[]) {
      playerConfigs = [...configs];
    },

    /** Get saved player configurations */
    getPlayerConfigs(): SetlistPlayerConfig[] {
      return playerConfigs;
    },
  };
}

export type SetlistStore = ReturnType<typeof getSetlistStore>;
