<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let activeCategory = $state('appearance');

	interface Category {
		id: string;
		label: string;
		icon: string;
	}

	const categories: Category[] = [
		{
			id: 'appearance',
			label: 'Appearance',
			icon: 'M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 018 2v12z'
		},
		{
			id: 'about',
			label: 'About',
			icon: 'M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3zm-.5 2.5h1v1h-1v-1zm0 2h1v4h-1v-4z'
		}
	];

	// Appearance settings
	let transparencyBg = $state(settingsStore.getSetting('transparency_bg') || 'checkerboard');

	function setTransparencyBg(value: string) {
		transparencyBg = value;
		settingsStore.setSetting('transparency_bg', value);
	}

	const bgOptions = [
		{ value: 'checkerboard', label: 'Checkerboard' },
		{ value: 'black', label: 'Black' },
		{ value: 'white', label: 'White' },
		{ value: 'dark', label: 'Dark gray' },
	] as const;

	function getBgPreviewStyle(value: string): string {
		switch (value) {
			case 'black': return 'background-color: #000;';
			case 'white': return 'background-color: #fff;';
			case 'dark': return 'background-color: #1a1a1a;';
			case 'checkerboard':
			default:
				return 'background-color: #1a1a1a; background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%); background-size: 10px 10px; background-position: 0 0, 0 5px, 5px -5px, -5px 0px;';
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="settings-overlay" onclick={handleBackdropClick}>
	<div class="settings-dialog">
		<div class="settings-header">
			<span class="settings-title">Settings</span>
			<button class="close-btn" onclick={onclose} aria-label="Close settings">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
				</svg>
			</button>
		</div>
		<div class="settings-body">
			<nav class="settings-nav">
				{#each categories as cat}
					<button
						class="nav-item"
						class:active={activeCategory === cat.id}
						onclick={() => activeCategory = cat.id}
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path d={cat.icon} />
						</svg>
						<span>{cat.label}</span>
					</button>
				{/each}
			</nav>
			<div class="settings-content">
				{#if activeCategory === 'appearance'}
					<div class="content-page">
						<h3 class="section-title">Appearance</h3>
						<p class="section-desc">Configure the visual appearance of the application.</p>

						<div class="setting-group">
							<label class="setting-label">Transparency background</label>
							<p class="setting-desc">Background shown behind images with transparency</p>
							<div class="bg-options">
								{#each bgOptions as opt}
									<button
										class="bg-option"
										class:active={transparencyBg === opt.value}
										onclick={() => setTransparencyBg(opt.value)}
										title={opt.label}
									>
										<div class="bg-preview" style={getBgPreviewStyle(opt.value)}></div>
										<span class="bg-label">{opt.label}</span>
									</button>
								{/each}
							</div>
						</div>
					</div>
				{:else if activeCategory === 'about'}
					<div class="content-page">
						<div class="about-header">
							<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.6">
								<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
							</svg>
							<div>
								<h3 class="about-title">Asset Browser</h3>
								<p class="about-version">v0.1.0</p>
							</div>
						</div>
						<p class="about-desc">A fast, cross-platform asset browser for game development and pixel art.</p>
						<div class="about-tech">
							<span class="tech-badge">Tauri v2</span>
							<span class="tech-badge">SvelteKit 2</span>
							<span class="tech-badge">Svelte 5</span>
							<span class="tech-badge">Rust</span>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.settings-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.settings-dialog {
		width: 700px;
		max-width: 92vw;
		height: 480px;
		max-height: 85vh;
		background-color: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		background-color: var(--color-bg-secondary);
	}

	.settings-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		padding: 4px;
		border-radius: 3px;
		display: flex;
		align-items: center;
	}

	.close-btn:hover {
		color: var(--color-text-primary);
		background-color: var(--color-bg-hover);
	}

	.settings-body {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.settings-nav {
		width: 180px;
		min-width: 180px;
		background-color: var(--color-bg-secondary);
		border-right: 1px solid var(--color-border);
		padding: 8px 0;
		overflow-y: auto;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 16px;
		background: none;
		border: none;
		color: var(--color-text-primary);
		cursor: pointer;
		text-align: left;
		font-size: 13px;
	}

	.nav-item:hover {
		background-color: var(--color-bg-hover);
	}

	.nav-item.active {
		background-color: var(--color-bg-selected);
	}

	.settings-content {
		flex: 1;
		padding: 16px;
		overflow-y: auto;
	}

	.content-page {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.section-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0;
	}

	.section-desc {
		font-size: 12px;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.setting-group {
		margin-top: 4px;
	}

	.setting-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text-primary);
		display: block;
		margin-bottom: 2px;
	}

	.bg-options {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}

	.bg-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px;
		border: 2px solid var(--color-border);
		border-radius: 6px;
		background: none;
		cursor: pointer;
		color: var(--color-text-secondary);
	}

	.bg-option:hover {
		border-color: var(--color-text-muted);
	}

	.bg-option.active {
		border-color: var(--color-accent);
	}

	.bg-preview {
		width: 48px;
		height: 48px;
		border-radius: 4px;
	}

	.bg-label {
		font-size: 10px;
	}

	/* About page */
	.about-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.about-title {
		font-size: 18px;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0;
	}

	.about-version {
		font-size: 12px;
		color: var(--color-text-muted);
		margin: 0;
	}

	.about-desc {
		font-size: 13px;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.about-tech {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 4px;
	}

	.tech-badge {
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 3px;
		background-color: var(--color-bg-tertiary);
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
	}
</style>
