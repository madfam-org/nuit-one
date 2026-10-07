<script lang="ts">
  import { colors } from '@nuit-one/ui';

  interface Props {
    playing: boolean;
    /** Current position in seconds. */
    time: number;
    /** Length of the piece in seconds; 0 while it is unknown. */
    duration: number;
    /** Greys the controls out (nothing to play yet). */
    disabled?: boolean;
    /** Selected playback speed; omit `speeds` to hide the control. */
    speed?: number;
    speeds?: readonly number[];
    /** A short status shown under the controls ("Loading audio..."). */
    note?: string;
    onToggle: () => void;
    onRestart: () => void;
    /** The slider was released (or stepped with the keyboard): go there. */
    onSeek: (seconds: number) => void;
    /** While the slider is being dragged: the time under the thumb; null when the drag is over. */
    onScrub?: (seconds: number | null) => void;
    onSpeed?: (speed: number) => void;
  }

  const {
    playing,
    time,
    duration,
    disabled = false,
    speed = 1,
    speeds = [],
    note = '',
    onToggle,
    onRestart,
    onSeek,
    onScrub,
    onSpeed,
  }: Props = $props();

  const uid = $props.id();

  let scrubbing = $state(false);
  let scrubTime = $state(0);

  const shown = $derived(scrubbing ? scrubTime : time);
  const fill = $derived(duration > 0 ? Math.min(100, Math.max(0, (shown / duration) * 100)) : 0);

  function format(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  }

  function formatSpeed(value: number): string {
    return `${value}×`;
  }

  function onInput(event: Event & { currentTarget: HTMLInputElement }): void {
    scrubbing = true;
    scrubTime = Number(event.currentTarget.value);
    onScrub?.(scrubTime);
  }

  function onChange(event: Event & { currentTarget: HTMLInputElement }): void {
    const target = Number(event.currentTarget.value);
    scrubbing = false;
    onScrub?.(null);
    onSeek(target);
  }
</script>

<div
  class="transport"
  class:disabled
  style:--tp-cyan={colors.neon.cyan}
  style:--tp-base={colors.background.base}
  style:--tp-text={colors.text.primary}
  style:--tp-soft={colors.text.secondary}
