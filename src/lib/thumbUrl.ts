import { convertFileSrc } from '@tauri-apps/api/core';
import type { ImageEntry } from '$lib/types';

/**
 * URL for an image's thumbnail, served by the `thumb://` protocol.
 *
 * The mtime and size travel in the URL so that an edited file resolves to a
 * different cache key and gets regenerated, and so that the frontend never has
 * to ask the backend anything: the `<img>` tag alone drives generation,
 * caching and eviction.
 */
export function thumbUrl(image: ImageEntry): string {
	// base64url keeps the path in a single URL segment with no characters that
	// need escaping, so the backend can decode it without a percent-decoder.
	const bytes = new TextEncoder().encode(image.path);
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

	// convertFileSrc picks the right shape per platform
	// (thumb://localhost/… on Linux and macOS, http://thumb.localhost/… on Windows).
	return convertFileSrc(`${image.modified}_${image.size_bytes}_${encoded}`, 'thumb');
}
