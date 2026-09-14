import type { ImageEntry } from '$lib/types';

const STORAGE_KEY = 'ab:selection';

/**
 * The hand-picked pile of images the selection panel acts on.
 *
 * Deliberately separate from `libraryStore.selectedImage`, which is only what
 * the preview happens to be showing. The pile is gathered across folders and
 * searches, so nothing implicit empties it: not clicking elsewhere, not
 * changing folder, not losing focus. Only its own buttons do.
 */
class SelectionStore {
	items = $state<ImageEntry[]>([]);

	/**
	 * The same paths as a Set. The grid asks `has()` once per visible cell on
	 * every scroll frame, which a linear scan over the pile would not survive.
	 */
	private pathSet = $state<Set<string>>(new Set());

	constructor() {
		if (typeof window !== 'undefined') this.load();
	}

	get count(): number {
		return this.items.length;
	}

	get paths(): string[] {
		return this.items.map((item) => item.path);
	}

	has(path: string): boolean {
		return this.pathSet.has(path);
	}

	add(image: ImageEntry) {
		if (this.pathSet.has(image.path)) return;
		this.items = [...this.items, image];
		this.pathSet = new Set([...this.pathSet, image.path]);
		this.save();
	}

	remove(path: string) {
		if (!this.pathSet.has(path)) return;
		this.items = this.items.filter((item) => item.path !== path);
		const next = new Set(this.pathSet);
		next.delete(path);
		this.pathSet = next;
		this.save();
	}

	toggle(image: ImageEntry) {
		if (this.pathSet.has(image.path)) this.remove(image.path);
		else this.add(image);
	}

	clear() {
		this.items = [];
		this.pathSet = new Set();
		this.save();
	}

	private save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
		} catch {}
	}

	private load() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const items = JSON.parse(raw);
			if (!Array.isArray(items)) return;
			this.items = items;
			this.pathSet = new Set(items.map((item: ImageEntry) => item.path));
		} catch {}
	}
}

export const selectionStore = new SelectionStore();
