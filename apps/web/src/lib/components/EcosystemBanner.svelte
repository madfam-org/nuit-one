<script lang="ts">
  import { onMount } from 'svelte';

  const STORAGE_KEY = 'madfam_ecosystem_banner';
  const BANNER_VERSION = 4;
  const DISMISS_DAYS = 30;
  const SECONDS_PER_PLATFORM = 6;

  const platforms = [
    { keyword: 'BUDGETING & WEALTH', name: 'Dhanam', url: 'https://dhan.am' },
    { keyword: 'AI AGENT OFFICE', name: 'Selva', url: 'https://selva.town' },
    { keyword: 'COMPLIANCE & CFDI', name: 'Karafiel', url: 'https://karafiel.mx' },
    { keyword: 'AUTHENTICATION', name: 'Janua', url: 'https://auth.madfam.io' },
    { keyword: 'DEPLOYMENT', name: 'Enclii', url: 'https://enclii.dev' },
    { keyword: 'LEGAL OPS', name: 'Tezca', url: 'https://tezca.mx' },
    { keyword: 'PHYGITAL FABRICATION', name: 'Yantra4D', url: 'https://yantra4d.com' },
    { keyword: 'QUOTING ENGINE', name: 'Cotiza', url: 'https://cotiza.studio' },
    { keyword: 'INDUSTRY INTELLIGENCE', name: 'Forge Sight', url: 'https://forgesight.quest' },
    { keyword: 'MANUFACTURING', name: 'Pravara', url: 'https://mes.madfam.io' },
    { keyword: 'GAMES', name: 'Rondelio', url: 'https://rondel.io' },
    { keyword: 'ROUTING & LOGISTICS', name: 'RouteCraft', url: 'https://routecraft.app' },
    { keyword: 'CLIENT PORTAL & CRM', name: 'PhyndCRM', url: 'https://phynd.app' },
  ] as const;

  let visible = $state(false);
  const track = [...platforms, ...platforms];
  const durationSec = Math.max(30, platforms.length * SECONDS_PER_PLATFORM);

  function isDismissed(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { v?: number; dismissed_at?: number };
      if (parsed.v !== BANNER_VERSION || typeof parsed.dismissed_at !== 'number') return false;
      return Date.now() - parsed.dismissed_at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function dismiss() {
    visible = false;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: BANNER_VERSION, dismissed_at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
  }

  onMount(() => {
    visible = !isDismissed();
  });
</script>

{#if visible}
  <div
    class="madfam-eco-banner"
    role="complementary"
    aria-label="MADFAM ecosystem ticker"
    data-testid="ecosystem-banner"
    style={`--madfam-marquee-duration: ${durationSec}s`}
  >
    <div class="madfam-eco-banner__inner">
      <span class="madfam-eco-banner__label" aria-hidden="true">MADFAM ECOSYSTEM</span>
      <span class="madfam-eco-banner__separator" aria-hidden="true">/</span>
      <div class="madfam-eco-banner__viewport">
        <div class="madfam-eco-banner__track">
          {#each track as platform, index (platform.name + index)}
            <a
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              class="madfam-eco-banner__item"
              aria-hidden={index >= platforms.length ? true : undefined}
              tabindex={index >= platforms.length ? -1 : undefined}
            >
              <span class="madfam-eco-banner__keyword">{platform.keyword}:</span>
              <span class="madfam-eco-banner__name">{platform.name}</span>
              <span class="madfam-eco-banner__external">↗</span>
            </a>
          {/each}
        </div>
      </div>
      <button type="button" class="madfam-eco-banner__dismiss" aria-label="Dismiss MADFAM ecosystem ticker" onclick={dismiss}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  </div>
{/if}

<style>
  @keyframes ecosystemBannerIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ecosystemMarquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  .madfam-eco-banner {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 40;
    background: rgb(15 23 42 / 95%);
    color: rgb(241 245 249);
    border-top: 1px solid rgb(30 41 59);
    backdrop-filter: blur(4px);
    animation: ecosystemBannerIn 300ms ease-out both;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .madfam-eco-banner__inner {
    width: 100%;
    max-width: 1536px;
    height: 28px;
    margin-inline: auto;
    padding-inline: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    line-height: 1;
  }
  .madfam-eco-banner__label,
  .madfam-eco-banner__separator { display: none; }
  .madfam-eco-banner__viewport {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent);
  }
  .madfam-eco-banner__track {
    display: flex;
    align-items: center;
    width: max-content;
    gap: 28px;
    animation: ecosystemMarquee var(--madfam-marquee-duration, 78s) linear infinite;
  }
  .madfam-eco-banner__item {
    display: inline-flex;
    flex-shrink: 0;
    align-items: baseline;
    gap: 6px;
    color: rgb(241 245 249);
    text-decoration: none;
  }
  .madfam-eco-banner__item:hover {
    color: #fff;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .madfam-eco-banner__keyword {
    font-family: ui-monospace, monospace;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: rgb(148 163 184);
  }
  .madfam-eco-banner__name { font-weight: 600; white-space: nowrap; }
  .madfam-eco-banner__external { color: rgb(100 116 139); margin-left: 2px; }
  .madfam-eco-banner__dismiss {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border: 0;
    background: transparent;
    color: rgb(148 163 184);
    cursor: pointer;
    font-size: 16px;
  }
  @media (min-width: 640px) {
    .madfam-eco-banner__inner { font-size: 12px; }
    .madfam-eco-banner__label,
    .madfam-eco-banner__separator { display: inline-block; }
    .madfam-eco-banner__separator { color: rgb(71 85 105); }
    .madfam-eco-banner__label {
      border-radius: 2px;
      background: rgb(30 41 59);
      padding: 2px 6px;
      font-family: ui-monospace, monospace;
      font-size: 10px;
      text-transform: uppercase;
      color: rgb(148 163 184);
    }
    .madfam-eco-banner__dismiss { width: 28px; height: 28px; flex-basis: 28px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .madfam-eco-banner { animation: none; }
    .madfam-eco-banner__track {
      animation: none;
      flex-wrap: wrap;
      width: 100%;
      gap: 8px 16px;
    }
  }
</style>
