<script lang="ts">
	import type { FolderNode } from '$lib/types';
	import { libraryStore } from '$lib/stores/library.svelte';
	import FolderTree from './FolderTree.svelte';

	let { node, depth = 0 }: { node: FolderNode; depth?: number } = $props();

	let expanded = $state(depth === 0);
	let isSelected = $derived(libraryStore.selectedFolder === node.path);
	let isHighlighted = $derived(libraryStore.highlightedFolder === node.path);

	// Auto-expand if a descendant folder is highlighted
	let containsHighlighted = $derived(
		libraryStore.highlightedFolder?.startsWith(node.path + '/') ?? false
	);

	$effect(() => {
		if (containsHighlighted && !expanded) {
			expanded = true;
		}
	});

	function toggle() {
		expanded = !expanded;
	}

	function select() {
		libraryStore.selectFolder(node.path);
	}
</script>

<div class="tree-node">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="tree-item"
		class:active={isSelected}
		class:highlighted={isHighlighted && !isSelected}
		style="padding-left: {8 + depth * 16}px"
		onclick={select}
		ondblclick={toggle}
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

	.tree-item.highlighted {
		background-color: var(--color-bg-hover);
		border-left: 2px solid var(--color-accent);
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

	.tree-children {
		/* no indent — handled by padding-left on tree-item */
	}
</style>
