//! Tauri plugin for easy, key-less application updates.
//!
//! Compatible with Tauri 1.x. The API is designed to remain
//! forward-compatible with Tauri 2.x, but integration details
//! may change in future versions.

mod commands;
mod providers;
pub mod types;

use tauri::{
    plugin::{Builder, TauriPlugin},
    Runtime,
};

/// Initialize the `tauri-easy-updater` plugin.
///
/// # Example
/// ```no_run
/// fn main() {
///   tauri::Builder::default()
///       .plugin(tauri_easy_updater::init())
///       .run(tauri::generate_context!())
///       .expect("error while running tauri application");
/// }
/// ```
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("easy-updater")
        .invoke_handler(tauri::generate_handler![
            commands::check_update,
            commands::open_url,
        ])
        .build()
}

