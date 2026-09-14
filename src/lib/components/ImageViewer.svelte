<script lang="ts">
	import { libraryStore } from '$lib/stores/library.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { viewerStore } from '$lib/stores/viewer.svelte';
	import { fullImage } from '$lib/fullImage';
	import { viewerBackground } from '$lib/backgrounds';

	let src = $state<string | null>(null);
	let loading = $state(false);
	let failed = $state(false);
	let lastPath = $state<string | null>(null);

	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let panStart = { x: 0, y: 0 };
	let stage = $state<HTMLDivElement>(null!);

	let image = $derived(libraryStore.selectedImage);
	let position = $derived.by(() => {
		const current = image;
		if (!current) return null;
		const index = libraryStore.folderImages.findIndex((i) => i.path === current.path);
		return index === -1 ? null : { index: index + 1, total: libraryStore.folderImages.length };
	});

	let bgStyle = $derived(viewerBackground());

	// The selection moves under the viewer — arrow keys, walking folders,
	// clicking the grid before it opened — so the image follows it rather than
	// being handed in once.
	$effect(() => {
		const current = image;
		if (!current) {
			src = null;
			lastPath = null;
			return;
		}
		if (current.path === lastPath) return;

		lastPath = current.path;
		loading = true;
		failed = false;
		src = null;
		zoom = 1;
		panX = 0;
		panY = 0;

		fullImage(current.path)
			.then((data) => {
				if (lastPath !== current.path) return;
				src = data;
				loading = false;
			})
			.catch(() => {
				if (lastPath !== current.path) return;
				failed = true;
				loading = false;
			});
	});

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		const next = Math.max(0.1, Math.min(40, zoom * factor));

		// Keep whatever is under the cursor under the cursor.
		if (stage) {
			const rect = stage.getBoundingClientRect();
			const mx = e.clientX - rect.left - rect.width / 2;
			const my = e.clientY - rect.top - rect.height / 2;
			const scale = next / zoom;
			panX = mx - scale * (mx - panX);
			panY = my - scale * (my - panY);
		}

		zoom = next;
	}

	function handlePanStart(e: MouseEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		isPanning = true;
		panStart = { x: e.clientX - panX, y: e.clientY - panY };
	}

	function handlePanMove(e: MouseEvent) {
		if (!isPanning) return;
		panX = e.clientX - panStart.x;
		panY = e.clientY - panStart.y;
	}

	function handlePanEnd() {
		isPanning = false;
	}

	/**
	 * Double-click closes, mirroring the double-click that opened it. Resetting
	 * the zoom would be the other candidate, but the gesture that opens a thing
	 * is the one people try first to get back out.
	 */
	function handleDblClick() {
		viewerStore.close();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			viewerStore.close();
			return;
		}
		// '0' restores the fit, since double-click is spent on closing.
		if (e.key === '0') {
			e.preventDefault();
			zoom = 1;
			panX = 0;
			panY = 0;
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<svelte:window onkeydown={onKeyDown} onmouseup={handlePanEnd} onmousemove={handlePanMove} />

<div class="viewer">
	<div class="viewer-bar">
		<span class="viewer-name" title={image?.path}>{image?.name ?? ''}</span>
		<span class="viewer-meta">
			{#if image}
				{image.width > 0 ? `${image.width}×${image.height}` : image.extension.toUpperCase()}
				· {formatSize(image.size_bytes)}
			{/if}
			{#if position}
				· {position.index} / {position.total}
			{/if}
			{#if zoom !== 1}
				· {Math.round(zoom * 100)}%
			{/if}
		</span>
		<button class="viewer-close" onclick={() => viewerStore.close()} title="Close (Esc)">
			<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 6.94L13.06 1.88 14.12 2.94 9.06 8l5.06 5.06-1.06 1.06L8 9.06l-5.06 5.06-1.06-1.06L6.94 8 1.88 2.94 2.94 1.88 8 6.94z"/>
			</svg>
		</button>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="viewer-stage"
		style={bgStyle}
		bind:this={stage}
		onwheel={handleWheel}
		onmousedown={handlePanStart}
		ondblclick={handleDblClick}
		class:panning={isPanning}
	>
		{#if !image}
			<span class="viewer-note">No image selected</span>
		{:else if loading}
			<span class="viewer-note">Loading…</span>
		{:else if failed}
			<span class="viewer-note">This file could not be opened</span>
		{:else if src}
			<img
				class="viewer-img"
				{src}
				alt={image.name}
				draggable="false"
				style="transform: translate({panX}px, {panY}px) scale({zoom});"
			/>
		{/if}
	</div>

	<div class="viewer-hint">← → move · Space favorites · 0 fits · Esc closes</div>
</div>

<style>
	.viewer {
		position: fixed;
		inset: 0;
		z-index: 400;
		display: flex;
		flex-direction: column;
		background-color: var(--color-bg-primary);
	}

	.viewer-bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 5px 8px 5px 12px;
		border-bottom: 1px solid var(--color-border);
		background-color: var(--color-bg-secondary);
	}

	.viewer-name {
		font-size: 12px;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.viewer-meta {
		font-size: 11px;
		color: var(--color-text-secondary);
		white-space: nowrap;
		margin-right: auto;
	}

	.viewer-close {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-text-secondary);
		padding: 4px 6px;
		border-radius: 3px;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.viewer-close:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.viewer-stage {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: grab;
	}

	.viewer-stage.panning {
		cursor: grabbing;
	}

	.viewer-img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		transform-origin: center center;
		will-change: transform;
		image-rendering: pixelated;
	}

	.viewer-note {
		font-size: 12px;
		color: var(--color-text-secondary);
	}

	.viewer-hint {
		flex-shrink: 0;
		padding: 4px 12px;
		font-size: 10px;
		color: var(--color-text-muted);
		border-top: 1px solid var(--color-border);
		background-color: var(--color-bg-secondary);
	}
</style>
