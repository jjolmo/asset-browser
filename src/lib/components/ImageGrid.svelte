<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { libraryStore } from '$lib/stores/library.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { customActionsStore } from '$lib/stores/customActions.svelte';
	import { thumbUrl } from '$lib/thumbUrl';
	import SearchBar from './SearchBar.svelte';
	import type { ImageEntry, SortBy, ViewMode } from '$lib/types';

	let gridContainer: HTMLDivElement;
	let containerWidth = $state(0);
	let viewHeight = $state(0);
	let scrollTop = $state(0);
	let cellSize = $state(160);
	let viewMode = $state<ViewMode>('grid');

	const GAP = 4;
	const CELL_OVERHEAD = 44;
	const LIST_ROW_HEIGHT = 32;
	const CELL_EXTRA = 16; // padding(8) + border(4) + gap(4)
	// Rows rendered above and below the viewport, so a fast flick doesn't hit blank space
	const OVERSCAN_ROWS = 3;

	let transparencyBg = $derived(settingsStore.getSetting('transparency_bg') || 'checkerboard');
	let thumbBgStyle = $derived.by(() => {
		switch (transparencyBg) {
			case 'black': return 'background-color: #000;';
			case 'white': return 'background-color: #fff;';
			case 'dark': return 'background-color: #1a1a1a;';
			case 'checkerboard':
			default:
				return 'background-color: #1a1a1a; background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%); background-size: 10px 10px; background-position: 0 0, 0 5px, 5px -5px, -5px 0px;';
		}
	});

	// Computed layout
	let cols = $derived(
		viewMode === 'list'
			? 1
			: Math.max(1, Math.floor((containerWidth - 16) / (cellSize + CELL_EXTRA)))
	);
	// Fixed column width: distribute available space evenly among cols
	let colWidth = $derived(
		cols > 0 ? Math.floor((containerWidth - 16 - (cols - 1) * GAP) / cols) : cellSize + 12
	);
	let rowHeight = $derived(viewMode === 'list' ? LIST_ROW_HEIGHT : colWidth + CELL_OVERHEAD);
	let totalItems = $derived(libraryStore.folderImages.length);
	let totalRows = $derived(Math.ceil(totalItems / Math.max(1, cols)));
	let totalHeight = $derived(totalRows * rowHeight);

	// Visible range
	let firstVisibleRow = $derived(Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS));
	let lastVisibleRow = $derived(
		Math.min(totalRows - 1, Math.ceil((scrollTop + viewHeight) / rowHeight) + OVERSCAN_ROWS)
	);
	let visibleStartIndex = $derived(viewHeight === 0 ? 0 : firstVisibleRow * cols);
	let visibleEndIndex = $derived(
		viewHeight === 0
			? Math.min(totalItems, 60)
			: Math.min(totalItems, (lastVisibleRow + 1) * cols)
	);
	let offsetY = $derived(viewHeight === 0 ? 0 : firstVisibleRow * rowHeight);
	let visibleItems = $derived(libraryStore.folderImages.slice(visibleStartIndex, visibleEndIndex));

	// Reset scroll when folder/images change
	$effect(() => {
		libraryStore.folderImages;
		if (gridContainer) {
			gridContainer.scrollTop = 0;
			scrollTop = 0;
		}
	});

	// Scroll fires far more often than once per frame; coalescing into rAF keeps the
	// virtualization from recomputing several times for the same painted frame.
	let scrollRaf = 0;

	function handleScroll() {
		if (!gridContainer || scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			if (!gridContainer) return;
			scrollTop = gridContainer.scrollTop;
			viewHeight = gridContainer.clientHeight;
		});
	}

	function handleWheel(e: WheelEvent) {
		if (e.ctrlKey) {
			e.preventDefault();
			const delta = e.deltaY > 0 ? -20 : 20;
			cellSize = Math.max(60, Math.min(400, cellSize + delta));
			settingsStore.setSetting('cell_size', String(cellSize));
		}
	}

	/**
	 * Flags the thumbnail's container once the image has actually painted, so the
	 * spinner can be taken away and the image faded in.
	 *
	 * Checking `complete` up front matters: an image served from the webview's
	 * cache can finish before any load listener is attached, and relying on the
	 * event alone left those cells spinning forever.
	 */
	function thumbReady(node: HTMLImageElement) {
		const mark = () => node.parentElement?.classList.add('thumb-ready');
		if (node.complete && node.naturalWidth > 0) {
			mark();
		} else {
			node.addEventListener('load', mark, { once: true });
		}
	}

	function handleImageClick(image: ImageEntry) {
		libraryStore.selectImage(image);
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
			day: '2-digit'
		});
	}

	function handleSort(by: SortBy) {
		libraryStore.setSort(by);
	}

	function setViewMode(mode: ViewMode) {
		viewMode = mode;
		settingsStore.setSetting('view_mode', mode);
	}

	// Context menu
	let contextMenu = $state<{ x: number; y: number; image: ImageEntry } | null>(null);

	function handleContextMenu(e: MouseEvent, image: ImageEntry) {
		e.preventDefault();
		contextMenu = { x: e.clientX, y: e.clientY, image };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function openContainingFolder(path: string) {
		invoke('open_containing_folder', { path }).catch(console.error);
		closeContextMenu();
	}

	function runCustomAction(command: string, path: string) {
		invoke('run_custom_command', { command, path }).catch(console.error);
		closeContextMenu();
	}

	function toggleFileFavorite(path: string) {
		libraryStore.toggleFavoriteFile(path);
		closeContextMenu();
	}

	// Track Ctrl key to show favorite stars
	let ctrlDown = $state(false);

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Control') ctrlDown = true;

		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
		// Don't steal the arrows from text fields, the context menu or the settings dialog
		if (isTypingTarget(e.target)) return;
		if (contextMenu || document.querySelector('.settings-overlay')) return;

		e.preventDefault();
		navigateImages(e.key === 'ArrowRight' ? 1 : -1);
	}

	function isTypingTarget(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		if (!el || !el.tagName) return false;
		const tag = el.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
	}

	// The grid is virtualized, so scrollIntoView() is not an option: compute the row instead
	function scrollIndexIntoView(index: number) {
		if (!gridContainer) return;
		const top = Math.floor(index / Math.max(1, cols)) * rowHeight;
		const bottom = top + rowHeight;
		if (top < gridContainer.scrollTop) {
			gridContainer.scrollTop = top;
		} else if (bottom > gridContainer.scrollTop + gridContainer.clientHeight) {
			gridContainer.scrollTop = bottom - gridContainer.clientHeight;
		}
	}

	function navigateImages(delta: number) {
		const index = libraryStore.selectRelative(delta);
		if (index >= 0) scrollIndexIntoView(index);
	}
	function onKeyUp(e: KeyboardEvent) {
		if (e.key === 'Control') ctrlDown = false;
	}
	function onBlur() { ctrlDown = false; }

	function handleStarClick(e: MouseEvent, image: ImageEntry) {
		e.preventDefault();
		e.stopPropagation();
		libraryStore.toggleFavoriteFile(image.path);
	}

	// Breadcrumb
	let currentPath = $derived(libraryStore.selectedFolder || libraryStore.rootPath || '');

	// Size filter popover
	let showSizeFilter = $state(false);
	let sizeFilterActive = $derived(libraryStore.minSizeBytes > 0 || libraryStore.maxSizeBytes > 0);

	// Preset size ranges
	const sizePresets = [
		{ label: 'All sizes', min: 0, max: 0 },
		{ label: '< 1 KB', min: 0, max: 1024 },
		{ label: '1 KB - 10 KB', min: 1024, max: 10240 },
		{ label: '10 KB - 100 KB', min: 10240, max: 102400 },
		{ label: '100 KB - 1 MB', min: 102400, max: 1048576 },
		{ label: '> 1 MB', min: 1048576, max: 0 },
	];

	function applySizePreset(min: number, max: number) {
		libraryStore.minSizeBytes = min;
		libraryStore.maxSizeBytes = max;
		showSizeFilter = false;
	}

	// Resolution filter popover
	let showResFilter = $state(false);
	let resFilterActive = $derived(libraryStore.minResolution > 0 || libraryStore.maxResolution > 0);

	const resPresets = [
		{ label: 'All resolutions', min: 0, max: 0 },
		{ label: '≤ 16px', min: 0, max: 16 },
		{ label: '≤ 32px', min: 0, max: 32 },
		{ label: '≤ 64px', min: 0, max: 64 },
		{ label: '≤ 128px', min: 0, max: 128 },
		{ label: '≤ 256px', min: 0, max: 256 },
		{ label: '> 256px', min: 257, max: 0 },
		{ label: '> 512px', min: 513, max: 0 },
	];

	let customMinRes = $state('');
	let customMaxRes = $state('');

	function applyResPreset(min: number, max: number) {
		libraryStore.minResolution = min;
		libraryStore.maxResolution = max;
		customMinRes = '';
		customMaxRes = '';
		showResFilter = false;
	}

	function applyCustomRes() {
		libraryStore.minResolution = customMinRes ? parseInt(customMinRes, 10) || 0 : 0;
		libraryStore.maxResolution = customMaxRes ? parseInt(customMaxRes, 10) || 0 : 0;
		showResFilter = false;
	}

	onMount(() => {
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', onBlur);
		const savedCellSize = settingsStore.getSetting('cell_size');
		if (savedCellSize) {
			const s = parseInt(savedCellSize, 10);
			if (s >= 60 && s <= 400) cellSize = s;
		}
		const savedViewMode = settingsStore.getSetting('view_mode');
		if (savedViewMode === 'list' || savedViewMode === 'grid') {
			viewMode = savedViewMode;
		}

		if (gridContainer) {
			containerWidth = gridContainer.clientWidth;
			viewHeight = gridContainer.clientHeight;
			gridContainer.addEventListener('wheel', handleWheel, { passive: false });
		}

		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
				viewHeight = entry.contentRect.height;
			}
		});
		if (gridContainer) ro.observe(gridContainer);

		return () => {
			ro.disconnect();
			if (scrollRaf) cancelAnimationFrame(scrollRaf);
			gridContainer?.removeEventListener('wheel', handleWheel);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', onBlur);
		};
	});
