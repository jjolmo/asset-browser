<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { open } from '@tauri-apps/plugin-dialog';
	import { libraryStore } from '$lib/stores/library.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { dragLabel, startFileDrag } from '$lib/dragOut';
	import { thumbUrl } from '$lib/thumbUrl';
	import { previewBackground } from '$lib/backgrounds';
	import type { ImageEntry } from '$lib/types';

	interface TransferFailure {
		path: string;
		error: string;
	}

	interface TransferReport {
		succeeded: number;
		failures: TransferFailure[];
	}

	let status = $state<{ text: string; kind: 'ok' | 'error' } | null>(null);
	let busy = $state(false);

	let thumbBgStyle = $derived(previewBackground(8));

	/** The folder each file sits in, shortened against the library root. */
	function shortFolder(image: ImageEntry): string {
		const root = libraryStore.rootPath;
		if (root && image.folder === root) return '.';
		if (root && image.folder.startsWith(root + '/')) return image.folder.slice(root.length + 1);
		return image.folder;
	}

	function report(text: string, kind: 'ok' | 'error' = 'ok') {
		status = { text, kind };
	}

	function describe(result: TransferReport, verb: string): string {
		if (result.failures.length === 0) return `${verb} ${result.succeeded} file${result.succeeded === 1 ? '' : 's'}`;
		return `${verb} ${result.succeeded}, ${result.failures.length} failed: ${result.failures[0].error}`;
	}

	async function copyToClipboard() {
		busy = true;
		try {
			await invoke('copy_files_to_clipboard', { paths: selectionStore.paths });
			report(`${selectionStore.count} file${selectionStore.count === 1 ? '' : 's'} on the clipboard`);
		} catch (e) {
			report(String(e), 'error');
		} finally {
			busy = false;
		}
	}

	async function transferTo(moveFiles: boolean) {
		const dest = await open({ directory: true, multiple: false });
		if (typeof dest !== 'string') return;

		busy = true;
		try {
			const result = await invoke<TransferReport>('transfer_files', {
				paths: selectionStore.paths,
				destDir: dest,
				moveFiles
			});
			report(describe(result, moveFiles ? 'Moved' : 'Copied'), result.failures.length ? 'error' : 'ok');

			// A move leaves every entry in the library pointing at a path that is
			// no longer there, so the scan has to be redone before anything else
			// touches those files.
			if (moveFiles && result.succeeded > 0) {
				if (result.failures.length === 0) selectionStore.clear();
				if (libraryStore.rootPath) await libraryStore.scanFolder(libraryStore.rootPath);
			}
		} catch (e) {
			report(String(e), 'error');
		} finally {
			busy = false;
		}
	}

	function handleDragStart(e: DragEvent) {
		// The webview's own drag would never leave the window; the plugin takes
		// over from here and runs the desktop's real drag instead.
		e.preventDefault();
		startFileDrag(selectionStore.paths, dragLabel(selectionStore.count)).catch((err) =>
			report(String(err), 'error')
		);
	}

	// ── Hover preview ──────────────────────────────────────────────────
	// A bigger look at the file without leaving the panel. The full image is
	// fetched rather than the thumbnail, so the preview is actually worth the
	// space; a short delay keeps a sweep down the list from loading everything.

	let hovered = $state<{ image: ImageEntry; src: string; top: number; left: number } | null>(null);
	let hoverTimer = 0;

	// Full-size images as base64 add up fast, so only the last few hovers are
	// kept — enough to make going back and forth between two rows instant
	// without letting a sweep down a long list hold onto every file.
	const PREVIEW_CACHE_SIZE = 8;
	const previewCache = new Map<string, string>();

	function cachePreview(path: string, src: string) {
		previewCache.set(path, src);
		while (previewCache.size > PREVIEW_CACHE_SIZE) {
			previewCache.delete(previewCache.keys().next().value!);
		}
	}

	function handleRowEnter(e: MouseEvent, image: ImageEntry) {
		clearTimeout(hoverTimer);
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		hoverTimer = window.setTimeout(async () => {
			let src = previewCache.get(image.path);
			if (!src) {
				try {
					src = await invoke<string>('get_image_base64', { path: image.path });
					cachePreview(image.path, src);
				} catch {
					src = thumbUrl(image);
				}
			}
			hovered = { image, src, top: rect.top, left: rect.left };
		}, 180);
	}

	function handleRowLeave() {
		clearTimeout(hoverTimer);
		hovered = null;
	}

	// Anchored to the row but pushed clear of the panel's left edge, so the
	// preview never covers the list it was opened from.
	let previewTop = $derived(
		hovered ? Math.max(8, Math.min(hovered.top - 40, window.innerHeight - 300)) : 0
	);
	let previewRight = $derived(hovered ? Math.max(8, window.innerWidth - hovered.left + 8) : 8);
</script>

