use reqwest::blocking::Client;
use reqwest::Url;

use crate::types::UpdateManifest;

pub fn fetch_manifest(manifest_url: &str) -> Result<UpdateManifest, String> {
    let url = Url::parse(manifest_url).map_err(|e| e.to_string())?;
    let client = Client::builder()
        .user_agent("tauri-easy-updater")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(url).send().map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP error: {}", resp.status()));
    }

    resp.json::<UpdateManifest>()
        .map_err(|e| format!("Failed to parse manifest: {e}"))
}

