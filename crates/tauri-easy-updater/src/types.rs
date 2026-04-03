use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateManifest {
    pub version: String,
    pub pub_date: String,
    pub notes: String,
    pub platforms: HashMap<String, PlatformInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlatformInfo {
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes: String,
    pub pub_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckUpdateParams {
    pub current_version: String,
    pub manifest_url: String,
    pub github_owner: Option<String>,
    pub github_repo: Option<String>,
}

