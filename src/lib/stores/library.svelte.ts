import { invoke } from '@tauri-apps/api/core';
import type { ImageEntry, FolderNode, SortBy, SortDirection } from '$lib/types';

class LibraryStore {
	constructor() {
		if (typeof window !== 'undefined') {
			this.loadMutedFolders();
			this.loadFavorites();
			try {
				const rv = localStorage.getItem('ab:recursive_view');
				if (rv) this.recursiveView = rv === '1';
			} catch {}
		}
	}

	setRecursiveView(v: boolean) {
		this.recursiveView = v;
		try { localStorage.setItem('ab:recursive_view', v ? '1' : '0'); } catch {}
	}

	// State
	rootPath = $state<string | null>(null);
	allImages = $state<ImageEntry[]>([]);
	folderTree = $state<FolderNode | null>(null);
	selectedFolder = $state<string | null>(null);
	selectedImage = $state<ImageEntry | null>(null);
	isScanning = $state(false);

	// Search
	globalSearch = $state('');
	filterSearch = $state('');

	// Sort
	sortBy = $state<SortBy>('path');
	sortDirection = $state<SortDirection>('asc');

	// Size filter (bytes)
	minSizeBytes = $state<number>(0);
	maxSizeBytes = $state<number>(0); // 0 = no limit

	// Resolution filter (pixels, max dimension)
	minResolution = $state<number>(0);
	maxResolution = $state<number>(0); // 0 = no limit

	// Muted folders
	mutedFolders = $state<Set<string>>(new Set());

	// Favorites
	favoriteFolders = $state<Set<string>>(new Set());
	favoriteFiles = $state<Set<string>>(new Set());

	// Recursive view: when true, selecting a folder also shows images from its subfolders
	recursiveView = $state<boolean>(false);

	// Derived: images for current folder.
	// This is a cached $derived, not a getter: it is read on every scroll frame
	// (through visibleItems), and re-running the filter+sort pipeline there made
	// scrolling crawl on large libraries.
	folderImages: ImageEntry[] = $derived.by(() => {
		let images: ImageEntry[];

		if (this.globalSearch.trim()) {
			// Global search across all images
			const q = this.globalSearch.toLowerCase();
			images = this.allImages.filter(
				(img) =>
					img.name.toLowerCase().includes(q) ||
					img.folder.toLowerCase().includes(q)
			);
		} else if (this.selectedFolder) {
			const sel = this.selectedFolder;
			if (this.recursiveView) {
				// Include subfolders
				images = this.allImages.filter(
					(img) => img.folder === sel || img.folder.startsWith(sel + '/')
				);
			} else {
				// Show images in selected folder (non-recursive, just that folder)
				images = this.allImages.filter((img) => img.folder === sel);
			}
		} else {
			// No folder selected — show all
			images = this.allImages;
		}

		// Exclude muted folders (in all views except when directly viewing a muted folder)
		if (this.mutedFolders.size > 0) {
			const viewing = this.selectedFolder;
			if (!viewing || !this.isFolderMuted(viewing)) {
				images = images.filter((img) => !this.isFolderMuted(img.folder));
			}
		}

		// Apply filter search on top
		if (this.filterSearch.trim()) {
			const fq = this.filterSearch.toLowerCase();
			images = images.filter((img) => img.name.toLowerCase().includes(fq));
		}

		// Apply size filter
		if (this.minSizeBytes > 0) {
			images = images.filter((img) => img.size_bytes >= this.minSizeBytes);
		}
		if (this.maxSizeBytes > 0) {
			images = images.filter((img) => img.size_bytes <= this.maxSizeBytes);
		}

		// Apply resolution filter (uses max dimension: max(width, height))
		if (this.minResolution > 0) {
			images = images.filter((img) => Math.max(img.width, img.height) >= this.minResolution);
		}
		if (this.maxResolution > 0) {
			images = images.filter((img) => Math.max(img.width, img.height) <= this.maxResolution);
		}

		// Sort
		return this.sortImages(images);
	});

	get totalCount(): number {
		return this.allImages.length;
	}

	get displayCount(): number {
		return this.folderImages.length;
	}

	private sortImages(images: ImageEntry[]): ImageEntry[] {
		const dir = this.sortDirection === 'asc' ? 1 : -1;
		const by = this.sortBy;
		return [...images].sort((a, b) => {
			switch (by) {
				case 'path':
					return a.path.localeCompare(b.path) * dir;
				case 'name':
					return a.name.localeCompare(b.name) * dir;
				case 'size':
					return (a.size_bytes - b.size_bytes) * dir;
				case 'modified':
					return (a.modified - b.modified) * dir;
				case 'extension':
					return a.extension.localeCompare(b.extension) * dir;
				default:
					return 0;
			}
		});
	}

