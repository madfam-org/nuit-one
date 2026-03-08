<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/stores';
  import {
    Sidebar,
    SidebarItem,
    SidebarSection,
    BottomBar,
    BottomTabs,
  } from '@nuit-one/ui';
  import { getSidebarStore } from '$lib/stores/sidebar.svelte';
  import { createLayoutStore } from '$lib/stores/layout.svelte';
  import { getSessionStore } from '$lib/stores/session.svelte';
  import { icons } from '$lib/icons';

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();

  const sidebar = getSidebarStore();
  const layout = createLayoutStore();
  const session = getSessionStore();

  // Auto-collapse sidebar on tablet
  $effect(() => {
    if (layout.isTablet) {
      sidebar.collapsed = true;
    }
  });
</script>

<!-- Sidebar icon snippets -->
{#snippet dashIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.dashboard}/></svg>
{/snippet}
{#snippet libIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.library}/></svg>
{/snippet}
{#snippet studioIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.studio}/></svg>
{/snippet}
{#snippet settingsIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.settings}/></svg>
{/snippet}

<!-- Mobile tab icon snippets -->
{#snippet mDashIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.dashboard}/></svg>
{/snippet}
{#snippet mLibIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.library}/></svg>
{/snippet}
{#snippet mStudioIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.studio}/></svg>
{/snippet}
{#snippet mSettingsIcon()}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={icons.settings}/></svg>
{/snippet}

<div class="app-shell">
  {#if !layout.isMobile}
    <Sidebar collapsed={sidebar.collapsed} onToggle={() => sidebar.toggle()}>
      <SidebarSection>
        <SidebarItem
          href="/dashboard"
          icon={dashIcon}
          label="Dashboard"
          active={$page.url.pathname === '/dashboard'}
          collapsed={sidebar.collapsed}
        />
        <SidebarItem
          href="/library"
          icon={libIcon}
          label="Library"
          active={$page.url.pathname.startsWith('/library')}
          collapsed={sidebar.collapsed}
        />
        <SidebarItem
          href="/projects"
          icon={studioIcon}
          label="Projects"
          active={$page.url.pathname.startsWith('/projects') || $page.url.pathname.startsWith('/studio')}
          collapsed={sidebar.collapsed}
        />
        <SidebarItem
          href="/settings"
          icon={settingsIcon}
          label="Settings"
          active={$page.url.pathname.startsWith('/settings')}
          collapsed={sidebar.collapsed}
        />
      </SidebarSection>
    </Sidebar>
  {/if}

  <div class="main-area">
    <main class="page-content">
      {@render children()}
    </main>

    <BottomBar
      trackTitle={session.activeTrackTitle ?? undefined}
      isPlaying={session.activePlayer?.isPlaying ?? false}
      currentTime={session.activePlayer?.currentTime ?? 0}
      duration={session.activePlayer?.duration ?? 0}
      onPlayPause={() => session.activePlayer?.togglePlayback()}
      onSeek={(t) => session.activePlayer?.seek(t)}
    />
  </div>

  {#if layout.isMobile}
    <BottomTabs
      items={[
        { href: '/dashboard', label: 'Home', icon: mDashIcon },
        { href: '/library', label: 'Library', icon: mLibIcon },
        { href: '/projects', label: 'Studio', icon: mStudioIcon },
        { href: '/settings', label: 'Settings', icon: mSettingsIcon },
      ]}
      activeHref={$page.url.pathname}
    />
  {/if}
</div>

<style>
  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
    background: #0a0a0f;
  }

  .main-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .page-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