>
  <div class="row">
    <button
      type="button"
      class="play"
      aria-label={playing ? 'Pause' : 'Play'}
      {disabled}
      onclick={onToggle}
    >
      {#if playing}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="4" width="4.5" height="16" rx="1.2" />
          <rect x="13.5" y="4" width="4.5" height="16" rx="1.2" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 4.8v14.4a.8.8 0 0 0 1.2.7l11.2-7.2a.8.8 0 0 0 0-1.4L9.2 4.1A.8.8 0 0 0 8 4.8z" />
        </svg>
      {/if}
    </button>

    <button type="button" class="restart" aria-label="Restart from the beginning" {disabled} onclick={onRestart}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 5v6h6" />
        <path d="M5.5 15a7.5 7.5 0 1 0 1.9-7.9L4 11" />
      </svg>
    </button>

    <span class="time" aria-hidden="true">{format(shown)}<span class="of">/ {format(duration)}</span></span>

    <input
      class="scrub"
      type="range"
      min="0"
      max={duration > 0 ? duration : 1}
      step="0.01"
      value={shown}
      disabled={disabled || duration <= 0}
      aria-label="Position in the piece"
      aria-valuetext="{format(shown)} of {format(duration)}"
      style:--fill="{fill}%"
      oninput={onInput}
      onchange={onChange}
    />

    {#if speeds.length > 0}
      <fieldset class="speeds" {disabled}>
        <legend class="sr-only">Playback speed</legend>
        {#each speeds as option (option)}
          <label class="speed">
            <input
              type="radio"
              name="speed-{uid}"
              value={option}
              checked={option === speed}
              onchange={() => onSpeed?.(option)}
            />
            <span>{formatSpeed(option)}</span>
          </label>
        {/each}
      </fieldset>
    {/if}
  </div>

  {#if note}
    <p class="note" role="status">{note}</p>
  {/if}
</div>

<style>
  .transport {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    font-family: var(--font-mono, ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace);
    color: var(--tp-text);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  button {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 50%;
    transition:
      background-color 160ms ease,
      box-shadow 160ms ease,
      transform 160ms ease,
      opacity 160ms ease;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  button:focus-visible {
    outline: 2px solid var(--tp-cyan);
    outline-offset: 3px;
  }

  button svg {
    width: 1.375rem;
    height: 1.375rem;
  }

  .play {
    width: 3rem;
    height: 3rem;
    color: var(--tp-base);
    background: var(--tp-cyan);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tp-cyan) 35%, transparent);
  }

  .play:hover:not(:disabled) {
    box-shadow: 0 0 22px color-mix(in srgb, var(--tp-cyan) 45%, transparent);
    transform: scale(1.04);
  }

  .play:active:not(:disabled) {
    transform: scale(0.97);
  }

  .restart {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--tp-soft);
    background: transparent;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .restart:hover:not(:disabled) {
    color: var(--tp-text);
    background: rgba(255, 255, 255, 0.06);
  }

  .restart svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  .time {
    flex: none;
    min-width: 5.5rem;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    color: var(--tp-text);
  }

  .of {
    margin-left: 0.375em;
    color: var(--tp-soft);
  }

  .scrub {
    flex: 1 1 8rem;
    min-width: 6rem;
    height: 1.75rem;
    margin: 0;
    cursor: pointer;
    background: transparent;
    -webkit-appearance: none;
    appearance: none;
  }

  .scrub:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .scrub:focus-visible {
    outline: 2px solid var(--tp-cyan);
    outline-offset: 4px;
    border-radius: 4px;
  }

  .scrub::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--tp-cyan) var(--fill), rgba(255, 255, 255, 0.14) var(--fill));
  }

  .scrub::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.14);
  }

  .scrub::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background: var(--tp-cyan);
  }

  .scrub::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border: 0;
    border-radius: 50%;
    background: var(--tp-cyan);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--tp-cyan) 18%, transparent),
      0 0 12px color-mix(in srgb, var(--tp-cyan) 55%, transparent);
    -webkit-appearance: none;
    appearance: none;
  }

  .scrub::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 0;
    border-radius: 50%;
    background: var(--tp-cyan);
    box-shadow:
      0 0 0 4px color-mix(in srgb, var(--tp-cyan) 18%, transparent),
      0 0 12px color-mix(in srgb, var(--tp-cyan) 55%, transparent);
  }

  /* Speed: a segmented control built from native radios (arrow keys work for free). */
  .speeds {
    display: inline-flex;
    flex: none;
    gap: 2px;
    min-width: 0;
    margin: 0;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }

  .speed {
    position: relative;
    display: inline-flex;
  }

  .speed input {
    position: absolute;
    inset: 0;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }

  .speed span {
    min-width: 2.75rem;
    padding: 0.4375rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
    color: var(--tp-soft);
    border-radius: 8px;
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }

  .speed:hover span {
    color: var(--tp-text);
  }

  .speed input:checked + span {
    color: var(--tp-base);
    background: var(--tp-cyan);
  }

  .speed input:focus-visible + span {
    outline: 2px solid var(--tp-cyan);
    outline-offset: 2px;
  }

  .speed input:disabled {
    cursor: not-allowed;
  }

  .note {
    margin: 0;
    font-size: 0.75rem;
    color: var(--tp-soft);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 560px) {
    .transport {
      padding: 0.625rem 0.75rem;
    }

    .scrub {
      order: 5;
      flex-basis: 100%;
    }

    .time {
      min-width: 0;
    }

    .speeds {
      margin-left: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    button,
    .speed span {
      transition: none;
    }

    .play:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
