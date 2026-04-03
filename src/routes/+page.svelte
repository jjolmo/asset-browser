<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ImageGrid from '$lib/components/ImageGrid.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	let sidebarWidth = $state(240);
	let previewWidth = $state(280);
	let isDraggingLeft = $state(false);
	let isDraggingRight = $state(false);
	let showSettings = $state(false);

	onMount(() => {
		const savedSidebar = settingsStore.getSetting('sidebar_width');
		if (savedSidebar) {
			const w = parseInt(savedSidebar, 10);
			if (w >= 150 && w <= 500) sidebarWidth = w;
		}
		const savedPreview = settingsStore.getSetting('preview_width');
		if (savedPreview) {
			const w = parseInt(savedPreview, 10);
			if (w >= 200 && w <= 1200) previewWidth = w;
		}
	});

	function startResizeLeft(e: MouseEvent) {
		e.preventDefault();
		isDraggingLeft = true;
		const startX = e.clientX;
		const startWidth = sidebarWidth;

		function onMove(e: MouseEvent) {
			sidebarWidth = Math.max(150, Math.min(500, startWidth + (e.clientX - startX)));
		}

		function onUp() {
			isDraggingLeft = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			settingsStore.setSetting('sidebar_width', String(sidebarWidth));
		}

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function startResizeRight(e: MouseEvent) {
		e.preventDefault();
		isDraggingRight = true;
		const startX = e.clientX;
		const startWidth = previewWidth;

		function onMove(e: MouseEvent) {
			previewWidth = Math.max(200, Math.min(1200, startWidth - (e.clientX - startX)));
		}

		function onUp() {
			isDraggingRight = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			settingsStore.setSetting('preview_width', String(previewWidth));
		}

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}
</script>

<div class="app-layout">
	<div class="app-main">
		<!-- Left: Sidebar with folder tree -->
		<div class="panel-left" style="width: {sidebarWidth}px; min-width: 150px; max-width: 500px; flex-shrink: 0;">
			<Sidebar />
			<div class="sidebar-footer">
				<button class="settings-btn" onclick={() => showSettings = true} title="Settings">
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.8 1.3-2-.8-.8-2 1.3-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.4v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.4-2.4h2.8zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Resize handle (left) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="resize-handle"
			class:active={isDraggingLeft}
			onmousedown={startResizeLeft}
		></div>

		<!-- Center: Image grid -->
		<div class="panel-center">
			<ImageGrid />
		</div>

		<!-- Resize handle (right) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="resize-handle"
			class:active={isDraggingRight}
			onmousedown={startResizeRight}
		></div>

		<!-- Right: Image preview -->
		<div class="panel-right" style="width: {previewWidth}px; min-width: 200px; max-width: 1200px; flex-shrink: 0;">
			<ImagePreview />
		</div>
	</div>
</div>

{#if showSettings}
	<SettingsPanel onclose={() => showSettings = false} />
{/if}

<style>
	.app-layout {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: var(--color-bg-primary);
	}

	.app-main {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.panel-center {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.resize-handle {
		width: 4px;
		cursor: col-resize;
		background: transparent;
		flex-shrink: 0;
		position: relative;
		z-index: 10;
		margin-left: -2px;
		margin-right: -2px;
	}

	.resize-handle:hover,
	.resize-handle.active {
		background-color: var(--color-accent, #4a9eff);
		opacity: 0.5;
	}

	.resize-handle.active {
		opacity: 0.8;
	}

	.panel-left {
		display: flex;
		flex-direction: column;
	}

	.sidebar-footer {
		flex-shrink: 0;
		padding: 4px 8px;
		border-top: 1px solid var(--color-border);
		background-color: var(--color-bg-secondary);
	}

	.settings-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 4px 6px;
		border-radius: 4px;
		display: flex;
		align-items: center;
	}

	.settings-btn:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}
</style>
