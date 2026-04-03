use base64::{engine::general_purpose::STANDARD, Engine};
use parking_lot::Mutex;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{Manager, State};
use walkdir::WalkDir;

const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "tif", "ico", "avif",
];

const THUMBNAIL_SIZE: u32 = 200;

// ── Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageEntry {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size_bytes: u64,
    pub folder: String,
    pub modified: u64,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderNode {
    pub path: String,
    pub name: String,
    pub children: Vec<FolderNode>,
    pub image_count: usize,
}

#[derive(Debug, Default)]
pub struct AppState {
    pub root_path: Mutex<Option<String>>,
    pub images: Mutex<Vec<ImageEntry>>,
    pub settings: Mutex<HashMap<String, String>>,
    pub thumbnails: Mutex<HashMap<String, String>>,
}

// ── Helpers ────────────────────────────────────────────────────────────

fn is_image_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn build_folder_tree(root: &Path, images: &[ImageEntry]) -> FolderNode {
    let mut folder_images: HashMap<String, usize> = HashMap::new();
    for img in images {
        *folder_images.entry(img.folder.clone()).or_default() += 1;
    }

    fn build_node(dir: &Path, folder_images: &HashMap<String, usize>) -> FolderNode {
        let path_str = dir.to_string_lossy().to_string();
        let name = dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path_str.clone());

        let mut children: Vec<FolderNode> = Vec::new();
        if let Ok(entries) = fs::read_dir(dir) {
            let mut dirs: Vec<PathBuf> = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|ft| ft.is_dir()).unwrap_or(false))
                .filter(|e| {
                    !e.file_name()
                        .to_string_lossy()
                        .starts_with('.')
                })
                .map(|e| e.path())
                .collect();
            dirs.sort();
            for d in dirs {
                let child = build_node(&d, folder_images);
                // Only include folders that contain images (directly or in subtree)
                if child.image_count > 0 || child.children.iter().any(|c| has_images(c)) {
                    children.push(child);
                }
            }
        }

        let own_count = folder_images.get(&path_str).copied().unwrap_or(0);
        let total_count = own_count
            + children
                .iter()
                .map(|c| count_total_images(c))
                .sum::<usize>();

        FolderNode {
            path: path_str,
            name,
            children,
            image_count: total_count,
        }
    }

    fn has_images(node: &FolderNode) -> bool {
        node.image_count > 0 || node.children.iter().any(|c| has_images(c))
    }

    fn count_total_images(node: &FolderNode) -> usize {
        node.image_count
    }

    build_node(root, &folder_images)
}

fn generate_thumbnail(path: &str) -> Option<String> {
    // Skip SVG files — return None so the frontend uses the original
    if path.to_lowercase().ends_with(".svg") {
        return None;
    }

    let img = image::open(path).ok()?;
    let thumb = img.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, image::imageops::FilterType::Nearest);
    let mut buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buf);
    thumb
        .write_to(&mut cursor, image::ImageFormat::Png)
        .ok()?;
    Some(format!("data:image/png;base64,{}", STANDARD.encode(&buf)))
}

// ── Commands ───────────────────────────────────────────────────────────

#[tauri::command]
fn scan_folder(path: String, state: State<'_, Arc<AppState>>) -> Result<Vec<ImageEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("Path is not a directory".into());
    }

    let entries: Vec<ImageEntry> = WalkDir::new(&root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && is_image_file(e.path()))
        .filter_map(|e| {
            let path = e.path();
            let metadata = e.metadata().ok()?;
            let modified = metadata
                .modified()
                .ok()?
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?
                .as_secs();
            let (width, height) = image::image_dimensions(path).unwrap_or((0, 0));
            Some(ImageEntry {
                path: path.to_string_lossy().to_string(),
                name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                extension: path
                    .extension()
                    .map(|e| e.to_string_lossy().to_string().to_lowercase())
                    .unwrap_or_default(),
                size_bytes: metadata.len(),
                folder: path
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
                modified,
                width,
                height,
            })
        })
        .collect();

    *state.root_path.lock() = Some(path);
    *state.images.lock() = entries.clone();
    // Clear thumbnail cache for new scan
    state.thumbnails.lock().clear();

    Ok(entries)
}

