#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";

// src/commands/init.ts
import { promises as fs } from "fs";
import path from "path";
import prompts from "prompts";
async function readJsonIfExists(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function initCommand(program2) {
  program2.command("init").description("Initialize updater.config.json for tauri-easy-updater").action(async () => {
    const cwd = process.cwd();
    const tauriConfPath = path.join(cwd, "tauri.conf.json");
    const tauriConf = await readJsonIfExists(tauriConfPath);
    if (!tauriConf) {
      console.error("tauri.conf.json not found in current directory.");
    }
    const appName = tauriConf?.package?.productName ?? "";
    const version = tauriConf?.package?.version ?? "";
    console.log(`Detected appName="${appName}" version="${version}" (if available).`);
    const response = await prompts([
      {
        type: "text",
        name: "owner",
        message: "GitHub owner:",
        validate: (value) => value.trim() ? true : "Owner is required"
      },
      {
        type: "text",
        name: "repo",
        message: "GitHub repository name:",
        validate: (value) => value.trim() ? true : "Repository is required"
      }
    ]);
    if (!response.owner || !response.repo) {
      console.error("Initialization cancelled.");
      return;
    }
    const updaterConfigPath = path.join(cwd, "updater.config.json");
    const existing = await readJsonIfExists(updaterConfigPath);
    const newConfig = {
      provider: "github",
      github: {
        owner: response.owner,
        repo: response.repo
      },
      manifestFileName: existing?.manifestFileName ?? "update-manifest.json"
    };
    await fs.writeFile(updaterConfigPath, `${JSON.stringify(newConfig, null, 2)}
`, "utf8");
    console.log(`Created ${path.relative(cwd, updaterConfigPath)}`);
  });
}

// src/commands/generate-manifest.ts
import { promises as fs2 } from "fs";
import path2 from "path";
async function detectVersion(cwd, explicit) {
  if (explicit) return explicit;
  const tauriConfPath = path2.join(cwd, "tauri.conf.json");
  try {
    const raw = await fs2.readFile(tauriConfPath, "utf8");
    const json = JSON.parse(raw);
    if (json.package?.version) {
      return json.package.version;
    }
  } catch {
  }
  const cargoPath = path2.join(cwd, "Cargo.toml");
  try {
    const raw = await fs2.readFile(cargoPath, "utf8");
    const match = raw.match(/version\s*=\s*\"([^\"]+)\"/);
    if (match) {
      return match[1];
    }
  } catch {
  }
  throw new Error("Could not detect version. Use --version or configure tauri.conf.json/Cargo.toml.");
}
async function readNotes(cwd, opts) {
  if (opts.notes) return opts.notes;
  if (opts.notesFile) {
    const full = path2.isAbsolute(opts.notesFile) ? opts.notesFile : path2.join(cwd, opts.notesFile);
    return fs2.readFile(full, "utf8");
  }
  const changelog = path2.join(cwd, "CHANGELOG.md");
  try {
    return await fs2.readFile(changelog, "utf8");
  } catch {
    return "Release notes not provided.";
  }
}
async function detectArtifacts(artifactsDir) {
  const entries = [];
  async function walk(dir) {
    let items;
    try {
      items = await fs2.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const full = path2.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.isFile()) {
        const rel = full.replace(/\\/g, "/");
        const lower = rel.toLowerCase();
        if (lower.includes("/nsis/") && lower.endsWith(".exe")) {
          entries.push({ platform: "windows-x86_64", filename: path2.basename(rel) });
        } else if (lower.includes("/msi/") && lower.endsWith(".msi")) {
          entries.push({ platform: "windows-x86_64", filename: path2.basename(rel) });
        } else if (lower.includes("/dmg/") && lower.endsWith(".dmg")) {
          const name = path2.basename(rel).toLowerCase();
          const platform = name.includes("arm64") || name.includes("aarch64") ? "darwin-aarch64" : "darwin-x86_64";
          entries.push({ platform, filename: path2.basename(rel) });
        } else if (lower.includes("/appimage/") && lower.endsWith(".appimage")) {
          entries.push({ platform: "linux-x86_64", filename: path2.basename(rel) });
        } else if (lower.includes("/deb/") && lower.endsWith(".deb")) {
          entries.push({ platform: "linux-x86_64", filename: path2.basename(rel) });
        }
      }
    }
  }
  await walk(artifactsDir);
  return entries;
}
function generateManifestCommand(program2) {
  program2.command("generate-manifest").description("Generate update-manifest.json for tauri-easy-updater").option("--version <version>", "Version to use for the manifest").option(
    "--artifacts-dir <dir>",
    "Directory containing Tauri artifacts",
    "./src-tauri/target/release/bundle"
  ).option("--notes <text>", "Release notes text").option("--notes-file <path>", "Path to a markdown file with release notes").option("--base-url <url>", "Base URL where artifacts will be hosted").option("--output <path>", "Output manifest path", "./update-manifest.json").action(async (opts) => {
    const cwd = process.cwd();
    const version = await detectVersion(cwd, opts.version);
    const notes = await readNotes(cwd, opts);
    if (!opts.baseUrl) {
      console.error("--base-url is required");
      process.exitCode = 1;
      return;
    }
    const artifactsDir = path2.isAbsolute(opts.artifactsDir) ? opts.artifactsDir : path2.join(cwd, opts.artifactsDir);
    const detected = await detectArtifacts(artifactsDir);
    if (detected.length === 0) {
      console.warn("No artifacts detected in", artifactsDir);
    }
    const platforms = {};
    for (const entry of detected) {
      const url = `${opts.baseUrl.replace(/\/+$/, "")}/${entry.filename}`;
      platforms[entry.platform] = { url };
      console.log(`\u2713 Detected: ${entry.platform} \u2192 ${entry.filename}`);
    }
    const manifest = {
      version,
      pub_date: (/* @__PURE__ */ new Date()).toISOString(),
      notes,
      platforms
    };
    const outPath = path2.isAbsolute(opts.output) ? opts.output : path2.join(cwd, opts.output);
    await fs2.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}
`, "utf8");
    console.log(`\u2713 Generated: ${path2.relative(cwd, outPath)}`);
  });
}

// src/commands/publish.ts
import { promises as fs3 } from "fs";
import path3 from "path";
import https from "https";
import { URL } from "url";
function readJson(filePath) {
  return fs3.readFile(filePath, "utf8").then((t) => JSON.parse(t));
}
async function resolveRepo(cwd, explicit) {
  if (explicit) {
    const [owner, repo] = explicit.split("/");
    if (!owner || !repo) {
      throw new Error("--repo must be in the form owner/repo");
    }
    return { owner, repo };
  }
  const updaterPath = path3.join(cwd, "updater.config.json");
  const conf = await readJson(updaterPath).catch(() => null);
  if (conf?.github?.owner && conf.github.repo) {
    return { owner: conf.github.owner, repo: conf.github.repo };
  }
  throw new Error("Repository not specified. Use --repo or configure updater.config.json");
}
async function resolveTag(cwd, manifestPath, explicit) {
  if (explicit) return explicit;
  const manifest = await readJson(manifestPath);
  return `v${manifest.version}`;
}
function githubRequest(token, method, urlStr, body, extraHeaders) {
  const urlObj = new URL(urlStr);
  const headers = {
    "User-Agent": "tauri-easy-updater-cli",
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    ...extraHeaders
  };
  const options = {
    method,
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    headers
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          if (!text) {
            resolve({});
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(
            new Error(
              `GitHub API ${method} ${urlStr} failed with status ${res.statusCode}: ${text}`
            )
          );
        }
      });
    });
    req.on("error", (err) => reject(err));
    if (body !== void 0) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}
async function uploadAsset(token, owner, repo, releaseId, name, content) {
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(
    name
  )}`;
  const urlObj = new URL(uploadUrl);
  const options = {
    method: "POST",
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    headers: {
      "User-Agent": "tauri-easy-updater-cli",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Length": content.length.toString()
    }
  };
  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          const text = Buffer.concat(chunks).toString("utf8");
          reject(
            new Error(
              `GitHub asset upload failed with status ${res.statusCode}: ${text}`
            )
          );
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.write(content);
    req.end();
  });
}
function publishCommand(program2) {
  program2.command("publish").description("Upload update manifest as a GitHub Release asset").option("--manifest <path>", "Path to manifest JSON", "./update-manifest.json").option("--token <token>", "GitHub token (or use GITHUB_TOKEN env)").option("--tag <tag>", "Git tag for the release (defaults to v{version})").option("--repo <owner/repo>", "GitHub repo (owner/repo)").action(async (opts) => {
    const cwd = process.cwd();
    const manifestPath = path3.isAbsolute(opts.manifest) ? opts.manifest : path3.join(cwd, opts.manifest);
    const token = opts.token || process.env.GITHUB_TOKEN;
    if (!token) {
      console.error("GitHub token is required (--token or GITHUB_TOKEN env)");
      process.exitCode = 1;
      return;
    }
    const { owner, repo } = await resolveRepo(cwd, opts.repo);
    const tag = await resolveTag(cwd, manifestPath, opts.tag);
    const release = await githubRequest(
      token,
      "GET",
      `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`
    );
    const content = await fs3.readFile(manifestPath);
    const assetName = path3.basename(manifestPath);
    await uploadAsset(token, owner, repo, release.id, assetName, content);
    console.log(
      `\u2713 Uploaded ${assetName} to release ${tag} in ${owner}/${repo}`
    );
  });
}

// src/index.ts
var program = new Command();
program.name("tauri-eu").description("CLI for tauri-easy-updater").version("0.1.0");
initCommand(program);
generateManifestCommand(program);
publishCommand(program);
program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
//# sourceMappingURL=index.mjs.map