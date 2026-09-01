<script lang="ts">
	import type { FolderNode } from '$lib/types';
	import { invoke } from '@tauri-apps/api/core';
	import { libraryStore } from '$lib/stores/library.svelte';
	import FolderTree from './FolderTree.svelte';

	let { node, depth = 0 }: { node: FolderNode; depth?: number } = $props();

	let contextMenu = $state<{ x: number; y: number } | null>(null);
	let isMuted = $derived(libraryStore.isFolderMuted(node.path));
	let isFavorite = $derived(libraryStore.isFolderFavorite(node.path));

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		contextMenu = { x: e.clientX, y: e.clientY };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function openInFileManager() {
		invoke('open_containing_folder', { path: node.path }).catch(console.error);
		closeContextMenu();
	}

	function toggleMute() {
		if (isMuted) {
			libraryStore.unmuteFolder(node.path);
		} else {
			libraryStore.muteFolder(node.path);
		}
		closeContextMenu();
	}

	function toggleFavorite() {
		libraryStore.toggleFavoriteFolder(node.path);
		closeContextMenu();
	}

	let expanded = $state(depth === 0);
	let isSelected = $derived(libraryStore.selectedFolder === node.path);
	let isHighlighted = $derived(libraryStore.highlightedFolder === node.path);

	// Plain variable, not $state: the effect below both reads and writes it, and
	// it must not become one of that effect's own dependencies.
	let reactedTo: string | null = null;

	/**
	 * Open this branch when the highlight *moves* into it.
	 *
	 * Reacting to the change rather than holding "expanded" as an invariant is
	 * the point: keeping it open for as long as a descendant was highlighted
	 * made the branch impossible to fold, because collapsing it sprang it back
	 * open on the same frame. Now a fold sticks until a newly selected image
	 * lands somewhere underneath.
	 */
	$effect(() => {
		const highlighted = libraryStore.highlightedFolder;
		if (highlighted === reactedTo) return;
		reactedTo = highlighted;

		if (highlighted?.startsWith(node.path + '/')) {
			expanded = true;
		}
	});

	function toggle() {
		expanded = !expanded;
	}

	function select() {
		// Clicking the folder already being viewed has nothing left to select,
		// so let it fold the branch instead of doing nothing at all.
		if (isSelected) {
			toggle();
			return;
		}
		libraryStore.selectFolder(node.path);
	}
</script>

<div class="tree-node">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="tree-item"
		class:active={isSelected}
		class:highlighted={isHighlighted && !isSelected}
		class:muted={isMuted}
		style="padding-left: {8 + depth * 16}px"
		onclick={select}
		ondblclick={toggle}
		oncontextmenu={handleContextMenu}
		role="treeitem"
	>
		{#if node.children.length > 0}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="expand-btn" onclick={(e) => { e.stopPropagation(); toggle(); }} role="button" aria-label="Toggle folder">
				<svg
					width="10"
					height="10"
					viewBox="0 0 16 16"
					fill="currentColor"
					class:rotated={expanded}
				>
					<path d="M6 4l4 4-4 4V4z" />
				</svg>
			</span>
		{:else}
			<span class="expand-spacer"></span>
		{/if}
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" class="folder-icon">
			<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z" />
		</svg>
		<span class="folder-name">{node.name}</span>
		{#if isFavorite}
			<svg width="10" height="10" viewBox="0 0 16 16" fill="#f5c518" class="fav-star">
				<path d="M8 1l2.163 4.382 4.837.703-3.5 3.412.827 4.823L8 12.027l-4.327 2.293.827-4.823L1 5.085l4.837-.703L8 1z"/>
			</svg>
		{/if}
		<span class="image-count">{node.image_count}</span>
	</div>

	{#if expanded && node.children.length > 0}
		<div class="tree-children">
			{#each node.children as child (child.path)}
				<FolderTree node={child} depth={depth + 1} />
			{/each}
		</div>
	{/if}
</div>

{#if contextMenu}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="ctx-overlay" onclick={closeContextMenu} oncontextmenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
		<div class="ctx-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
			<button class="ctx-item" onclick={openInFileManager}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z" />
				</svg>
				Open folder
			</button>
			<button class="ctx-item" onclick={toggleFavorite}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill={isFavorite ? '#f5c518' : 'currentColor'}>
					<path d="M8 1l2.163 4.382 4.837.703-3.5 3.412.827 4.823L8 12.027l-4.327 2.293.827-4.823L1 5.085l4.837-.703L8 1z"/>
				</svg>
				{isFavorite ? 'Remove from favorites' : 'Add to favorites'}
			</button>
			<button class="ctx-item" onclick={toggleMute}>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					{#if isMuted}
						<path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 018 2v12z"/>
					{:else}
						<path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm3.5 4.5h-7v1h7v-1z"/>
					{/if}
				</svg>
				{isMuted ? 'Unmute folder' : 'Mute folder'}
			</button>
		</div>
	</div>
{/if}

<style>
	.tree-node {
		width: 100%;
	}

	.tree-item {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 4px 8px;
		background: none;
		border: none;
		color: var(--color-text-primary);
		cursor: pointer;
		text-align: left;
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
	}

	.tree-item:hover {
		background-color: var(--color-bg-hover);
	}

	.tree-item.active {
		background-color: var(--color-bg-selected);
	}

	/* The folder the selected image lives in. Its previous colour was
	   --color-bg-hover, which is the very colour every row takes on hover, so
	   the mark was invisible in practice. The inset shadow draws the accent bar
	   without a border, which would shift the row's contents by two pixels. */
	.tree-item.highlighted {
		background-color: color-mix(in srgb, var(--color-accent) 22%, transparent);
		box-shadow: inset 2px 0 0 var(--color-accent);
	}

	.tree-item.highlighted .folder-name {
		color: var(--color-text-primary);
		font-weight: 600;
	}

	.expand-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.expand-btn svg {
		transition: transform 0.15s ease;
	}

	.expand-btn svg.rotated {
		transform: rotate(90deg);
	}

	.expand-spacer {
		width: 14px;
		flex-shrink: 0;
	}

	.folder-icon {
		color: var(--color-accent);
		flex-shrink: 0;
	}

	.folder-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.image-count {
		margin-left: auto;
		color: var(--color-text-muted);
		font-size: 10px;
		flex-shrink: 0;
	}

	.fav-star {
		margin-left: auto;
		flex-shrink: 0;
	}

	.fav-star + .image-count {
		margin-left: 4px;
	}

	.tree-children {
		/* no indent — handled by padding-left on tree-item */
	}

	.tree-item.muted {
		opacity: 0.4;
	}

	.ctx-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.ctx-menu {
		position: fixed;
		background-color: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 4px 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		min-width: 160px;
	}

	.ctx-item {
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

	.ctx-item:hover {
		background-color: var(--color-bg-hover);
	}
</style>