	async scanFolder(path: string) {
		this.isScanning = true;
		this.globalSearch = '';
		this.filterSearch = '';
		this.selectedImage = null;
		try {
			const depthRaw = localStorage.getItem('ab:max_scan_depth');
			const maxDepth = depthRaw ? Math.max(1, Math.min(100, parseInt(depthRaw, 10) || 100)) : 100;
			const images = await invoke<ImageEntry[]>('scan_folder', { path, maxDepth });
			this.allImages = images;
			this.rootPath = path;
			this.selectedFolder = null;

			// Fetch folder tree
			const tree = await invoke<FolderNode | null>('get_folder_tree');
			this.folderTree = tree;
		} catch (e) {
			console.error('Scan failed:', e);
		} finally {
			this.isScanning = false;
		}
	}

	selectFolder(path: string | null) {
		this.selectedFolder = path;
		this.highlightedFolder = path;
		this.selectedImage = null;
		this.filterSearch = '';
	}

	// Folder highlighted in the tree (follows selected image, doesn't filter the view)
	highlightedFolder = $state<string | null>(null);

	selectImage(image: ImageEntry | null) {
		this.selectedImage = image;
		if (image) {
			this.highlightedFolder = image.folder;
		}
	}

	/**
	 * Move the selection through the images currently on screen.
	 * Returns the index of the newly selected image, or -1 when there is nothing to select.
	 */
	selectRelative(delta: number): number {
		const images = this.folderImages;
		if (images.length === 0) return -1;

		const current = this.selectedImage;
		const index = current ? images.findIndex((img) => img.path === current.path) : -1;
		const next =
			index === -1
				? delta > 0
					? 0
					: images.length - 1
				: Math.min(images.length - 1, Math.max(0, index + delta));

		this.selectImage(images[next]);
		return next;
	}

	// Muted folders
	isFolderMuted(path: string): boolean {
		for (const muted of this.mutedFolders) {
			if (path === muted || path.startsWith(muted + '/')) return true;
		}
		return false;
	}

	muteFolder(path: string) {
		this.mutedFolders = new Set([...this.mutedFolders, path]);
		this.saveMutedFolders();
	}

	unmuteFolder(path: string) {
		const next = new Set(this.mutedFolders);
		next.delete(path);
		this.mutedFolders = next;
		this.saveMutedFolders();
	}

	private saveMutedFolders() {
		const arr = [...this.mutedFolders];
		try { localStorage.setItem('ab:muted_folders', JSON.stringify(arr)); } catch {}
	}

	loadMutedFolders() {
		try {
			const raw = localStorage.getItem('ab:muted_folders');
			if (raw) this.mutedFolders = new Set(JSON.parse(raw));
		} catch {}
	}

	// Favorites
	isFolderFavorite(path: string): boolean {
		return this.favoriteFolders.has(path);
	}

	isFileFavorite(path: string): boolean {
		return this.favoriteFiles.has(path);
	}

	toggleFavoriteFolder(path: string) {
		const next = new Set(this.favoriteFolders);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		this.favoriteFolders = next;
		this.saveFavorites();
	}

	toggleFavoriteFile(path: string) {
		const next = new Set(this.favoriteFiles);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		this.favoriteFiles = next;
		this.saveFavorites();
	}

	removeFavoriteFolder(path: string) {
		const next = new Set(this.favoriteFolders);
		next.delete(path);
		this.favoriteFolders = next;
		this.saveFavorites();
	}

	removeFavoriteFile(path: string) {
		const next = new Set(this.favoriteFiles);
		next.delete(path);
		this.favoriteFiles = next;
		this.saveFavorites();
	}

	private saveFavorites() {
		try {
			localStorage.setItem('ab:favorite_folders', JSON.stringify([...this.favoriteFolders]));
			localStorage.setItem('ab:favorite_files', JSON.stringify([...this.favoriteFiles]));
		} catch {}
	}

	loadFavorites() {
		try {
			const rawFolders = localStorage.getItem('ab:favorite_folders');
			if (rawFolders) this.favoriteFolders = new Set(JSON.parse(rawFolders));
			const rawFiles = localStorage.getItem('ab:favorite_files');
			if (rawFiles) this.favoriteFiles = new Set(JSON.parse(rawFiles));
		} catch {}
	}

	setSort(by: SortBy) {
		if (this.sortBy === by) {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortBy = by;
			this.sortDirection = 'asc';
		}
	}

}

export const libraryStore = new LibraryStore();
