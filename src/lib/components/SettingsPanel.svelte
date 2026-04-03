<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { settingsStore } from '$lib/stores/settings.svelte';

	let { onclose }: { onclose: () => void } = $props();

	let activeCategory = $state('general');

	// Desktop entry
	let desktopStatus = $state<'idle' | 'success' | 'error'>('idle');
	let desktopMessage = $state('');
	const isLinux = navigator.userAgent.includes('Linux');

	async function createDesktopEntry() {
		try {
			const path = await invoke<string>('create_desktop_entry');
			desktopStatus = 'success';
			desktopMessage = path;
		} catch (e) {
			desktopStatus = 'error';
			desktopMessage = String(e);
		}
	}

	// Update checker
	let updateStatus = $state<'idle' | 'checking' | 'up-to-date' | 'available' | 'error'>('idle');
	let updateInfo = $state<{ latest: string; current: string; url: string; download: string } | null>(null);
	let updateError = $state('');

	async function checkForUpdates() {
		updateStatus = 'checking';
		try {
			const info = await invoke<{
				current_version: string;
				latest_version: string;
				has_update: boolean;
				download_url: string;
				release_url: string;
			}>('check_for_updates');
			updateInfo = {
				latest: info.latest_version,
				current: info.current_version,
				url: info.release_url,
				download: info.download_url,
			};
			updateStatus = info.has_update ? 'available' : 'up-to-date';
		} catch (e) {
			updateStatus = 'error';
			updateError = String(e);
		}
	}

	interface Category {
		id: string;
		label: string;
		icon: string;
	}

	const categories: Category[] = [
		{
			id: 'general',
			label: 'General',
			icon: 'M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.7-1.3 2 .8.8 2-1.3.7.3.5 2.4h1.2l.5-2.4.7-.3 2 1.3.8-.8-1.3-2 .3-.7 2.4-.5V7.4l-2.4-.5-.3-.7 1.3-2-.8-.8-2 1.3-.7-.3zM8 10a2 2 0 110-4 2 2 0 010 4z'
		},
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
				{#if activeCategory === 'general'}
					<div class="content-page">
						<h3 class="section-title">General</h3>
						<p class="section-desc">General application settings.</p>

						{#if isLinux}
							<div class="setting-group">
								<span class="setting-label">Desktop Integration</span>
								<p class="section-desc">Create a .desktop entry so Asset Browser appears in your application menu.</p>
								<button class="action-btn" onclick={createDesktopEntry}>
									<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
										<path d="M14 1H2a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V2a1 1 0 00-1-1zM2 0h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2zm1 4h10v1H3V4zm0 3h10v1H3V7zm0 3h7v1H3v-1z"/>
									</svg>
									Create .desktop entry
								</button>
								{#if desktopStatus === 'success'}
									<p class="status-msg success">Created: {desktopMessage}</p>
								{:else if desktopStatus === 'error'}
									<p class="status-msg error">{desktopMessage}</p>
								{/if}
							</div>
						{/if}
					</div>
				{:else if activeCategory === 'appearance'}
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
								<p class="about-version">v0.9.3</p>
							</div>
						</div>
						<p class="about-desc">A fast, cross-platform asset browser for game development and pixel art.</p>
						<div class="about-tech">
							<span class="tech-badge">Tauri v2</span>
							<span class="tech-badge">SvelteKit 2</span>
							<span class="tech-badge">Svelte 5</span>
							<span class="tech-badge">Rust</span>
						</div>

						<div class="setting-group" style="margin-top: 16px;">
							<h3 class="section-title">Updates</h3>
							<button class="action-btn" onclick={checkForUpdates} disabled={updateStatus === 'checking'}>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12zm-1-3h2V7H7v4zm0-5h2V4H7v2z"/>
								</svg>
								{updateStatus === 'checking' ? 'Checking...' : 'Check for updates'}
							</button>
							{#if updateStatus === 'up-to-date'}
								<p class="status-msg success">You're on the latest version ({updateInfo?.current})</p>
							{:else if updateStatus === 'available' && updateInfo}
								<div class="update-available">
									<p class="status-msg" style="color: var(--color-accent);">
										New version available: <strong>v{updateInfo.latest}</strong> (current: v{updateInfo.current})
									</p>
									<a class="action-btn update-link" href={updateInfo.url} target="_blank" rel="noopener">
										<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
											<path d="M8 1L3 7h3v5h4V7h3L8 1zM1 13h14v2H1v-2z"/>
										</svg>
										View release
									</a>
								</div>
							{:else if updateStatus === 'error'}
								<p class="status-msg error">{updateError}</p>
							{/if}
						</div>

						<div class="about-footer">
							<a class="about-link" href="https://github.com/jjolmo/asset-browser" target="_blank" rel="noopener">
								<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
									<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
								</svg>
								GitHub
							</a>
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

	/* Action button */
	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		margin-top: 4px;
		background-color: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		color: var(--color-text-primary);
		font-size: 12px;
		cursor: pointer;
	}

	.action-btn:hover {
		background-color: var(--color-bg-hover);
		border-color: var(--color-accent);
	}

	.status-msg {
		font-size: 11px;
		margin-top: 6px;
	}

	.status-msg.success {
		color: #4caf50;
	}

	.status-msg.error {
		color: #f44336;
	}

	.update-available {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 6px;
	}

	.update-link {
		text-decoration: none;
		display: inline-flex;
		width: fit-content;
	}

	.about-footer {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.about-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-secondary);
		text-decoration: none;
		font-size: 12px;
	}

	.about-link:hover {
		color: var(--color-accent);
	}
</style>
