<script lang="ts">
  interface Props {
    src?: string;
    name: string;
    size?: 'sm' | 'md' | 'lg';
  }

  const { src, name, size = 'md' }: Props = $props();

  function getInitials(n: string): string {
    return n
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
</script>

<div class="avatar {size}" title={name}>
  {#if src}
    <img {src} alt={name} />
  {:else}
    <span class="initials">{getInitials(name)}</span>
  {/if}
</div>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(139, 92, 246, 0.2);
    border: 2px solid rgba(139, 92, 246, 0.4);
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    flex-shrink: 0;
  }

  .avatar:hover {
    border-color: rgba(0, 245, 255, 0.6);
    box-shadow: 0 0 12px rgba(0, 245, 255, 0.2);
  }

  .sm { width: 28px; height: 28px; font-size: 10px; }
  .md { width: 36px; height: 36px; font-size: 13px; }
  .lg { width: 48px; height: 48px; font-size: 16px; }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .initials {
    color: #f0f0f5;
    font-weight: 600;
    letter-spacing: 0.05em;
  }
</style>
