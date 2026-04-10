<script lang="ts">
  import { GlassCard } from '@nuit-one/ui';
</script>

<div class="min-h-screen bg-nuit-base p-8">
  <header class="mb-6">
    <a href="/dashboard" class="text-text-muted text-sm hover:text-text-secondary">&larr; Dashboard</a>
    <h1 class="text-xl font-bold mt-1">Settings</h1>
    <p class="text-text-muted text-sm">Manage your account and workspace preferences</p>
  </header>

  <main class="mx-auto max-w-lg space-y-4">
    <a href="/settings/calibration" class="block">
      <GlassCard variant="interactive" padding="lg">
        <div class="flex items-center gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style="background: rgba(0, 245, 255, 0.12);">
            <svg viewBox="0 0 24 24" fill="none" stroke="#00f5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div>
            <h2 class="font-semibold">Latency Calibration</h2>
            <p class="text-text-muted text-sm">Measure your system's audio latency for accurate scoring</p>
          </div>
        </div>
      </GlassCard>
    </a>

    <a href="/settings/workspace" class="block">
      <GlassCard variant="interactive" padding="lg">
        <div class="flex items-center gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style="background: rgba(139, 92, 246, 0.12);">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h2 class="font-semibold">Workspace / Band</h2>
            <p class="text-text-muted text-sm">Manage members, invite collaborators, and configure your band</p>
          </div>
        </div>
      </GlassCard>
    </a>
  </main>
</div>