<div class="selection-panel">
	<div class="selection-header">
		<span class="selection-title">
			{selectionStore.count} selected
		</span>
		<button
			class="cancel-btn"
			onclick={() => { selectionStore.clear(); status = null; }}
			title="Clear the whole selection"
		>
			Cancel selection
		</button>
	</div>

	<div class="selection-actions">
		<button class="action-btn" disabled={busy} onclick={copyToClipboard} title="Put the files on the clipboard, ready to paste in a file manager">
			<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
				<path d="M4 2h8v1h1.5l.5.5v11l-.5.5h-11l-.5-.5v-11l.5-.5H4V2zm0 2H3v10h10V4h-1v1H4V4zm1-1v1h6V3H5z"/>
			</svg>
			Clipboard
		</button>
		<button class="action-btn" disabled={busy} onclick={() => transferTo(false)} title="Copy the files into another folder">
			<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
				<path d="M14.5 3H7.71l-.85-.85L6.51 2H1.5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 8.49V13H2V7h5.29l.85.85.36.15H14v3.49zM2 3h4.29l.85.85.36.15H14v2H8.5l-.85-.85L7.29 5H2V3z"/>
			</svg>
			Copy to…
		</button>
		<button class="action-btn" disabled={busy} onclick={() => transferTo(true)} title="Move the files into another folder">
			<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
				<path d="M8 1l4 4H9v5H7V5H4l4-4zM2 12h12v2H2v-2z"/>
			</svg>
			Move to…
		</button>
	</div>

	{#if status}
		<div class="selection-status" class:error={status.kind === 'error'}>{status.text}</div>
	{/if}

	<div class="selection-list">
		{#each selectionStore.items as image (image.path)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="selection-row"
				class:current={libraryStore.selectedImage?.path === image.path}
				draggable="true"
				ondragstart={handleDragStart}
				onmouseenter={(e) => handleRowEnter(e, image)}
				onmouseleave={handleRowLeave}
			>
				<button class="row-main" onclick={() => libraryStore.selectImage(image)} title={image.path}>
					<span class="row-thumb" style={thumbBgStyle}>
						<img src={thumbUrl(image)} alt="" decoding="async" draggable="false" />
					</span>
					<span class="row-text">
						<span class="row-name">{image.name}</span>
						<span class="row-folder">{shortFolder(image)}</span>
					</span>
				</button>
				<button
					class="row-remove"
					onclick={() => selectionStore.remove(image.path)}
					title="Remove from selection"
				>
					<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
						<path d="M8 6.94L13.06 1.88 14.12 2.94 9.06 8l5.06 5.06-1.06 1.06L8 9.06l-5.06 5.06-1.06-1.06L6.94 8 1.88 2.94 2.94 1.88 8 6.94z"/>
					</svg>
				</button>
			</div>
		{/each}
	</div>
</div>

{#if hovered}
	<div class="hover-preview" style="top: {previewTop}px; right: {previewRight}px; {thumbBgStyle}">
		<img src={hovered.src} alt={hovered.image.name} draggable="false" />
	</div>
{/if}

<style>
	.selection-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: var(--color-bg-secondary);
		border-left: 1px solid var(--color-border);
	}

	.selection-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.selection-title {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-primary);
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}

	.cancel-btn {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: 3px;
		color: var(--color-text-secondary);
		font-size: 10px;
		padding: 2px 6px;
		cursor: pointer;
		white-space: nowrap;
	}

	.cancel-btn:hover {
		background-color: var(--color-bg-hover);
		color: var(--color-text-primary);
	}

	.selection-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background-color: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		color: var(--color-text-primary);
		font-size: 11px;
		padding: 3px 7px;
		cursor: pointer;
	}

	.action-btn:hover:not(:disabled) {
		background-color: var(--color-bg-hover);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.selection-status {
		flex-shrink: 0;
		padding: 4px 8px;
		font-size: 10px;
		color: var(--color-text-secondary);
		border-bottom: 1px solid var(--color-border);
	}

	.selection-status.error {
		color: #f48771;
	}

	.selection-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 4px;
	}

	.selection-row {
		display: flex;
		align-items: center;
		border-radius: 3px;
	}

	.selection-row:hover {
		background-color: var(--color-bg-hover);
	}

	.selection-row.current {
		background-color: var(--color-bg-selected);
	}

	.row-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: inherit;
		padding: 3px 4px;
		cursor: grab;
		text-align: left;
	}

	.row-thumb {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.row-thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.row-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.row-name {
		font-size: 11px;
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-folder {
		font-size: 9px;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		direction: rtl;
		text-align: left;
	}

	.row-remove {
		flex-shrink: 0;
		background: none;
		border: none;
		color: var(--color-text-muted);
		padding: 4px 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
	}

	.row-remove:hover {
		color: #f48771;
	}

	.hover-preview {
		position: fixed;
		z-index: 200;
		width: 260px;
		height: 260px;
		padding: 4px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
		pointer-events: none;
	}

	.hover-preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		image-rendering: pixelated;
	}
</style>
