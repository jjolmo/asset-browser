<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import ImageGrid from '$lib/components/ImageGrid.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import SelectionPanel from '$lib/components/SelectionPanel.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';

	let sidebarWidth = $state(240);
	let previewWidth = $state(280);
	let selectionWidth = $state(220);
	let isDraggingLeft = $state(false);
	let isDraggingRight = $state(false);
	let isDraggingSelection = $state(false);
	let showSettings = $state(false);
	let windowWidth = $state(1400);

	// The grid is the point of the window, so it is the one thing that always
	// keeps room. Side panels are fixed-width and don't shrink on their own,
	// which once let a wide preview squeeze the grid to nothing with no way
	// back except dragging the handle blind.
	const MIN_CENTER = 240;
	const PANEL_MIN = { sidebar: 150, preview: 200, selection: 160 };

	let showSelection = $derived(selectionStore.count > 0);

	/** The widest a panel may be dragged right now, given what else is on screen. */
	function maxWidth(panel: 'sidebar' | 'preview' | 'selection'): number {
		const others =
			(panel === 'sidebar' ? 0 : sidebarWidth) +
			(panel === 'preview' ? 0 : previewWidth) +
			(panel === 'selection' || !showSelection ? 0 : selectionWidth);
		return Math.max(PANEL_MIN[panel], windowWidth - MIN_CENTER - others);
	}

	/**
	 * Widths as actually rendered. Dragging is already capped, so this only has
	 * to catch the window getting narrower: panels give way from the right,
	 * each down to its own minimum, before the grid gives up anything.
	 */
	let laidOut = $derived.by(() => {
		const widths = {
			sidebar: sidebarWidth,
			preview: previewWidth,
			selection: showSelection ? selectionWidth : 0
		};

		let overflow = widths.sidebar + widths.preview + widths.selection + MIN_CENTER - windowWidth;
		for (const panel of ['selection', 'preview', 'sidebar'] as const) {
			if (overflow <= 0) break;
			if (widths[panel] === 0) continue;
			const give = Math.min(overflow, widths[panel] - PANEL_MIN[panel]);
			if (give > 0) {
				widths[panel] -= give;
				overflow -= give;
			}
		}
		return widths;
	});

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
		const savedSelection = settingsStore.getSetting('selection_width');
		if (savedSelection) {
			const w = parseInt(savedSelection, 10);
			if (w >= 160 && w <= 600) selectionWidth = w;
		}
	});

	function startResizeLeft(e: MouseEvent) {
		e.preventDefault();
		isDraggingLeft = true;
		const startX = e.clientX;
		const startWidth = sidebarWidth;

		function onMove(e: MouseEvent) {
			sidebarWidth = Math.max(
				PANEL_MIN.sidebar,
				Math.min(500, maxWidth('sidebar'), startWidth + (e.clientX - startX))
			);
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
			previewWidth = Math.max(
				PANEL_MIN.preview,
				Math.min(1200, maxWidth('preview'), startWidth - (e.clientX - startX))
			);
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

	function startResizeSelection(e: MouseEvent) {
		e.preventDefault();
		isDraggingSelection = true;
		const startX = e.clientX;
		const startWidth = selectionWidth;

		function onMove(e: MouseEvent) {
			selectionWidth = Math.max(
				PANEL_MIN.selection,
				Math.min(600, maxWidth('selection'), startWidth - (e.clientX - startX))
			);
		}

		function onUp() {
			isDraggingSelection = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			settingsStore.setSetting('selection_width', String(selectionWidth));
		}

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="app-layout">
	<div class="app-main">
		<!-- Left: Sidebar with folder tree -->
		<div class="panel-left" style="width: {laidOut.sidebar}px; flex-shrink: 0;">
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
		<div class="panel-right" style="width: {laidOut.preview}px; flex-shrink: 0;">
			<ImagePreview />
		</div>

		<!-- Far right: the hand-picked selection. Appears only once something is
		     in it, so the layout is untouched until the pile is actually used. -->
		{#if showSelection}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="resize-handle"
				class:active={isDraggingSelection}
				onmousedown={startResizeSelection}
			></div>
			<div class="panel-right" style="width: {laidOut.selection}px; flex-shrink: 0;">
				<SelectionPanel />
			</div>
		{/if}
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
