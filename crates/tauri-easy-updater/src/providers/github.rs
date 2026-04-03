use reqwest::blocking::Client;
use reqwest::Url;
use serde::Deserialize;

use crate::types::{PlatformInfo, UpdateManifest};

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    published_at: String,
    body: String,
    assets: Vec<GitHubAsset>,
}

pub fn fetch_manifest_from_github(
    owner: &str,
    repo: &str,
    manifest_url: &str,
) -> Result<UpdateManifest, String> {
    let client = Client::builder()
        .user_agent("tauri-easy-updater")
        .build()
        .map_err(|e| e.to_string())?;

    // First try manifest asset URL
    if !manifest_url.is_empty() {
        if let Ok(url) = Url::parse(manifest_url) {
            if let Ok(resp) = client.get(url).send() {
                if resp.status().is_success() {
                    let manifest = resp
                        .json::<UpdateManifest>()
                        .map_err(|e| format!("Failed to parse manifest: {e}"))?;
                    return Ok(manifest);
                }
            }
        }
    }

    // Fallback to GitHub Releases API
    let api_url = format!(
        "https://api.github.com/repos/{owner}/{repo}/releases/latest",
    );

    let resp = client
        .get(api_url)
        .send()
        .map_err(|e| format!("GitHub API request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let release = resp
        .json::<GitHubRelease>()
        .map_err(|e| format!("Failed to parse GitHub release: {e}"))?;

    let platform_key = current_platform_key();
    let mut platforms = std::collections::HashMap::new();

    if let Some(asset) = select_asset_for_platform(&release.assets, &platform_key) {
        platforms.insert(
            platform_key.clone(),
            PlatformInfo {
                url: asset.browser_download_url.clone(),
            },
        );
    }

    Ok(UpdateManifest {
        version: release.tag_name,
        pub_date: release.published_at,
        notes: release.body,
        platforms,
    })
}

fn current_platform_key() -> String {
    let os = match std::env::consts::OS {
        "windows" => "windows",
        "macos" => "darwin",
        "linux" => "linux",
        other => other,
    };

    let arch = match std::env::consts::ARCH {
        "x86_64" => "x86_64",
        "aarch64" => "aarch64",
        other => other,
    };

    format!("{os}-{arch}")
}

fn select_asset_for_platform<'a>(
    assets: &'a [GitHubAsset],
    platform: &str,
) -> Option<&'a GitHubAsset> {
    let platform = platform.to_lowercase();

    assets.iter().find(|asset| {
        let name = asset.name.to_lowercase();
        if platform == "windows-x86_64" {
            name.ends_with(".exe") || name.ends_with(".msi")
        } else if platform == "darwin-x86_64" {
            name.ends_with(".dmg") && !name.contains("arm64") && !name.contains("aarch64")
        } else if platform == "darwin-aarch64" {
            name.ends_with(".dmg") && (name.contains("arm64") || name.contains("aarch64"))
        } else if platform == "linux-x86_64" {
            name.ends_with(".appimage") || name.ends_with(".AppImage") || name.ends_with(".deb")
        } else {
            false
        }
    })
}

