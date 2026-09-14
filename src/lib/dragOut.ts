import { Channel, invoke } from '@tauri-apps/api/core';

/**
 * Starts a real desktop drag carrying `paths`, so dropping on a file manager
 * copies the files themselves — the same gesture as dragging out of one.
 *
 * The webview cannot do this on its own: an HTML drag never leaves the window.
 * The drag plugin hands the paths to the platform's drag source instead, which
 * is why the caller must `preventDefault()` the `dragstart` first and let this
 * take over.
 */
export async function startFileDrag(paths: string[], label: string): Promise<void> {
	if (paths.length === 0) return;

	// The plugin reports back where the drop landed. We have no use for it, but
	// the channel is not optional, so it is created and ignored.
	const onEvent = new Channel<unknown>();

	await invoke('plugin:drag|start_drag', {
		item: paths,
		image: dragIcon(label),
		options: { mode: 'copy' },
		onEvent
	});
}

const iconCache = new Map<string, string>();

/**
 * The little badge that follows the cursor during the drag, as a PNG data URL —
 * the only image shape the plugin accepts.
 */
function dragIcon(label: string): string {
	const cached = iconCache.get(label);
	if (cached) return cached;

	const scale = 2;
	const height = 34;
	const padding = 12;

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d')!;
	const font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

	// Measuring needs the font set, and setting the width resets the context,
	// so the font is applied twice on purpose.
	ctx.font = font;
	const width = Math.ceil(ctx.measureText(label).width) + padding * 2;

	canvas.width = width * scale;
	canvas.height = height * scale;
	ctx.scale(scale, scale);
	ctx.font = font;

	ctx.fillStyle = '#252526';
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = '#007acc';
	ctx.lineWidth = 2;
	ctx.strokeRect(1, 1, width - 2, height - 2);
	ctx.fillStyle = '#cccccc';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, padding, height / 2 + 1);

	const url = canvas.toDataURL('image/png');
	iconCache.set(label, url);
	return url;
}

/** "3 files" / "1 file" — what the drag badge says. */
export function dragLabel(count: number): string {
	return `${count} file${count === 1 ? '' : 's'}`;
}