</script>

<div class="image-grid-container">
	<!-- Toolbar -->
	<div class="grid-toolbar">
		<div class="toolbar-left">
			<span class="result-count">
				{libraryStore.displayCount} asset{libraryStore.displayCount !== 1 ? 's' : ''}
				{#if libraryStore.selectedFolder}
					in folder
				{/if}
			</span>
		</div>
		<div class="toolbar-center">
			<SearchBar
				bind:value={libraryStore.filterSearch}
				placeholder="Filter current view..."
			/>
		</div>
		<div class="toolbar-right">
			<button
				class="filter-btn"
				class:active={libraryStore.recursiveView}
				onclick={() => libraryStore.setRecursiveView(!libraryStore.recursiveView)}
				title="Include subfolders recursively"
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path d="M2 2h4v1H3v3H2V2zm12 0h-4v1h3v3h1V2zM2 14h4v-1H3v-3H2v4zm12 0h-4v-1h3v-3h1v4zM5 6h6v4H5V6z"/>
				</svg>
				<span>Recursive</span>
			</button>
			<div class="size-filter-wrapper">
				<button
					class="filter-btn"
					class:active={sizeFilterActive}
					onclick={() => showSizeFilter = !showSizeFilter}
					title="Filter by file size"
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M1 2h14v2H1V2zm2 4h10v2H3V6zm2 4h6v2H5v-2z" />
					</svg>
					{#if sizeFilterActive}
						<span class="filter-badge"></span>
					{/if}
				</button>
				{#if showSizeFilter}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="size-filter-backdrop" onclick={() => showSizeFilter = false}></div>
					<div class="size-filter-popover">
						<span class="popover-title">Filter by size</span>
						{#each sizePresets as preset}
							<button
								class="preset-btn"
								class:active={libraryStore.minSizeBytes === preset.min && libraryStore.maxSizeBytes === preset.max}
								onclick={() => applySizePreset(preset.min, preset.max)}
							>
								{preset.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<div class="size-filter-wrapper">
				<button
					class="filter-btn"
					class:active={resFilterActive}
					onclick={() => showResFilter = !showResFilter}
					title="Filter by resolution"
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M1 1h14v14H1V1zm1 1v12h12V2H2zm1 1h4v4H3V3zm6 0h4v4H9V3zM3 9h4v4H3V9z" />
					</svg>
					{#if resFilterActive}
						<span class="filter-badge"></span>
					{/if}
				</button>
				{#if showResFilter}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="size-filter-backdrop" onclick={() => showResFilter = false}></div>
					<div class="size-filter-popover">
						<span class="popover-title">Filter by resolution</span>
						{#each resPresets as preset}
							<button
								class="preset-btn"
								class:active={libraryStore.minResolution === preset.min && libraryStore.maxResolution === preset.max}
								onclick={() => applyResPreset(preset.min, preset.max)}
							>
								{preset.label}
							</button>
						{/each}
						<div class="custom-res-separator"></div>
						<div class="custom-res-row">
							<input
								type="number"
								class="custom-res-input"
								placeholder="Min"
								min="0"
								bind:value={customMinRes}
								onkeydown={(e) => e.key === 'Enter' && applyCustomRes()}
							/>
							<span class="custom-res-dash">—</span>
							<input
								type="number"
								class="custom-res-input"
								placeholder="Max"
								min="0"
								bind:value={customMaxRes}
								onkeydown={(e) => e.key === 'Enter' && applyCustomRes()}
							/>
							<span class="custom-res-unit">px</span>
						</div>
						<button class="preset-btn custom-apply-btn" onclick={applyCustomRes}>
							Apply
						</button>
					</div>
				{/if}
			</div>
			<div class="view-toggle">
				<button
					class="view-btn"
					class:active={viewMode === 'grid'}
					onclick={() => setViewMode('grid')}
					title="Grid view"
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z" />
					</svg>
				</button>
				<button
					class="view-btn"
					class:active={viewMode === 'list'}
					onclick={() => setViewMode('list')}
					title="List view"
				>
					<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
						<path d="M1 1h14v2H1V1zm0 4h14v2H1V5zm0 4h14v2H1V9zm0 4h14v2H1v-2z" />
					</svg>
				</button>
			</div>
			<div class="sort-controls">
				<span class="sort-label">Sort:</span>
				<button
					class="sort-btn"
					class:active={libraryStore.sortBy === 'path'}
					onclick={() => handleSort('path')}
				>
					Path {#if libraryStore.sortBy === 'path'}{libraryStore.sortDirection === 'asc' ? '↑' : '↓'}{/if}
				</button>
				<button
					class="sort-btn"
					class:active={libraryStore.sortBy === 'name'}
					onclick={() => handleSort('name')}
				>
					Name {#if libraryStore.sortBy === 'name'}{libraryStore.sortDirection === 'asc' ? '↑' : '↓'}{/if}
				</button>
				<button
					class="sort-btn"
					class:active={libraryStore.sortBy === 'size'}
					onclick={() => handleSort('size')}
				>
					Size {#if libraryStore.sortBy === 'size'}{libraryStore.sortDirection === 'asc' ? '↑' : '↓'}{/if}
				</button>
				<button
					class="sort-btn"
					class:active={libraryStore.sortBy === 'modified'}
					onclick={() => handleSort('modified')}
				>
					Date {#if libraryStore.sortBy === 'modified'}{libraryStore.sortDirection === 'asc' ? '↑' : '↓'}{/if}
				</button>
				<button
					class="sort-btn"
					class:active={libraryStore.sortBy === 'extension'}
					onclick={() => handleSort('extension')}
				>
					Type {#if libraryStore.sortBy === 'extension'}{libraryStore.sortDirection === 'asc' ? '↑' : '↓'}{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Breadcrumb -->
	{#if currentPath}
		<div class="breadcrumb-bar">
			<span class="breadcrumb-path" title={currentPath}>{currentPath}</span>
			<button
				class="breadcrumb-open"
				onclick={() => openContainingFolder(currentPath)}
				title="Open in file manager"
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Content -->
	<div class="grid-scroll" bind:this={gridContainer} onscroll={handleScroll}>
		{#if totalItems === 0}
			<div class="empty-grid">
				{#if libraryStore.globalSearch || libraryStore.filterSearch}
					<p>No assets match your search</p>
				{:else if libraryStore.rootPath}
					<p>No images in this folder</p>
				{:else}
					<p>Open a folder to start browsing</p>
				{/if}
			</div>
		{:else if viewMode === 'grid'}
			<div class="virtual-spacer" style="height: {totalHeight}px;">
				<div
					class="grid"
					style="transform: translateY({offsetY}px); grid-template-columns: repeat({cols}, {colWidth}px);"
				>
					{#each visibleItems as image (image.path)}
						<button
							class="grid-cell"
							class:selected={libraryStore.selectedImage?.path === image.path}
							onclick={() => handleImageClick(image)}
							oncontextmenu={(e) => handleContextMenu(e, image)}
						>
							{#if ctrlDown || libraryStore.isFileFavorite(image.path)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="fav-star-btn"
									class:active={libraryStore.isFileFavorite(image.path)}
									onclick={(e) => handleStarClick(e, image)}
									oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
									title={libraryStore.isFileFavorite(image.path) ? 'Remove from favorites' : 'Add to favorites'}
								>
									<svg width="16" height="16" viewBox="0 0 16 16">
										<path d="M8 1l2.163 4.382 4.837.703-3.5 3.412.827 4.823L8 12.027l-4.327 2.293.827-4.823L1 5.085l4.837-.703L8 1z"/>
									</svg>
								</span>
							{/if}
							<div class="cell-thumb" style={thumbBgStyle}>
								{#if image.extension === 'svg'}
									<img
										src={'asset://localhost/' + image.path}
										alt={image.name}
									/>
								{:else if !libraryStore.failedThumbs.has(image.path)}
									<span class="thumb-spinner"></span>
									<img
										class="thumb-img"
										src={thumbUrl(image)}
										alt={image.name}
										decoding="async"
										use:thumbReady
										onerror={() => libraryStore.markThumbFailed(image.path)}
									/>
								{:else}
									<div class="thumb-placeholder">
										<span class="ext-label">.{image.extension}</span>
									</div>
								{/if}
							</div>
							<div class="cell-info">
								<span class="cell-name" title={image.name}>{image.name}</span>
								<span class="cell-size">{formatSize(image.size_bytes)}</span>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<!-- List view -->
			<div class="virtual-spacer" style="height: {totalHeight}px;">
				<div class="list" style="transform: translateY({offsetY}px);">
					{#each visibleItems as image (image.path)}
						<button
							class="list-row"
							class:selected={libraryStore.selectedImage?.path === image.path}
							onclick={() => handleImageClick(image)}
							oncontextmenu={(e) => handleContextMenu(e, image)}
						>
							{#if ctrlDown || libraryStore.isFileFavorite(image.path)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span
									class="fav-star-btn list-star"
									class:active={libraryStore.isFileFavorite(image.path)}
									onclick={(e) => handleStarClick(e, image)}
									oncontextmenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
									title={libraryStore.isFileFavorite(image.path) ? 'Remove from favorites' : 'Add to favorites'}
								>
									<svg width="14" height="14" viewBox="0 0 16 16">
										<path d="M8 1l2.163 4.382 4.837.703-3.5 3.412.827 4.823L8 12.027l-4.327 2.293.827-4.823L1 5.085l4.837-.703L8 1z"/>
									</svg>
								</span>
							{/if}
							<span class="list-col-thumb">
								{#if image.extension === 'svg'}
									<img src={'asset://localhost/' + image.path} alt="" class="list-thumb-img" />
								{:else if !libraryStore.failedThumbs.has(image.path)}
									<span class="thumb-spinner list-spinner"></span>
									<img
										src={thumbUrl(image)}
										alt=""
										class="list-thumb-img thumb-img"
										decoding="async"
										use:thumbReady
										onerror={() => libraryStore.markThumbFailed(image.path)}
									/>
								{:else}
									<span class="list-ext-icon">.{image.extension}</span>
								{/if}
							</span>
							<span class="list-col-name" title={image.name}>{image.name}</span>
							<span class="list-col-ext">{image.extension.toUpperCase()}</span>
							<span class="list-col-size">{formatSize(image.size_bytes)}</span>
							<span class="list-col-date">{formatDate(image.modified)}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Context menu -->
{#if contextMenu}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="context-overlay" onclick={closeContextMenu} oncontextmenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
		<div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
			<button class="context-item" onclick={() => toggleFileFavorite(contextMenu!.image.path)}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill={libraryStore.isFileFavorite(contextMenu!.image.path) ? '#f5c518' : 'currentColor'}>
					<path d="M8 1l2.163 4.382 4.837.703-3.5 3.412.827 4.823L8 12.027l-4.327 2.293.827-4.823L1 5.085l4.837-.703L8 1z"/>
				</svg>
				{libraryStore.isFileFavorite(contextMenu!.image.path) ? 'Remove from favorites' : 'Add to favorites'}
			</button>
			<div class="context-separator"></div>
			<button class="context-item" onclick={() => openContainingFolder(contextMenu!.image.path)}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z" />
				</svg>
				Open containing folder
			</button>
			{#if customActionsStore.actions.length > 0}
				<div class="context-separator"></div>
				{#each customActionsStore.actions as action (action.id)}
					<button class="context-item" onclick={() => runCustomAction(action.command, contextMenu!.image.path)}>
						<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
							<path d="M5.5 3l-.5.5v9l.5.5 6-5v-.5l-6-4.5z" />
						</svg>
						{action.title}
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<style>
	.image-grid-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: var(--color-bg-primary);
	}

	.grid-toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--color-border);
		background-color: var(--color-bg-secondary);
		flex-shrink: 0;
	}

	.toolbar-left {
		flex-shrink: 0;
	}

	.toolbar-center {
		flex: 1;
		max-width: 300px;
	}

	.toolbar-right {
		flex-shrink: 0;
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.result-count {
		font-size: 11px;
		color: var(--color-text-secondary);
	}

	/* View toggle */
	.view-toggle {
		display: flex;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		overflow: hidden;
	}

	.view-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		padding: 3px 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.view-btn:hover {
		background-color: var(--color-bg-hover);
	}

	.view-btn.active {
		background-color: var(--color-bg-selected);
		color: var(--color-accent);
	}

	/* Sort controls */
	.sort-controls {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.sort-label {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.sort-btn {
		background: none;
		border: 1px solid transparent;
		color: var(--color-text-secondary);
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 3px;
		cursor: pointer;
	}

	.sort-btn:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.sort-btn.active {
		color: var(--color-accent);
		border-color: var(--color-accent);
	}

	/* Scroll container */
	.grid-scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
	}

	/* Virtual spacer */
	.virtual-spacer {
		position: relative;
		overflow: hidden;
	}

	/* Grid view */
	.grid {
		display: grid;
		gap: 4px;
		padding: 8px;
	}

	.grid-cell {
		display: flex;
		flex-direction: column;
		background: none;
		border: 2px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		padding: 4px;
		transition: border-color 0.1s;
		text-align: left;
		color: var(--color-text-primary);
		position: relative;
	}

	.fav-star-btn {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2px;
		border-radius: 3px;
		background-color: rgba(0, 0, 0, 0.5);
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		transition: color 0.1s, background-color 0.1s;
	}

	.fav-star-btn svg {
		fill: currentColor;
	}

	.fav-star-btn:hover {
		color: #f5c518;
		background-color: rgba(0, 0, 0, 0.7);
	}

	.fav-star-btn.active {
		color: #f5c518;
	}

	.fav-star-btn.list-star {
		position: static;
		background: none;
		margin: 0 4px 0 8px;
	}

	.grid-cell:hover {
		background-color: var(--color-bg-hover);
	}

	.grid-cell.selected {
		border-color: var(--color-accent);
		background-color: var(--color-bg-selected);
	}

	.cell-thumb {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: 3px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.cell-thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.thumb-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: var(--color-text-muted);
	}

	.ext-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.cell-info {
		padding: 4px 2px 2px;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.cell-name {
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cell-size {
		font-size: 10px;
		color: var(--color-text-muted);
	}

	/* List view */
	.list {
		display: flex;
		flex-direction: column;
	}

	.list-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 32px;
		padding: 0 12px;
		background: none;
		border: none;
		border-bottom: 1px solid var(--color-border);
		cursor: pointer;
		text-align: left;
		color: var(--color-text-primary);
		font-size: 12px;
		flex-shrink: 0;
	}

	.list-row:hover {
		background-color: var(--color-bg-hover);
	}

	.list-row.selected {
		background-color: var(--color-bg-selected);
	}

	.list-col-thumb {
		position: relative;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* The spinner sits behind the image and only becomes visible if the
	   thumbnail takes a moment — a cache hit paints before the delay elapses,
	   so browsing already-cached folders shows no flicker. */
	.thumb-spinner {
		position: absolute;
		width: 16px;
		height: 16px;
		border: 2px solid var(--color-border, #3a3a3a);
		border-top-color: var(--color-accent, #4a9eff);
		border-radius: 50%;
		opacity: 0;
		animation: thumb-spin 0.7s linear infinite, thumb-fade 0.1s linear 0.15s forwards;
	}

	.list-spinner {
		width: 12px;
		height: 12px;
		border-width: 1.5px;
	}

	.thumb-img {
		opacity: 0;
		transition: opacity 0.12s ease-out;
	}

	/* Once the image is painted the spinner has to go, not just be covered:
	   thumbnails with an alpha channel (or smaller than the spinner itself)
	   let it show straight through. */
	.cell-thumb:global(.thumb-ready) .thumb-spinner,
	.list-col-thumb:global(.thumb-ready) .thumb-spinner {
		display: none;
	}

	.cell-thumb:global(.thumb-ready) .thumb-img,
	.list-col-thumb:global(.thumb-ready) .thumb-img {
		opacity: 1;
	}

	@keyframes thumb-spin {
		to { transform: rotate(360deg); }
	}

	@keyframes thumb-fade {
		to { opacity: 1; }
	}

	.list-thumb-img {
		width: 24px;
		height: 24px;
		object-fit: contain;
		border-radius: 2px;
		image-rendering: pixelated;
	}

	.list-ext-icon {
		font-size: 8px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.list-col-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.list-col-ext {
		width: 50px;
		flex-shrink: 0;
		color: var(--color-text-secondary);
		font-size: 11px;
	}

	.list-col-size {
		width: 70px;
		flex-shrink: 0;
		text-align: right;
		color: var(--color-text-secondary);
		font-size: 11px;
	}

	.list-col-date {
		width: 100px;
		flex-shrink: 0;
		text-align: right;
		color: var(--color-text-muted);
		font-size: 11px;
	}

	/* Empty state */
	.empty-grid {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-muted);
		font-size: 13px;
	}

	/* Size filter */
	.size-filter-wrapper {
		position: relative;
	}

	.filter-btn {
		background: none;
		border: 1px solid transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		padding: 3px 6px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		position: relative;
	}

	.filter-btn:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.filter-btn.active {
		color: var(--color-accent);
		border-color: var(--color-accent);
	}

	.filter-badge {
		position: absolute;
		top: 1px;
		right: 1px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--color-accent);
	}

	.size-filter-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.size-filter-popover {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		background-color: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 4px 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		min-width: 160px;
		z-index: 41;
	}

	.popover-title {
		display: block;
		padding: 4px 12px 6px;
		font-size: 11px;
		color: var(--color-text-muted);
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		margin-bottom: 4px;
	}

	.preset-btn {
		display: block;
		width: 100%;
		padding: 5px 12px;
		background: none;
		border: none;
		color: var(--color-text-primary);
		cursor: pointer;
		font-size: 12px;
		text-align: left;
	}

	.preset-btn:hover {
		background-color: var(--color-bg-hover);
	}

	.preset-btn.active {
		color: var(--color-accent);
	}

	/* Custom resolution inputs */
	.custom-res-separator {
		height: 1px;
		background-color: var(--color-border);
		margin: 4px 0;
	}

	.custom-res-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px;
	}

	.custom-res-input {
		width: 56px;
		padding: 3px 6px;
		font-size: 11px;
		background-color: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		color: var(--color-text-primary);
		outline: none;
	}

	.custom-res-input:focus {
		border-color: var(--color-accent);
	}

	.custom-res-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
	}

	.custom-res-dash {
		color: var(--color-text-muted);
		font-size: 11px;
	}

	.custom-res-unit {
		color: var(--color-text-muted);
		font-size: 11px;
	}

	.custom-apply-btn {
		margin-top: 2px;
		color: var(--color-accent) !important;
		font-weight: 500;
	}

	/* Breadcrumb */
	.breadcrumb-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 12px;
		border-bottom: 1px solid var(--color-border);
		background-color: var(--color-bg-secondary);
		flex-shrink: 0;
	}

	.breadcrumb-path {
		flex: 1;
		font-size: 11px;
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.breadcrumb-open {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.breadcrumb-open:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	/* Context menu */
	.context-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.context-menu {
		position: fixed;
		background-color: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 4px 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		min-width: 180px;
	}

	.context-separator {
		height: 1px;
		background-color: var(--color-border);
		margin: 4px 0;
	}

	.context-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		background: none;
		border: none;
		color: var(--color-text-primary);
		cursor: pointer;
		font-size: 12px;
		text-align: left;
	}

	.context-item:hover {
		background-color: var(--color-bg-hover);
	}
</style>
