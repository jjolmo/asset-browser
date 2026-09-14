/**
 * Whether the maximized viewer is covering the window.
 *
 * Only a flag: the viewer draws whatever `libraryStore.selectedImage` happens
 * to be, so every way of changing the selection — the arrow keys, walking
 * folders, clicking the grid underneath — moves the viewer along with it for
 * free, and none of that logic has to exist twice.
 */
class ViewerStore {
	isOpen = $state(false);

	open() {
		this.isOpen = true;
	}

	close() {
		this.isOpen = false;
	}
}

export const viewerStore = new ViewerStore();
