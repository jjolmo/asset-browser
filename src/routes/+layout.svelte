<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { settingsStore } from '$lib/stores/settings.svelte';

	let { children } = $props();

	$effect(() => {
		settingsStore.init();
	});

	onMount(() => {
		getCurrentWindow().show();
	});
</script>

{@render children()}
