<script lang="ts">
  import { GlassCard } from '@nuit-one/ui';
  import type { CatalogTrack } from '@nuit-one/shared';
  import GenreChips from '$lib/components/discover/GenreChips.svelte';
  import HeroCarousel from '$lib/components/discover/HeroCarousel.svelte';
  import SearchInput from '$lib/components/discover/SearchInput.svelte';
  import TrackCard from '$lib/components/discover/TrackCard.svelte';
  import TrackRow from '$lib/components/discover/TrackRow.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let searchResults = $state<CatalogTrack[]>([]);
  let searchQuery = $state('');
  let searching = $state(false);
  let selectedGenre = $state<string | null>(null);
  let genreTracks = $state<CatalogTrack[]>([]);
  let loadingGenre = $state(false);
  let importingIds = $state<Set<string>>(new Set());

  const isSearching = $derived(searchQuery.length > 0);
  const hasData = $derived(
    data.featured.length > 0 ||
    data.trending.length > 0 ||
    data.newThisWeek.length > 0,
  );

  async function handleSearch(query: string) {
    searchQuery = query;
    if (!query) {
      searchResults = [];
      searching = false;
      return;
    }
    searching = true;
    try {
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(query)}&limit=30`);
      if (res.ok) {
        searchResults = await res.json();
      }
    } finally {
      searching = false;
    }
  }

  async function handleGenreSelect(genre: string | null) {
    selectedGenre = genre;
    if (!genre) {
      genreTracks = [];
      loadingGenre = false;
      return;
    }
    loadingGenre = true;
    try {
      const res = await fetch(`/api/catalog/search?genre=${encodeURIComponent(genre)}&limit=30`);
      if (res.ok) {
        genreTracks = await res.json();
      }
    } finally {
      loadingGenre = false;
    }
  }

  async function handleImport(track: CatalogTrack) {
    if (importingIds.has(track.id)) return;
    importingIds.add(track.id);
    importingIds = new Set(importingIds);
    try {
      const res = await fetch('/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: track.sourceUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }));
        console.error('Import error:', err.error ?? 'Unknown error');
      }
    } catch (e) {
      console.error('Import failed:', e);
    } finally {
      importingIds.delete(track.id);
      importingIds = new Set(importingIds);
    }
  }
</script>

<svelte:head>
  <title>Discover - Nuit One</title>
</svelte:head>

<div class="discover-page">
  <header class="discover-header">
    <h1 class="page-title">Discover</h1>
    <p class="page-subtitle">Find trending tracks and import them for practice</p>
  </header>

  <div class="search-section">
    <SearchInput onSearch={handleSearch} />
  </div>

  {#if isSearching}
    <!-- Search results mode -->
    <section class="search-results-section" aria-label="Search results">
      {#if searching}
        <div class="loading-state">
          <div class="spinner"></div>
          <span class="loading-text">Searching...</span>
        </div>
      {:else if searchResults.length === 0}
        <div class="empty-state">
          <GlassCard padding="lg">
            <p class="empty-text">No results for "{searchQuery}"</p>
          </GlassCard>
        </div>
      {:else}
        <p class="results-count">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
        <div class="results-grid">
          {#each searchResults as track (track.id)}
            <TrackCard
              {track}
              onImport={handleImport}
              importing={importingIds.has(track.id)}
            />
          {/each}
        </div>
      {/if}
    </section>

  {:else if !hasData}
    <!-- Empty state: no catalog data yet -->
    <div class="empty-state">
      <GlassCard padding="lg">
        <p class="empty-text">No catalog data yet. Charts will appear here once the catalog is populated.</p>
      </GlassCard>
    </div>

  {:else}
    <!-- Main browse mode -->
    {#if data.featured.length > 0}
      <section class="section" aria-label="Featured">
        <HeroCarousel tracks={data.featured} onImport={handleImport} />
      </section>
    {/if}

    <TrackRow title="Trending Now" tracks={data.trending} onImport={handleImport} />

    <TrackRow title="New This Week" tracks={data.newThisWeek} onImport={handleImport} />

    {#if data.genres.length > 0}
      <section class="section" aria-label="Browse by genre">
        <h2 class="section-title">Browse by Genre</h2>
        <GenreChips genres={data.genres} selected={selectedGenre} onSelect={handleGenreSelect} />

        {#if selectedGenre}
          {#if loadingGenre}
            <div class="loading-state small">
              <div class="spinner"></div>
              <span class="loading-text">Loading...</span>
            </div>
          {:else if genreTracks.length === 0}
            <p class="empty-genre">No tracks found for this genre.</p>
          {:else}
            <div class="results-grid genre-grid">
              {#each genreTracks as track (track.id)}
                <TrackCard
                  {track}
                  onImport={handleImport}
                  importing={importingIds.has(track.id)}
                />
              {/each}
            </div>
          {/if}
        {/if}
      </section>
    {/if}

    {#if data.popularInWorkspace.length > 0}
      <TrackRow title="Recently Played" tracks={data.popularInWorkspace} onImport={handleImport} />
    {/if}
  {/if}
</div>

<style>
  .discover-page {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .discover-header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f0f0f5;
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: #606070;
    margin: 0;
  }

  .search-section {
    max-width: 480px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #f0f0f5;
    margin: 0;
  }

  /* Search results grid */
  .search-results-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .results-count {
    font-size: 0.8rem;
    color: #a0a0b0;
    margin: 0;
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 180px));
    gap: 1rem;
  }

  .genre-grid {
    margin-top: 0.75rem;
  }

  /* Loading state */
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
  }

  .loading-state.small {
    padding: 2rem 1rem;
  }

  .loading-text {
    font-size: 0.875rem;
    color: #a0a0b0;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(0, 245, 255, 0.2);
    border-top-color: #00f5ff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Empty states */
  .empty-state {
    padding: 2rem 0;
    text-align: center;
  }

  .empty-text {
    color: #a0a0b0;
    font-size: 0.875rem;
    margin: 0;
  }

  .empty-genre {
    color: #606070;
    font-size: 0.8rem;
    margin: 0.5rem 0 0;
  }
</style>
