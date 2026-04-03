import { invoke } from '@tauri-apps/api/core';

class SettingsStore {
	private cache = $state<Record<string, string>>({});

	constructor() {
		if (typeof window !== 'undefined') {
			try {
				for (let i = 0; i < localStorage.length; i++) {
					const k = localStorage.key(i);
					if (k?.startsWith('ab:')) {
						this.cache[k.slice(3)] = localStorage.getItem(k)!;
					}
				}
			} catch {}
		}
	}

	getSetting(key: string): string | undefined {
		return this.cache[key];
	}

	async setSetting(key: string, value: string) {
		this.cache[key] = value;
		try {
			localStorage.setItem(`ab:${key}`, value);
		} catch {}
		await invoke('set_setting', { key, value }).catch(() => {});
	}

	async init() {
		// Settings are loaded from localStorage in constructor
	}
}

export const settingsStore = new SettingsStore();
