export interface CustomAction {
	id: string;
	title: string;
	command: string;
}

const STORAGE_KEY = 'ab:custom_actions';

class CustomActionsStore {
	actions = $state<CustomAction[]>([]);

	constructor() {
		if (typeof window !== 'undefined') {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) this.actions = JSON.parse(raw);
			} catch {}
		}
	}

	private save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.actions));
		} catch {}
	}

	add(title: string, command: string) {
		this.actions = [
			...this.actions,
			{ id: crypto.randomUUID(), title, command }
		];
		this.save();
	}

	update(id: string, title: string, command: string) {
		this.actions = this.actions.map((a) =>
			a.id === id ? { ...a, title, command } : a
		);
		this.save();
	}

	remove(id: string) {
		this.actions = this.actions.filter((a) => a.id !== id);
		this.save();
	}

	move(id: string, direction: -1 | 1) {
		const idx = this.actions.findIndex((a) => a.id === id);
		if (idx < 0) return;
		const newIdx = idx + direction;
		if (newIdx < 0 || newIdx >= this.actions.length) return;
		const next = [...this.actions];
		[next[idx], next[newIdx]] = [next[newIdx], next[idx]];
		this.actions = next;
		this.save();
	}
}

export const customActionsStore = new CustomActionsStore();
