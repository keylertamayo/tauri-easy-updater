use std::process::Command;

use semver::Version;
use tauri::command;

use crate::providers::{github::fetch_manifest_from_github, http::fetch_manifest};
use crate::types::{CheckUpdateParams, PlatformInfo, UpdateInfo, UpdateManifest};

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

fn parse_version(s: &str) -> Result<Version, String> {
    let trimmed = s.trim().trim_start_matches('v').trim_start_matches('V');
    Version::parse(trimmed).map_err(|e| e.to_string())
}

fn select_platform<'a>(
    manifest: &'a UpdateManifest,
    platform_key: &str,
) -> Option<&'a PlatformInfo> {
    manifest.platforms.get(platform_key)
}

#[command]
pub fn check_update(params: CheckUpdateParams) -> Result<UpdateInfo, String> {
    let platform_key = current_platform_key();

    let manifest: UpdateManifest = if let (Some(owner), Some(repo)) =
        (params.github_owner.as_deref(), params.github_repo.as_deref())
    {
        fetch_manifest_from_github(owner, repo, &params.manifest_url)?
    } else {
        fetch_manifest(&params.manifest_url)?
    };

    let current_version = parse_version(&params.current_version)?;
    let latest_version = parse_version(&manifest.version)?;

    let has_update = latest_version > current_version;

    let platform_info = select_platform(&manifest, &platform_key)
        .ok_or_else(|| format!("No platform info for {platform_key}"))?;

    let download_url = platform_info.url.clone();
    let latest_version = manifest.version.clone();
    let release_notes = manifest.notes.clone();
    let pub_date = manifest.pub_date.clone();

    Ok(UpdateInfo {
        has_update,
        current_version: params.current_version,
        latest_version,
        download_url,
        release_notes,
        pub_date,
    })
}

#[command]
pub fn open_url(url: String) -> Result<(), String> {
    if url.is_empty() {
        return Err("URL is empty".into());
    }

    let result = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(&url).spawn()
    } else {
        Command::new("xdg-open").arg(&url).spawn()
    };

    result.map(|_| ()).map_err(|e| e.to_string())
}

