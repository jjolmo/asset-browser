import { invoke } from '@tauri-apps/api/core';

let cachedPath: string | null = null;
let cached: Promise<string> | null = null;

/**
 * The full image as a data URL, shared by the preview panel and the viewer.
 *
 * Both show the same file at the same moment, and these strings run to
 * megabytes across the IPC bridge — the very cost the `thumb://` protocol
 * exists to avoid elsewhere. One entry is all it takes: the second asker rides
 * on the first request instead of repeating it.
 */
export function fullImage(path: string): Promise<string> {
	if (cachedPath !== path || !cached) {
		cachedPath = path;
		cached = invoke<string>('get_image_base64', { path }).catch((e) => {
			// A rejected promise must not be cached, or the failure sticks to
			// the path for as long as it stays selected.
			if (cachedPath === path) {
				cachedPath = null;
				cached = null;
			}
			throw e;
		});
	}
	return cached;
}
