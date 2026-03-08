<script lang="ts">
  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  interface Props {
    items: BreadcrumbItem[];
  }

  const { items }: Props = $props();
</script>

<nav class="breadcrumb" aria-label="Breadcrumb">
  <ol>
    {#each items as item, i}
      <li>
        {#if item.href && i < items.length - 1}
          <a href={item.href}>{item.label}</a>
        {:else}
          <span class="current" aria-current={i === items.length - 1 ? 'page' : undefined}>{item.label}</span>
        {/if}
      </li>
      {#if i < items.length - 1}
        <li class="separator" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </li>
      {/if}
    {/each}
  </ol>
</nav>

<style>
  ol {
    display: flex;
    align-items: center;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  a {
    color: #a0a0b0;
    text-decoration: none;
    font-size: 13px;
    transition: color 0.15s;
  }

  a:hover {
    color: #00f5ff;
  }

  .current {
    color: #f0f0f5;
    font-size: 13px;
  }

  .separator {
    display: flex;
    align-items: center;
    color: #606070;
  }
</style>