#[tauri::command]
fn get_folder_tree(state: State<'_, Arc<AppState>>) -> Result<Option<FolderNode>, String> {
    let root = state.root_path.lock().clone();
    let images = state.images.lock().clone();

    match root {
        Some(path) => Ok(Some(build_folder_tree(Path::new(&path), &images))),
        None => Ok(None),
    }
}

#[tauri::command]
fn get_folder_images(folder_path: String, state: State<'_, Arc<AppState>>) -> Vec<ImageEntry> {
    let images = state.images.lock();
    images
        .iter()
        .filter(|img| img.folder == folder_path)
        .cloned()
        .collect()
}

#[tauri::command]
fn get_folder_images_recursive(
    folder_path: String,
    state: State<'_, Arc<AppState>>,
) -> Vec<ImageEntry> {
    let images = state.images.lock();
    images
        .iter()
        .filter(|img| img.path.starts_with(&folder_path))
        .cloned()
        .collect()
}

#[tauri::command]
fn search_images(query: String, state: State<'_, Arc<AppState>>) -> Vec<ImageEntry> {
    let images = state.images.lock();
    let q = query.to_lowercase();
    images
        .iter()
        .filter(|img| img.name.to_lowercase().contains(&q) || img.folder.to_lowercase().contains(&q))
        .cloned()
        .collect()
}

#[tauri::command]
fn get_thumbnail(path: String, state: State<'_, Arc<AppState>>) -> Option<String> {
    // Check cache first
    {
        let cache = state.thumbnails.lock();
        if let Some(thumb) = cache.get(&path) {
            return Some(thumb.clone());
        }
    }

    // Generate and cache
    let thumb = generate_thumbnail(&path)?;
    state
        .thumbnails
        .lock()
        .insert(path.clone(), thumb.clone());
    Some(thumb)
}

#[tauri::command]
fn get_thumbnails_batch(
    paths: Vec<String>,
    state: State<'_, Arc<AppState>>,
) -> HashMap<String, String> {
    let mut result = HashMap::new();
    let mut to_generate: Vec<String> = Vec::new();

    // Collect cached ones
    {
        let cache = state.thumbnails.lock();
        for path in &paths {
            if let Some(thumb) = cache.get(path) {
                result.insert(path.clone(), thumb.clone());
            } else {
                to_generate.push(path.clone());
            }
        }
    }

    // Generate missing in parallel
    let generated: Vec<(String, String)> = to_generate
        .par_iter()
        .filter_map(|path| {
            generate_thumbnail(path).map(|thumb| (path.clone(), thumb))
        })
        .collect();

    // Cache and add to result
    {
        let mut cache = state.thumbnails.lock();
        for (path, thumb) in generated {
            cache.insert(path.clone(), thumb.clone());
            result.insert(path, thumb);
        }
    }

    result
}

#[tauri::command]
fn get_image_base64(path: String) -> Result<String, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "tiff" | "tif" => "image/tiff",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        _ => "image/png",
    };
    Ok(format!("data:{};base64,{}", mime, STANDARD.encode(&data)))
}

#[tauri::command]
fn get_all_images(state: State<'_, Arc<AppState>>) -> Vec<ImageEntry> {
    state.images.lock().clone()
}

#[tauri::command]
fn get_setting(key: String, state: State<'_, Arc<AppState>>) -> Option<String> {
    state.settings.lock().get(&key).cloned()
}

#[tauri::command]
fn set_setting(key: String, value: String, state: State<'_, Arc<AppState>>) {
    state.settings.lock().insert(key, value);
}

#[tauri::command]
fn get_image_dimensions(path: String) -> Result<(u32, u32), String> {
    if path.to_lowercase().ends_with(".svg") {
        return Ok((0, 0)); // SVG dimensions not easily readable
    }
    let (w, h) = image::image_dimensions(&path).map_err(|e| e.to_string())?;
    Ok((w, h))
}

