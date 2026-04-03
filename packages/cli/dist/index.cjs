#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_commander = require("commander");

// src/commands/init.ts
var import_fs = require("fs");
var import_path = __toESM(require("path"), 1);
var import_prompts = __toESM(require("prompts"), 1);
async function readJsonIfExists(filePath) {
  try {
    const content = await import_fs.promises.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function initCommand(program2) {
  program2.command("init").description("Initialize updater.config.json for tauri-easy-updater").action(async () => {
    const cwd = process.cwd();
    const tauriConfPath = import_path.default.join(cwd, "tauri.conf.json");
    const tauriConf = await readJsonIfExists(tauriConfPath);
    if (!tauriConf) {
      console.error("tauri.conf.json not found in current directory.");
    }
    const appName = tauriConf?.package?.productName ?? "";
    const version = tauriConf?.package?.version ?? "";
    console.log(`Detected appName="${appName}" version="${version}" (if available).`);
    const response = await (0, import_prompts.default)([
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
    const updaterConfigPath = import_path.default.join(cwd, "updater.config.json");
    const existing = await readJsonIfExists(updaterConfigPath);
    const newConfig = {
      provider: "github",
      github: {
        owner: response.owner,
        repo: response.repo
      },
      manifestFileName: existing?.manifestFileName ?? "update-manifest.json"
    };
    await import_fs.promises.writeFile(updaterConfigPath, `${JSON.stringify(newConfig, null, 2)}
`, "utf8");
    console.log(`Created ${import_path.default.relative(cwd, updaterConfigPath)}`);
  });
}

// src/commands/generate-manifest.ts
var import_fs2 = require("fs");
var import_path2 = __toESM(require("path"), 1);
async function detectVersion(cwd, explicit) {
  if (explicit) return explicit;
  const tauriConfPath = import_path2.default.join(cwd, "tauri.conf.json");
  try {
    const raw = await import_fs2.promises.readFile(tauriConfPath, "utf8");
    const json = JSON.parse(raw);
    if (json.package?.version) {
      return json.package.version;
    }
  } catch {
  }
  const cargoPath = import_path2.default.join(cwd, "Cargo.toml");
  try {
    const raw = await import_fs2.promises.readFile(cargoPath, "utf8");
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
    const full = import_path2.default.isAbsolute(opts.notesFile) ? opts.notesFile : import_path2.default.join(cwd, opts.notesFile);
    return import_fs2.promises.readFile(full, "utf8");
  }
  const changelog = import_path2.default.join(cwd, "CHANGELOG.md");
  try {
    return await import_fs2.promises.readFile(changelog, "utf8");
  } catch {
    return "Release notes not provided.";
  }
}
async function detectArtifacts(artifactsDir) {
  const entries = [];
  async function walk(dir) {
    let items;
    try {
      items = await import_fs2.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const full = import_path2.default.join(dir, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.isFile()) {
        const rel = full.replace(/\\/g, "/");
        const lower = rel.toLowerCase();
        if (lower.includes("/nsis/") && lower.endsWith(".exe")) {
          entries.push({ platform: "windows-x86_64", filename: import_path2.default.basename(rel) });
        } else if (lower.includes("/msi/") && lower.endsWith(".msi")) {
          entries.push({ platform: "windows-x86_64", filename: import_path2.default.basename(rel) });
        } else if (lower.includes("/dmg/") && lower.endsWith(".dmg")) {
          const name = import_path2.default.basename(rel).toLowerCase();
          const platform = name.includes("arm64") || name.includes("aarch64") ? "darwin-aarch64" : "darwin-x86_64";
          entries.push({ platform, filename: import_path2.default.basename(rel) });
        } else if (lower.includes("/appimage/") && lower.endsWith(".appimage")) {
          entries.push({ platform: "linux-x86_64", filename: import_path2.default.basename(rel) });
        } else if (lower.includes("/deb/") && lower.endsWith(".deb")) {
          entries.push({ platform: "linux-x86_64", filename: import_path2.default.basename(rel) });
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
    const artifactsDir = import_path2.default.isAbsolute(opts.artifactsDir) ? opts.artifactsDir : import_path2.default.join(cwd, opts.artifactsDir);
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
    const outPath = import_path2.default.isAbsolute(opts.output) ? opts.output : import_path2.default.join(cwd, opts.output);
    await import_fs2.promises.writeFile(outPath, `${JSON.stringify(manifest, null, 2)}
`, "utf8");
    console.log(`\u2713 Generated: ${import_path2.default.relative(cwd, outPath)}`);
  });
}

// src/commands/publish.ts
var import_fs3 = require("fs");
var import_path3 = __toESM(require("path"), 1);
var import_https = __toESM(require("https"), 1);
var import_url = require("url");
function readJson(filePath) {
  return import_fs3.promises.readFile(filePath, "utf8").then((t) => JSON.parse(t));
}
async function resolveRepo(cwd, explicit) {
  if (explicit) {
    const [owner, repo] = explicit.split("/");
    if (!owner || !repo) {
      throw new Error("--repo must be in the form owner/repo");
    }
    return { owner, repo };
  }
  const updaterPath = import_path3.default.join(cwd, "updater.config.json");
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
  const urlObj = new import_url.URL(urlStr);
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
    const req = import_https.default.request(options, (res) => {
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
  const urlObj = new import_url.URL(uploadUrl);
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
    const req = import_https.default.request(options, (res) => {
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
    const manifestPath = import_path3.default.isAbsolute(opts.manifest) ? opts.manifest : import_path3.default.join(cwd, opts.manifest);
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
    const content = await import_fs3.promises.readFile(manifestPath);
    const assetName = import_path3.default.basename(manifestPath);
    await uploadAsset(token, owner, repo, release.id, assetName, content);
    console.log(
      `\u2713 Uploaded ${assetName} to release ${tag} in ${owner}/${repo}`
    );
  });
}

// src/index.ts
var program = new import_commander.Command();
program.name("tauri-eu").description("CLI for tauri-easy-updater").version("0.1.0");
initCommand(program);
generateManifestCommand(program);
publishCommand(program);
program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
//# sourceMappingURL=index.cjs.map