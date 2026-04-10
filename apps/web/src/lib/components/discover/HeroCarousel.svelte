<script lang="ts">
  import type { CatalogTrack } from '@nuit-one/shared';
  import { onDestroy } from 'svelte';

  interface Props {
    tracks: CatalogTrack[];
    onImport: (track: CatalogTrack) => void;
  }

  const { tracks, onImport }: Props = $props();

  let activeIndex = $state(0);
  let paused = $state(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  const slideCount = $derived(Math.min(tracks.length, 3));
  const currentTrack = $derived(tracks[activeIndex]);

  function startTimer() {
    stopTimer();
    if (slideCount <= 1) return;
    timer = setInterval(() => {
      if (!paused) {
        activeIndex = (activeIndex + 1) % slideCount;
      }
    }, 5000);
  }

  function stopTimer() {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function goTo(index: number) {
    activeIndex = index;
    startTimer();
  }

  function prev() {
    goTo((activeIndex - 1 + slideCount) % slideCount);
  }

  function next() {
    goTo((activeIndex + 1) % slideCount);
  }

  $effect(() => {
    if (slideCount > 1) startTimer();
    return () => stopTimer();
  });

  onDestroy(() => stopTimer());
</script>

<div
  class="hero-carousel"
  role="region"
  aria-label="Featured tracks"
  aria-roledescription="carousel"
  onmouseenter={() => (paused = true)}
  onmouseleave={() => (paused = false)}
>
  <div class="slides-track" style:transform="translateX(-{activeIndex * 100}%)">
    {#each tracks.slice(0, 3) as slide, i (slide.id)}
      <div
        class="slide"
        role="group"
        aria-roledescription="slide"
        aria-label="Slide {i + 1} of {slideCount}"
        aria-hidden={i !== activeIndex}
      >
        <div class="slide-bg">
          {#if slide.thumbnailUrl}
            <img src={slide.thumbnailUrl} alt="" class="slide-img" loading="lazy" decoding="async" />
          {:else}
            <div class="slide-gradient"></div>
          {/if}
          <div class="slide-overlay"></div>
        </div>

        <div class="slide-content">
          <h2 class="slide-title">{slide.title}</h2>
          <p class="slide-artist">{slide.artist ?? 'Unknown artist'}</p>
          <button
            class="import-btn"
            type="button"
            onclick={() => onImport(slide)}
          >
            Import & Play
          </button>
        </div>
      </div>
    {/each}
  </div>

  {#if slideCount > 1}
    <button class="nav-arrow nav-prev" type="button" onclick={prev} aria-label="Previous slide">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <button class="nav-arrow nav-next" type="button" onclick={next} aria-label="Next slide">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9 18l6-6-6-6"/></svg>
    </button>

    <div class="dots" role="tablist" aria-label="Slide navigation">
      {#each Array(slideCount) as _, i}
        <button
          class="dot"
          class:active={i === activeIndex}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          aria-label="Go to slide {i + 1}"
          onclick={() => goTo(i)}
        ></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .hero-carousel {
    position: relative;
    width: 100%;
    height: 280px;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .slides-track {
    display: flex;
    height: 100%;
    transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .slide {
    position: relative;
    min-width: 100%;
    height: 100%;
  }

  .slide-bg {
    position: absolute;
    inset: 0;
  }

  .slide-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .slide-gradient {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #8b5cf6 0%, #00f5ff 50%, #ff00e5 100%);
    opacity: 0.4;
  }

  .slide-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(10, 10, 15, 0.92) 0%,
      rgba(10, 10, 15, 0.5) 50%,
      rgba(10, 10, 15, 0.25) 100%
    );
  }

  .slide-content {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    right: 2rem;
    z-index: 1;
  }

  .slide-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f0f0f5;
    margin: 0 0 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slide-artist {
    font-size: 1rem;
    color: #a0a0b0;
    margin: 0 0 1rem;
  }

  .import-btn {
    padding: 0.5rem 1.25rem;
    border: none;
    border-radius: 8px;
    background: #00f5ff;
    color: #0a0a0f;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: box-shadow 200ms ease, background 200ms ease;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .import-btn:hover {
    box-shadow: 0 0 20px rgba(0, 245, 255, 0.35);
    background: #1af7ff;
  }

  .import-btn:focus-visible {
    outline: 2px solid rgba(0, 245, 255, 0.6);
    outline-offset: 2px;
  }

  /* Navigation arrows */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    color: #f0f0f5;
    cursor: pointer;
    opacity: 0;
    transition: opacity 200ms ease, background 200ms ease;
    z-index: 2;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .hero-carousel:hover .nav-arrow {
    opacity: 1;
  }

  .nav-arrow:hover {
    background: rgba(0, 0, 0, 0.65);
  }

  .nav-arrow:focus-visible {
    opacity: 1;
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.5);
  }

  .nav-prev {
    left: 12px;
  }

  .nav-next {
    right: 12px;
  }

  /* Dots */
  .dots {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 2;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 0;
    transition: background 250ms ease, box-shadow 250ms ease;
  }

  .dot.active {
    background: #00f5ff;
    box-shadow: 0 0 8px rgba(0, 245, 255, 0.5);
  }

  .dot:hover:not(.active) {
    background: rgba(255, 255, 255, 0.6);
  }

  .dot:focus-visible {
    box-shadow: 0 0 0 2px rgba(0, 245, 255, 0.5);
  }
</style>
