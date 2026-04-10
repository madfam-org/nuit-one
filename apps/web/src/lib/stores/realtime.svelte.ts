import Pusher from 'pusher-js';

interface OnlineMember {
  userId: string;
}

interface LivePerformance {
  userId: string;
  trackId: string;
  score: number;
  accuracy: number;
  combo: number;
  timestamp: number;
}

let client = $state<Pusher | null>(null);
let connected = $state(false);
let onlineMembers = $state<OnlineMember[]>([]);
let livePerformances = $state<LivePerformance[]>([]);
let recentCompletions = $state<
  Array<{ userId: string; trackId: string; totalScore: number; accuracy: number }>
>([]);

export function getRealtimeStore() {
  return {
    get connected() {
      return connected;
    },
    get onlineMembers() {
      return onlineMembers;
    },
    get onlineCount() {
      return onlineMembers.length;
    },
    get livePerformances() {
      return livePerformances;
    },
    get recentCompletions() {
      return recentCompletions;
    },
    get hasLivePerformance() {
      return livePerformances.length > 0;
    },

    connect(workspaceId: string, appKey: string, host: string, port: number) {
      if (client) return;

      try {
        client = new Pusher(appKey, {
          wsHost: host,
          wsPort: port,
          wssPort: port,
          forceTLS: false,
          enabledTransports: ['ws', 'wss'],
          authEndpoint: '/api/pusher/auth',
          cluster: 'mt1',
        });

        // Presence channel for online tracking
        const presence = client.subscribe(`presence-workspace-${workspaceId}`);
        presence.bind(
          'pusher:subscription_succeeded',
          (members: {
            count: number;
            each: (cb: (member: { id: string }) => void) => void;
          }) => {
            const list: OnlineMember[] = [];
            members.each((m) => list.push({ userId: m.id }));
            onlineMembers = list;
            connected = true;
          },
        );
        presence.bind('pusher:member_added', (member: { id: string }) => {
          onlineMembers = [...onlineMembers, { userId: member.id }];
        });
        presence.bind('pusher:member_removed', (member: { id: string }) => {
          onlineMembers = onlineMembers.filter((m) => m.userId !== member.id);
        });

        // Private channel for workspace events
        const workspace = client.subscribe(`private-workspace-${workspaceId}`);
        workspace.bind(
          'performance:completed',
          (data: {
            userId: string;
            trackId: string;
            totalScore: number;
            accuracy: number;
          }) => {
            recentCompletions = [data, ...recentCompletions.slice(0, 9)];
          },
        );
        workspace.bind('client-live-score', (data: LivePerformance) => {
          const idx = livePerformances.findIndex((p) => p.userId === data.userId);
          if (idx >= 0) {
            livePerformances = livePerformances.map((p, i) => (i === idx ? data : p));
          } else {
            livePerformances = [...livePerformances, data];
          }
          // Auto-remove stale live performances (no update for 10s)
          setTimeout(() => {
            livePerformances = livePerformances.filter(
              (p) => p.userId !== data.userId || Date.now() - p.timestamp < 10000,
            );
          }, 10000);
        });
      } catch (err) {
        console.warn('Failed to connect to real-time service:', err);
      }
    },

    disconnect() {
      client?.disconnect();
      client = null;
      connected = false;
      onlineMembers = [];
      livePerformances = [];
    },
  };
}
