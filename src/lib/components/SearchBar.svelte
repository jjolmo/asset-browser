<script lang="ts">
	let { value = $bindable(''), placeholder = 'Search...', onchange }: {
		value: string;
		placeholder?: string;
		onchange?: (value: string) => void;
	} = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		onchange?.(value);
	}

	function handleClear() {
		value = '';
		onchange?.('');
	}
</script>

<div class="search-bar">
	<svg class="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<path d="M15.7 13.3l-3.81-3.83A5.93 5.93 0 0 0 13 6c0-3.31-2.69-6-6-6S1 2.69 1 6s2.69 6 6 6c1.3 0 2.48-.41 3.47-1.11l3.83 3.81c.19.2.45.3.7.3.25 0 .52-.09.7-.3a.996.996 0 0 0 0-1.41v.01zM7 10.7c-2.59 0-4.7-2.11-4.7-4.7 0-2.59 2.11-4.7 4.7-4.7 2.59 0 4.7 2.11 4.7 4.7 0 2.59-2.11 4.7-4.7 4.7z" />
	</svg>
	<input
		type="text"
		{placeholder}
		value={value}
		oninput={handleInput}
	/>
	{#if value}
		<button class="clear-btn" onclick={handleClear}>✕</button>
	{/if}
</div>

<style>
	.search-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background-color: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 4px;
	}

	.search-bar:focus-within {
		border-color: var(--color-accent);
	}

	.search-icon {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--color-text-primary);
		font-size: 12px;
		min-width: 0;
	}

	input::placeholder {
		color: var(--color-text-muted);
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: 11px;
		padding: 0 2px;
		flex-shrink: 0;
	}

	.clear-btn:hover {
		color: var(--color-text-primary);
	}
</style>
