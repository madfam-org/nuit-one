export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly avatarUrl: string | null;
  readonly memberCount: number;
  readonly role: WorkspaceRole;
}

export interface WorkspaceMember {
  readonly userId: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: WorkspaceRole;
  readonly joinedAt: string;
}
