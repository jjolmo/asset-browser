import { settingsStore } from '$lib/stores/settings.svelte';

const CHECKER_BASE = '#1a1a1a';
const CHECKER_TINT = '#2a2a2a';

export const DEFAULT_PREVIEW_COLOR = '#1a1a1a';
export const DEFAULT_VIEWER_COLOR = '#1a1a1a';

/**
 * The backdrop every surface paints behind an image with transparency.
 *
 * Gathered here because the same switch had been copied into the grid, the
 * preview, the selection rows and the settings dialog, and the copies had
 * already drifted on tile size. `tile` is the one thing that legitimately
 * differs: a 28-pixel row and a full window want different squares.
 */
export function checkerboard(tile: number): string {
	const half = tile / 2;
	return (
		`background-color: ${CHECKER_BASE};` +
		` background-image: linear-gradient(45deg, ${CHECKER_TINT} 25%, transparent 25%),` +
		` linear-gradient(-45deg, ${CHECKER_TINT} 25%, transparent 25%),` +
		` linear-gradient(45deg, transparent 75%, ${CHECKER_TINT} 75%),` +
		` linear-gradient(-45deg, transparent 75%, ${CHECKER_TINT} 75%);` +
		` background-size: ${tile}px ${tile}px;` +
		` background-position: 0 0, 0 ${half}px, ${half}px -${half}px, -${half}px 0px;`
	);
}

function solid(color: string): string {
	return `background-color: ${color};`;
}

/** The colour picked for the solid option, behind thumbnails and the preview. */
export function previewColor(): string {
	return settingsStore.getSetting('preview_bg_color') || DEFAULT_PREVIEW_COLOR;
}

/** The maximized viewer's colour. */
export function viewerColor(): string {
	return settingsStore.getSetting('viewer_bg_color') || DEFAULT_VIEWER_COLOR;
}

/** Style for a given transparency mode, used by the settings swatches too. */
export function backgroundFor(mode: string, tile: number): string {
	switch (mode) {
		case 'black':
			return solid('#000000');
		case 'white':
			return solid('#ffffff');
		case 'dark':
			return solid('#1a1a1a');
		case 'color':
			return solid(previewColor());
		case 'checkerboard':
		default:
			return checkerboard(tile);
	}
}

/** Backdrop for thumbnails, the preview panel and the selection rows. */
export function previewBackground(tile: number): string {
	return backgroundFor(settingsStore.getSetting('transparency_bg') || 'checkerboard', tile);
}

/**
 * Backdrop for the maximized viewer: always one flat colour.
 *
 * It deliberately ignores the transparency mode above. A checkerboard is a way
 * of telling transparency apart in a thumbnail the size of a stamp; across a
 * whole window it is just noise over the picture you opened it to look at.
 */
export function viewerBackground(): string {
	return solid(viewerColor());
}
