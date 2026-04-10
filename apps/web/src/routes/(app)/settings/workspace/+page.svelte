<script lang="ts">
  import { Avatar, Button, GlassCard, NeonBadge } from '@nuit-one/ui';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let inviteEmail = $state('');
  let inviteRole = $state('member');
  let inviting = $state(false);
  let inviteError = $state('');
  let inviteSuccess = $state('');
  let removing = $state<string | null>(null);

  const roleBadgeColor = {
    owner: 'amber' as const,
    admin: 'magenta' as const,
    manager: 'violet' as const,
    member: 'cyan' as const,
    viewer: 'green' as const,
  };

  async function handleInvite() {
    if (!inviteEmail.trim()) return;

    inviting = true;
    inviteError = '';
    inviteSuccess = '';

    try {
      const res = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to send invitation');
      }

      inviteSuccess = `Invitation sent to ${inviteEmail}`;
      inviteEmail = '';
      inviteRole = 'member';
      await invalidateAll();
    } catch (e) {
      inviteError = e instanceof Error ? e.message : 'Failed to send invitation';
    } finally {
      inviting = false;
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the workspace?')) return;

    removing = userId;
    try {
      const res = await fetch(`/api/workspace/members/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to remove member');
      }

      await invalidateAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      removing = null;
    }
  }
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-6">
    <a href="/settings" class="text-text-muted text-sm hover:text-text-secondary">&larr; Settings</a>
    <h1 class="text-xl font-bold mt-1">Workspace / Band</h1>
    <p class="text-text-muted text-sm">Manage your band members and invitations</p>
  </header>

  <main class="mx-auto max-w-xl space-y-6">
    <!-- Members list -->
    <GlassCard padding="lg">
      <h2 class="font-semibold mb-4">Members ({data.members.length})</h2>
      <div class="space-y-3">
        {#each data.members as member}
          <div class="flex items-center gap-3">
            <Avatar
              name={member.displayName}
              src={member.avatarUrl ?? undefined}
              size="md"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{member.displayName}</p>
              <p class="text-text-muted text-xs">
                Joined {new Date(member.joinedAt).toLocaleDateString()}
              </p>
            </div>
            <NeonBadge color={roleBadgeColor[member.role as keyof typeof roleBadgeColor] ?? 'cyan'}>
              {member.role}
            </NeonBadge>
            {#if data.isAdmin && member.role !== 'owner'}
              <Button
                variant="ghost"
                size="sm"
                onclick={() => handleRemove(member.userId)}
                disabled={removing === member.userId}
              >
                {removing === member.userId ? '...' : 'Remove'}
              </Button>
            {/if}
          </div>
        {:else}
          <p class="text-text-muted text-sm text-center py-4">No members yet</p>
        {/each}
      </div>
    </GlassCard>

    <!-- Invite form (admins only) -->
    {#if data.isAdmin}
      <GlassCard padding="lg">
        <h2 class="font-semibold mb-4">Invite Member</h2>

        {#if inviteError}
          <p class="text-red-400 text-sm mb-3">{inviteError}</p>
        {/if}
        {#if inviteSuccess}
          <p class="text-green-400 text-sm mb-3">{inviteSuccess}</p>
        {/if}

        <div class="space-y-3">
          <div>
            <label for="invite-email" class="block text-sm text-text-muted mb-1">Email address</label>
            <input
              id="invite-email"
              type="email"
              bind:value={inviteEmail}
              placeholder="band@example.com"
              class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30"
            />
          </div>
          <div>
            <label for="invite-role" class="block text-sm text-text-muted mb-1">Role</label>
            <select
              id="invite-role"
              bind:value={inviteRole}
              class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <Button
            variant="primary"
            onclick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
          >
            {inviting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </div>
      </GlassCard>
    {/if}

    <!-- Pending invitations -->
    {#if data.isAdmin && data.pendingInvitations.length > 0}
      <GlassCard padding="lg">
        <h2 class="font-semibold mb-4">Pending Invitations ({data.pendingInvitations.length})</h2>
        <div class="space-y-3">
          {#each data.pendingInvitations as invitation}
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 text-text-muted">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{invitation.email}</p>
                <p class="text-text-muted text-xs">
                  Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <NeonBadge color={roleBadgeColor[invitation.role as keyof typeof roleBadgeColor] ?? 'cyan'}>
                {invitation.role}
              </NeonBadge>
            </div>
          {/each}
        </div>
      </GlassCard>
    {/if}
  </main>
</div>
