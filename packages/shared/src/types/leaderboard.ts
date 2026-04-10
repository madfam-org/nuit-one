export interface LeaderboardEntry {
	readonly rank: number;
	readonly userId: string;
	readonly displayName: string;
	readonly bestScore: number;
	readonly bestAccuracy: number;
	readonly bestCombo: number;
	readonly playCount: number;
	readonly lastPlayed: string;
	readonly isCurrentUser: boolean;
}
