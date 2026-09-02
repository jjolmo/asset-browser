<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { libraryStore } from '$lib/stores/library.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	// The settings cache is reactive, so this needs no local copy to stay in sync.
	let metaCollapsed = $derived(settingsStore.getSetting('meta_collapsed') === '1');

	function toggleMeta() {
		settingsStore.setSetting('meta_collapsed', metaCollapsed ? '0' : '1');
	}

	let previewSrc = $state<string | null>(null);
	let dimensions = $state<{ w: number; h: number } | null>(null);
	let loading = $state(false);
	let lastPath = $state<string | null>(null);

	// Zoom & pan
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let panStart = { x: 0, y: 0 };
	let imageContainer = $state<HTMLDivElement>(null!);

	let transparencyBg = $derived(settingsStore.getSetting('transparency_bg') || 'checkerboard');

	let bgStyle = $derived.by(() => {
		switch (transparencyBg) {
			case 'black': return 'background-color: #000000;';
			case 'white': return 'background-color: #ffffff;';
			case 'dark': return 'background-color: #1a1a1a;';
			case 'checkerboard':
			default:
				return `background-color: #1a1a1a; background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px;`;
		}
	});

	$effect(() => {
		const image = libraryStore.selectedImage;
		if (!image) {
			previewSrc = null;
			dimensions = null;
			lastPath = null;
			return;
		}
		if (image.path === lastPath) return;
		lastPath = image.path;
		loading = true;
		previewSrc = null;
		dimensions = null;
		zoom = 1;
		panX = 0;
		panY = 0;

		Promise.all([
			invoke<string>('get_image_base64', { path: image.path }),
			invoke<[number, number]>('get_image_dimensions', { path: image.path }),
		])
			.then(([src, [w, h]]) => {
				if (lastPath === image.path) {
					previewSrc = src;
					dimensions = { w, h };
					loading = false;
				}
			})
			.catch(() => {
				loading = false;
			});
	});

	function handlePreviewWheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		const newZoom = Math.max(0.5, Math.min(20, zoom * factor));

		if (imageContainer) {
			const rect = imageContainer.getBoundingClientRect();
			const mx = e.clientX - rect.left - rect.width / 2;
			const my = e.clientY - rect.top - rect.height / 2;
			const scale = newZoom / zoom;
			panX = mx - scale * (mx - panX);
			panY = my - scale * (my - panY);
		}

		zoom = newZoom;
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

	function handleDblClick() {
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(ts: number): string {
		return new Date(ts * 1000).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	// Re-attach wheel listener whenever imageContainer changes (re-renders on selection)
	$effect(() => {
		const container = imageContainer;
		if (!container) return;
		container.addEventListener('wheel', handlePreviewWheel, { passive: false });
		return () => {
			container.removeEventListener('wheel', handlePreviewWheel);
		};
	});

	onMount(() => {
		function onMouseMove(e: MouseEvent) {
			handlePanMove(e);
		}
		function onMouseUp() {
			handlePanEnd();
		}
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);

		return () => {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};
	});
</script>

<div class="preview-panel">
	{#if libraryStore.selectedImage}
		{@const image = libraryStore.selectedImage}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="preview-image-container"
			bind:this={imageContainer}
			onmousedown={handlePanStart}
			ondblclick={handleDblClick}
			style={bgStyle}
		>
			{#if loading}
				<div class="preview-loading">
					<svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" class="spin">
						<path d="M8 1a7 7 0 00-7 7h2a5 5 0 015-5V1z" />
					</svg>
				</div>
			{:else if previewSrc}
				<img
					src={previewSrc}
					alt={image.name}
					class="preview-image"
					style="transform: translate({panX}px, {panY}px) scale({zoom}); cursor: {isPanning ? 'grabbing' : 'grab'};"
					draggable="false"
				/>
			{:else}
				<div class="preview-placeholder">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.2">
						<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
					</svg>
				</div>
			{/if}

			{#if zoom !== 1}
				<div class="zoom-indicator">{Math.round(zoom * 100)}%</div>
			{/if}
		</div>

		<div class="preview-meta">
			<button
				class="meta-header"
				onclick={toggleMeta}
				title={metaCollapsed ? 'Show details' : 'Hide details'}
				aria-expanded={!metaCollapsed}
			>
				<svg
					width="10"
					height="10"
					viewBox="0 0 16 16"
					fill="currentColor"
					class="meta-chevron"
					class:open={!metaCollapsed}
				>
					<path d="M6 4l4 4-4 4V4z" />
				</svg>
				<span class="meta-filename" title={image.name}>{image.name}</span>
			</button>
			{#if !metaCollapsed}
			<div class="meta-grid">
				<span class="meta-label">Type</span>
				<span class="meta-value">{image.extension.toUpperCase()}</span>

				<span class="meta-label">Size</span>
				<span class="meta-value">{formatSize(image.size_bytes)}</span>

				{#if dimensions && dimensions.w > 0}
					<span class="meta-label">Dimensions</span>
					<span class="meta-value">{dimensions.w} x {dimensions.h}</span>
				{/if}

				<span class="meta-label">Modified</span>
				<span class="meta-value">{formatDate(image.modified)}</span>

				<span class="meta-label">Path</span>
				<span class="meta-value meta-path" title={image.path}>{image.path}</span>
			</div>
			{/if}
		</div>
	{:else}
		<div class="no-selection">
			<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.15">
				<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
			</svg>
			<p>Select an image to preview</p>
		</div>
	{/if}
</div>

<style>
	.preview-panel {
		width: 100%;
		height: 100%;
		background-color: var(--color-bg-secondary);
		border-left: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.preview-image-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		min-height: 0;
		overflow: hidden;
		position: relative;
		user-select: none;
	}

	.preview-image {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: 2px;
		transform-origin: center center;
		will-change: transform;
		image-rendering: pixelated;
	}

	.zoom-indicator {
		position: absolute;
		bottom: 8px;
		right: 8px;
		background-color: rgba(0, 0, 0, 0.6);
		color: white;
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 3px;
		pointer-events: none;
	}

	.preview-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.preview-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}

	.preview-meta {
		flex-shrink: 0;
		padding: 12px;
		border-top: 1px solid var(--color-border);
		overflow-y: auto;
		max-height: 40%;
	}

	/* The header stays put when the details fold away: collapsing the panel
	   entirely would leave nothing to click to bring it back. */
	.meta-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
	}

	.meta-chevron {
		flex-shrink: 0;
		color: var(--color-text-muted);
		transition: transform 0.12s ease-out;
	}

	.meta-chevron.open {
		transform: rotate(90deg);
	}

	.meta-header:hover .meta-chevron {
		color: var(--color-text-primary);
	}

	.meta-filename {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta-grid {
		margin-top: 10px;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		font-size: 12px;
	}

	.meta-label {
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.meta-value {
		color: var(--color-text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta-path {
		font-size: 10px;
		font-family: var(--font-mono);
	}

	.no-selection {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 12px;
		color: var(--color-text-muted);
		font-size: 13px;
	}
</style>
