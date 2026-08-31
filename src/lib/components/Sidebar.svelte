<script lang="ts">
	import { onMount } from 'svelte';
	import { open } from '@tauri-apps/plugin-dialog';
	import { invoke } from '@tauri-apps/api/core';
	import { libraryStore } from '$lib/stores/library.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import SearchBar from './SearchBar.svelte';
	import FolderTree from './FolderTree.svelte';

	function selectFavFolder(path: string) {
		libraryStore.selectFolder(path);
	}

	function selectFavFile(path: string) {
		const img = libraryStore.allImages.find((i) => i.path === path);
		if (img) libraryStore.selectImage(img);
		else invoke('open_containing_folder', { path }).catch(console.error);
	}

	function basename(p: string): string {
		const i = p.lastIndexOf('/');
		return i >= 0 ? p.slice(i + 1) : p;
	}

	async function handleOpenFolder() {
		const selected = await open({ directory: true, multiple: false });
		if (selected) {
			await libraryStore.scanFolder(selected as string);
			settingsStore.setSetting('last_folder', selected as string);
		}
	}

	function handleSelectAll() {
		libraryStore.selectFolder(null);
	}

	onMount(async () => {
		const lastFolder = settingsStore.getSetting('last_folder');
		if (lastFolder) {
			await libraryStore.scanFolder(lastFolder);
		}
	});
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<span class="sidebar-title">Explorer</span>
		<div class="sidebar-actions">
			<button class="icon-btn" onclick={handleOpenFolder} title="Open folder">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z" />
				</svg>
			</button>
		</div>
	</div>

	<div class="sidebar-search">
		<SearchBar bind:value={libraryStore.globalSearch} placeholder="Search all assets..." />
	</div>

	<div class="sidebar-content">
		{#if libraryStore.rootPath}
			<button
				class="sidebar-item"
				class:active={libraryStore.selectedFolder === null && !libraryStore.globalSearch}
				onclick={handleSelectAll}
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path d="M13.5 1h-12l-.5.5v12l.5.5h12l.5-.5v-12l-.5-.5zM13 13H2V2h11v11z M4 5h7v1H4V5zm0 3h7v1H4V8zm0 3h5v1H4v-1z" />
				</svg>
				<span>All Assets</span>
				<span class="item-count">{libraryStore.totalCount}</span>
			</button>

			<!-- Favorites -->
			{#if libraryStore.favoriteFolders.size > 0 || libraryStore.favoriteFiles.size > 0}
				<div class="sidebar-section">
					<div class="section-header">
						<span>Favorites</span>
					</div>
					{#each [...libraryStore.favoriteFolders] as folder (folder)}
						<div class="fav-item" title={folder}>
							<svg width="12" height="12" viewBox="0 0 16 16" fill="#f5c518" class="fav-icon">
								<path d="M8 1l2.163 4.382 4.837.703-3.5 3.412.827 4.823L8 12.027l-4.327 2.293.827-4.823L1 5.085l4.837-.703L8 1z"/>
							</svg>
							<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" class="fav-kind-icon">
								<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z" />
							</svg>
							<button class="fav-name" onclick={() => selectFavFolder(folder)}>{basename(folder)}</button>
							<button class="fav-remove" onclick={() => libraryStore.removeFavoriteFolder(folder)} title="Remove from favorites">
								<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
								</svg>
							</button>
						</div>
					{/each}
					{#each [...libraryStore.favoriteFiles] as file (file)}
						<div class="fav-item" title={file}>
							<svg width="12" height="12" viewBox="0 0 16 16" fill="#f5c518" class="fav-icon">
								<path d="M8 1l2.163 4.382 4.837.703-3.5 3.412.827 4.823L8 12.027l-4.327 2.293.827-4.823L1 5.085l4.837-.703L8 1z"/>
							</svg>
							<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" class="fav-kind-icon">
								<path d="M13.5 5h-3V1h-8l-.5.5v13l.5.5h11l.5-.5v-9L13.5 5zM3 14V2h6v4h4v8H3z"/>
							</svg>
							<button class="fav-name" onclick={() => selectFavFile(file)}>{basename(file)}</button>
							<button class="fav-remove" onclick={() => libraryStore.removeFavoriteFile(file)} title="Remove from favorites">
								<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Muted folders -->
			{#if libraryStore.mutedFolders.size > 0}
				<div class="sidebar-section">
					<div class="section-header">
						<span>Muted</span>
					</div>
					{#each [...libraryStore.mutedFolders] as folder}
						<div class="muted-folder-item">
							<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" class="muted-icon">
								<path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm3.5 4.5h-7v1h7v-1z"/>
							</svg>
							<span class="muted-folder-name" title={folder}>{folder.split('/').pop()}</span>
							<button class="unmute-btn" onclick={() => libraryStore.unmuteFolder(folder)} title="Unmute">
								<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Folder tree -->
			<div class="sidebar-section">
				<div class="section-header">
					<span>Folders</span>
				</div>
				{#if libraryStore.folderTree}
					<FolderTree node={libraryStore.folderTree} />
				{/if}
			</div>

			<!-- Smart Folders (placeholder) -->
			<div class="sidebar-section">
				<div class="section-header">
					<span>Smart Folders</span>
					<button class="icon-btn small" title="Add smart folder (coming soon)" disabled>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
							<path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z" />
						</svg>
					</button>
				</div>
				<div class="smart-placeholder">
					<span class="muted-text">No smart folders yet</span>
				</div>
			</div>
		{:else}
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" opacity="0.2">
					<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z" />
				</svg>
				<p>Open a folder to browse assets</p>
				<button class="open-btn" onclick={handleOpenFolder}>Open Folder</button>
			</div>
		{/if}
	</div>

	{#if libraryStore.isScanning}
		<div class="scan-progress">
			<div class="scan-text">Scanning...</div>
			<div class="scan-bar">
				<div class="scan-bar-fill indeterminate"></div>
			</div>
		</div>
	{/if}
</aside>

<style>
	.sidebar {
		width: 100%;
		flex: 1;
		min-height: 0;
		background-color: var(--color-bg-secondary);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.sidebar-title {
		font-weight: 600;
		font-size: 12px;
		text-transform: uppercase;
		color: var(--color-text-secondary);
		letter-spacing: 0.5px;
	}

	.sidebar-actions {
		display: flex;
		gap: 2px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		padding: 4px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-btn:hover {
		color: var(--color-text-primary);
		background-color: var(--color-bg-hover);
	}

	.icon-btn.small {
		padding: 2px;
	}

	.icon-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.icon-btn:disabled:hover {
		background: none;
		color: var(--color-text-secondary);
	}

	.sidebar-search {
		padding: 8px;
		border-bottom: 1px solid var(--color-border);
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		background: none;
		border: none;
		color: var(--color-text-primary);
		cursor: pointer;
		text-align: left;
		font-size: 13px;
	}

	.sidebar-item:hover {
		background-color: var(--color-bg-hover);
	}

	.sidebar-item.active {
		background-color: var(--color-bg-selected);
	}

	.item-count {
		margin-left: auto;
		color: var(--color-text-muted);
		font-size: 11px;
	}

	.sidebar-section {
		margin-top: 8px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 12px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--color-text-muted);
		letter-spacing: 0.5px;
	}

	.smart-placeholder {
		padding: 8px 12px;
	}

	.muted-text {
		font-size: 11px;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.muted-folder-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 12px;
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.muted-icon {
		flex-shrink: 0;
		opacity: 0.5;
	}

	.muted-folder-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.unmute-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 2px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
		opacity: 0;
	}

	.muted-folder-item:hover .unmute-btn {
		opacity: 1;
	}

	.unmute-btn:hover {
		color: var(--color-text-primary);
		background-color: var(--color-bg-hover);
	}

	.fav-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 12px;
		font-size: 12px;
		color: var(--color-text-primary);
	}

	.fav-item:hover {
		background-color: var(--color-bg-hover);
	}

	.fav-icon, .fav-kind-icon {
		flex-shrink: 0;
	}

	.fav-kind-icon {
		opacity: 0.7;
	}

	.fav-name {
		flex: 1;
		background: none;
		border: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
		padding: 0;
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.fav-remove {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 2px;
		border-radius: 3px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
		opacity: 0;
	}

	.fav-item:hover .fav-remove {
		opacity: 1;
	}

	.fav-remove:hover {
		color: var(--color-text-primary);
		background-color: var(--color-bg-hover);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 32px 16px;
		text-align: center;
		color: var(--color-text-secondary);
		font-size: 13px;
	}

	.open-btn {
		padding: 6px 16px;
		background-color: var(--color-accent);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.open-btn:hover {
		background-color: var(--color-accent-hover);
	}

	.scan-progress {
		padding: 8px 12px;
		border-top: 1px solid var(--color-border);
	}

	.scan-text {
		font-size: 11px;
		color: var(--color-text-secondary);
		margin-bottom: 4px;
	}

	.scan-bar {
		height: 3px;
		background-color: var(--color-bg-tertiary);
		border-radius: 2px;
		overflow: hidden;
	}

	.scan-bar-fill {
		height: 100%;
		background-color: var(--color-accent);
	}

	.scan-bar-fill.indeterminate {
		width: 40%;
		animation: indeterminate 1.5s ease-in-out infinite;
	}

	@keyframes indeterminate {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(350%); }
	}
</style>
