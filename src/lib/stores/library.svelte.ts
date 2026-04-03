import { invoke } from '@tauri-apps/api/core';
import type { ImageEntry, FolderNode, SortBy, SortDirection } from '$lib/types';

class LibraryStore {
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

	// Thumbnails cache
	thumbnails = $state<Record<string, string>>({});

	// Derived: images for current folder
	get folderImages(): ImageEntry[] {
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
			// Show images in selected folder (non-recursive, just that folder)
			images = this.allImages.filter((img) => img.folder === this.selectedFolder);
		} else {
			// No folder selected — show all
			images = this.allImages;
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
	}

	get totalCount(): number {
		return this.allImages.length;
	}

	get displayCount(): number {
		return this.folderImages.length;
	}

	private sortImages(images: ImageEntry[]): ImageEntry[] {
		const dir = this.sortDirection === 'asc' ? 1 : -1;
		return [...images].sort((a, b) => {
			switch (this.sortBy) {
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
			const images = await invoke<ImageEntry[]>('scan_folder', { path });
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

	setSort(by: SortBy) {
		if (this.sortBy === by) {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			this.sortBy = by;
			this.sortDirection = 'asc';
		}
	}

	async loadThumbnails(paths: string[]) {
		// Filter out already cached
		const missing = paths.filter((p) => !this.thumbnails[p]);
		if (missing.length === 0) return;

		try {
			const batch = await invoke<Record<string, string>>('get_thumbnails_batch', {
				paths: missing,
			});
			this.thumbnails = { ...this.thumbnails, ...batch };
		} catch (e) {
			console.error('Failed to load thumbnails:', e);
		}
	}
}

export const libraryStore = new LibraryStore();
