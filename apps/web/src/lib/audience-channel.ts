import type { NoteEvent, PerformanceResult } from '@nuit-one/shared';

export const AUDIENCE_CHANNEL_PREFIX = 'nuit-audience';

export type AudienceMessage =
  | {
      type: 'state';
      gameState: string;
      currentTime: number;
      duration: number;
      countdown?: number;
    }
  | {
      type: 'scores';
      players: Array<{
        label: string;
        instrument: string;
        color: string;
        score: number;
        combo: number;
        accuracy: number;
        lastJudgment: string | null;
      }>;
    }
  | { type: 'track'; title: string; trackNumber?: number; totalTracks?: number }
  | {
      type: 'results';
      players: Array<{
        label: string;
        instrument: string;
        color: string;
        results: PerformanceResult;
      }>;
    }
  | {
      type: 'notes';
      instruments: Record<
        string,
        { notes: NoteEvent[]; minPitch: number; maxPitch: number; color: string }
      >;
    };

export function createAudienceSender(trackId: string) {
  const channel = new BroadcastChannel(`${AUDIENCE_CHANNEL_PREFIX}-${trackId}`);
  return {
    send(msg: AudienceMessage) {
      channel.postMessage(msg);
    },
    close() {
      channel.close();
    },
  };
}

export function createAudienceReceiver(
  trackId: string,
  onMessage: (msg: AudienceMessage) => void,
) {
  const channel = new BroadcastChannel(`${AUDIENCE_CHANNEL_PREFIX}-${trackId}`);
  channel.onmessage = (e: MessageEvent) => onMessage(e.data as AudienceMessage);
  return {
    close() {
      channel.close();
    },
  };
}