#[tauri::command]
fn open_containing_folder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let folder = if p.is_dir() { p } else { p.parent().unwrap_or(p) };
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub download_url: String,
    pub release_url: String,
}

#[tauri::command]
fn check_for_updates() -> Result<UpdateInfo, String> {
    let current = env!("CARGO_PKG_VERSION");
    let url = "https://api.github.com/repos/jjolmo/asset-browser/releases/latest";

    let output = std::process::Command::new("curl")
        .args(["-sL", "-H", "Accept: application/vnd.github.v3+json", url])
        .output()
        .map_err(|e| e.to_string())?;

    let body = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let tag = json["tag_name"].as_str().unwrap_or("v0.0.0");
    let latest = tag.trim_start_matches('v');
    let release_url = json["html_url"].as_str().unwrap_or("").to_string();

    // Find AppImage asset for Linux, or first asset
    let mut download_url = String::new();
    if let Some(assets) = json["assets"].as_array() {
        for asset in assets {
            let name = asset["name"].as_str().unwrap_or("");
            if name.ends_with(".AppImage") {
                download_url = asset["browser_download_url"].as_str().unwrap_or("").to_string();
                break;
            }
        }
        if download_url.is_empty() {
            if let Some(first) = assets.first() {
                download_url = first["browser_download_url"].as_str().unwrap_or("").to_string();
            }
        }
    }

    let has_update = latest != current;

    Ok(UpdateInfo {
        current_version: current.to_string(),
        latest_version: latest.to_string(),
        has_update,
        download_url,
        release_url,
    })
}

#[tauri::command]
fn create_desktop_entry(app_handle: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;

        // Resolve the actual executable path
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe_path.to_string_lossy().to_string();

        // Copy icon to ~/.local/share/icons/
        let icons_dir = PathBuf::from(&home).join(".local/share/icons");
        fs::create_dir_all(&icons_dir).map_err(|e| e.to_string())?;
        let icon_dest = icons_dir.join("asset-browser.png");

        // Use the bundled icon from the resource path
        let resource_path = app_handle.path()
            .resource_dir()
            .map_err(|e| e.to_string())?;
        let icon_src = resource_path.join("icons/128x128.png");
        if icon_src.exists() {
            fs::copy(&icon_src, &icon_dest).map_err(|e| e.to_string())?;
        }

        // Create .desktop file
        let apps_dir = PathBuf::from(&home).join(".local/share/applications");
        fs::create_dir_all(&apps_dir).map_err(|e| e.to_string())?;
        let desktop_path = apps_dir.join("asset-browser.desktop");

        let content = format!(
            "[Desktop Entry]\n\
             Type=Application\n\
             Name=Asset Browser\n\
             Comment=Browse and preview image assets\n\
             Exec={exe_str}\n\
             Icon=asset-browser\n\
             Terminal=false\n\
             Categories=Graphics;Development;\n\
             StartupWMClass=asset-browser\n",
        );

        fs::write(&desktop_path, content).map_err(|e| e.to_string())?;

        // Make executable
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = std::fs::Permissions::from_mode(0o755);
            fs::set_permissions(&desktop_path, perms).map_err(|e| e.to_string())?;
        }

        Ok(desktop_path.to_string_lossy().to_string())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app_handle;
        Err("Desktop entries are only supported on Linux".to_string())
    }
}

// ── App Setup ──────────────────────────────────────────────────────────

pub fn run() {
    let state = Arc::new(AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            get_folder_tree,
            get_folder_images,
            get_folder_images_recursive,
            search_images,
            get_thumbnail,
            get_thumbnails_batch,
            get_image_base64,
            get_all_images,
            get_setting,
            set_setting,
            get_image_dimensions,
            open_containing_folder,
            create_desktop_entry,
            check_for_updates,
        ])
        .setup(|app| {
            // Show main window after setup
            let window = app.get_webview_window("main").unwrap();
            window.show().unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
