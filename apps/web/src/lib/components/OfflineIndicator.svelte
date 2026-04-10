<script lang="ts">
	import { onMount } from 'svelte';

	let isOffline = $state(false);

	onMount(() => {
		isOffline = !navigator.onLine;

		function goOnline() {
			isOffline = false;
		}
		function goOffline() {
			isOffline = true;
		}

		window.addEventListener('online', goOnline);
		window.addEventListener('offline', goOffline);

		return () => {
			window.removeEventListener('online', goOnline);
			window.removeEventListener('offline', goOffline);
		};
	});
</script>

{#if isOffline}
	<div class="offline-indicator" role="status" aria-live="polite">
		<span class="offline-dot"></span>
		Offline
	</div>
{/if}

<style>
	.offline-indicator {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 9999px;
		color: #f59e0b;
		font-size: 0.75rem;
		font-weight: 500;
		z-index: 1000;
		animation: nuit-fade-in 300ms ease;
	}

	.offline-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #f59e0b;
	}

	@keyframes nuit-fade-in {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
