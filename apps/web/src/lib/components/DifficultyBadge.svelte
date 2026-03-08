<script lang="ts">
  import { NeonBadge } from '@nuit-one/ui';
  import type { DifficultyTier } from '@nuit-one/shared';

  interface Props {
    tier: DifficultyTier;
  }

  let { tier }: Props = $props();

  const tierConfig: Record<DifficultyTier, { label: string; color: 'green' | 'amber' | 'magenta' | 'violet' }> = {
    easy: { label: 'Easy', color: 'green' },
    medium: { label: 'Medium', color: 'amber' },
    hard: { label: 'Hard', color: 'magenta' },
    expert: { label: 'Expert', color: 'violet' },
  };

  let config = $derived(tierConfig[tier]);
</script>

<NeonBadge color={config.color}>{config.label}</NeonBadge>
