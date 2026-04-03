"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  UpdateBanner: () => UpdateBanner,
  UpdateModal: () => UpdateModal,
  createGitHubProvider: () => createGitHubProvider,
  createHttpProvider: () => createHttpProvider,
  createS3Provider: () => createS3Provider,
  getCurrentPlatform: () => getCurrentPlatform,
  isNewerVersion: () => isNewerVersion,
  useUpdateChecker: () => useUpdateChecker
});
module.exports = __toCommonJS(index_exports);

// src/utils/platform.ts
async function getCurrentPlatform() {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const os = await import("@tauri-apps/api/os");
    const type = await os.type();
    const arch = await os.arch();
    const normalizedOs = normalizeOs(type);
    const normalizedArch = normalizeArch(arch);
    if (!normalizedOs || !normalizedArch) {
      return "";
    }
    return `${normalizedOs}-${normalizedArch}`;
  } catch {
    return "";
  }
}
function normalizeOs(os) {
  const lower = os.toLowerCase();
  if (lower.startsWith("win")) return "windows";
  if (lower.startsWith("mac")) return "darwin";
  if (lower.startsWith("linux")) return "linux";
  return "";
}
function normalizeArch(arch) {
  const lower = arch.toLowerCase();
  if (lower === "x86_64" || lower === "x64" || lower === "amd64") {
    return "x86_64";
  }
  if (lower === "aarch64" || lower === "arm64") {
    return "aarch64";
  }
  return "";
}

// src/utils/semver.ts
function parseVersion(input) {
  let v = input.trim();
  if (v.startsWith("v") || v.startsWith("V")) {
    v = v.slice(1);
  }
  const [core, prerelease] = v.split("-", 2);
  const parts = core.split(".");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }
  const [majStr, minStr, patchStr = "0"] = parts;
  const major = Number(majStr);
  const minor = Number(minStr);
  const patch = Number(patchStr);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }
  return {
    major,
    minor,
    patch,
    prerelease: prerelease ?? null
  };
}
function comparePrerelease(a, b) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const aParts = a.split(".");
  const bParts = b.split(".");
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i += 1) {
    const ai = aParts[i];
    const bi = bParts[i];
    if (ai === void 0) return -1;
    if (bi === void 0) return 1;
    const aNum = Number(ai);
    const bNum = Number(bi);
    const aIsNum = Number.isFinite(aNum);
    const bIsNum = Number.isFinite(bNum);
    if (aIsNum && bIsNum) {
      if (aNum > bNum) return 1;
      if (aNum < bNum) return -1;
    } else if (aIsNum && !bIsNum) {
      return -1;
    } else if (!aIsNum && bIsNum) {
      return 1;
    } else {
      if (ai > bi) return 1;
      if (ai < bi) return -1;
    }
  }
  return 0;
}
function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  if (a.patch !== b.patch) return a.patch > b.patch;
  return comparePrerelease(a.prerelease, b.prerelease) > 0;
}

// src/providers/github.ts
function createGitHubProvider(config) {
  const {
    owner,
    repo,
    manifestAssetName = "update-manifest.json",
    fallbackToReleaseApi = true
  } = config;
  const manifestUrl = `https://github.com/${owner}/${repo}/releases/latest/download/${manifestAssetName}`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const provider = {
    type: "github",
    async fetchManifest() {
      try {
        const res = await fetch(manifestUrl);
        if (res.ok) {
          const data = await res.json();
          return data;
        }
        if (!fallbackToReleaseApi || res.status !== 404) {
          throw new Error(`GitHub manifest request failed with status ${res.status}`);
        }
      } catch (err) {
        if (!fallbackToReleaseApi) {
          throw err instanceof Error ? err : new Error("Failed to fetch GitHub manifest");
        }
      }
      try {
        const res = await fetch(apiUrl, {
          headers: {
            Accept: "application/vnd.github+json"
          }
        });
        if (!res.ok) {
          throw new Error(`GitHub releases API failed with status ${res.status}`);
        }
        const release = await res.json();
        const platform = await getCurrentPlatform();
        let url = "";
        if (platform) {
          const asset = selectAssetForPlatform(release.assets, platform);
          if (asset) {
            url = asset.browser_download_url;
          }
        }
        const manifest = {
          version: release.tag_name,
          pub_date: release.published_at,
          notes: release.body ?? "",
          platforms: url ? {
            [platform]: {
              url
            }
          } : {}
        };
        return manifest;
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to fetch GitHub release");
      }
    }
  };
  provider.__tauriParams = {
    github_owner: owner,
    github_repo: repo,
    manifest_url: manifestUrl
  };
  return provider;
}
function selectAssetForPlatform(assets, platform) {
  if (!platform) return void 0;
  const lowerPlatform = platform.toLowerCase();
  return assets.find((asset) => {
    const name = asset.name.toLowerCase();
    if (lowerPlatform === "windows-x86_64") {
      return name.endsWith(".exe") || name.endsWith(".msi");
    }
    if (lowerPlatform === "darwin-x86_64") {
      return name.endsWith(".dmg") && !name.includes("arm64") && !name.includes("aarch64");
    }
    if (lowerPlatform === "darwin-aarch64") {
      return name.endsWith(".dmg") && (name.includes("arm64") || name.includes("aarch64"));
    }
    if (lowerPlatform === "linux-x86_64") {
      return name.endsWith(".appimage") || name.endsWith(".AppImage") || name.endsWith(".deb") || name.endsWith(".rpm");
    }
    return false;
  });
}

// src/providers/http.ts
function createHttpProvider(config) {
  const { manifestUrl, headers } = config;
  const provider = {
    type: "http",
    async fetchManifest() {
      const init = {
        method: "GET",
        headers
      };
      try {
        const res = await fetch(manifestUrl, init);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        return data;
      } catch (error) {
        throw error instanceof Error ? error : new Error("Failed to fetch update manifest");
      }
    }
  };
  provider.__tauriParams = { manifest_url: manifestUrl };
  return provider;
}

// src/providers/s3.ts
function createS3Provider(config) {
  const { bucketUrl, manifestPath = "latest/update-manifest.json" } = config;
  const manifestUrl = `${bucketUrl.replace(/\/+$/, "")}/${manifestPath.replace(/^\/+/, "")}`;
  const httpProvider = createHttpProvider({ manifestUrl });
  const provider = {
    type: "s3",
    async fetchManifest() {
      return httpProvider.fetchManifest();
    }
  };
  provider.__tauriParams = { manifest_url: manifestUrl };
  return provider;
}

// src/hooks/useUpdateChecker.ts
var import_react = require("react");
var SESSION_DISMISS_KEY = "tauri-easy-updater:dismissed-version";
function getDismissedVersion() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(SESSION_DISMISS_KEY);
  } catch {
    return null;
  }
}
function setDismissedVersion(version) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, version);
  } catch {
  }
}
function buildParamsFromProvider(provider, currentVersion) {
  const anyProvider = provider;
  const base = {
    current_version: currentVersion,
    manifest_url: ""
  };
  if (!anyProvider.__tauriParams) {
    return null;
  }
  const { manifest_url, github_owner, github_repo } = anyProvider.__tauriParams;
  if (github_owner && github_repo) {
    return {
      ...base,
      manifest_url: manifest_url ?? "",
      github_owner,
      github_repo
    };
  }
  if (manifest_url) {
    return {
      ...base,
      manifest_url,
      github_owner: null,
      github_repo: null
    };
  }
  return null;
}
function useUpdateChecker(config) {
  const {
    currentVersion,
    provider,
    checkOnStartup = true,
    checkIntervalMs = 0,
    silent = false
  } = config;
  const [updateInfo, setUpdateInfo] = (0, import_react.useState)(null);
  const [isChecking, setIsChecking] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const [isDismissed, setIsDismissed] = (0, import_react.useState)(false);
  const intervalRef = (0, import_react.useRef)(null);
  const mountedRef = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    mountedRef.current = true;
    const dismissed = getDismissedVersion();
    if (dismissed) {
      setIsDismissed(true);
    }
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null && typeof window !== "undefined") {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);
  const canUseTauri = typeof window !== "undefined";
  const checkNow = (0, import_react.useCallback)(async () => {
    if (!canUseTauri) {
      return;
    }
    const params = buildParamsFromProvider(provider, currentVersion);
    if (!params) {
      try {
        setIsChecking(true);
        setError(null);
        const manifest = await provider.fetchManifest();
        const platformInfo = Object.values(manifest.platforms)[0];
        if (!platformInfo) {
          if (!silent) {
            setError(new Error("No platform information in manifest"));
          }
          setUpdateInfo(null);
          return;
        }
        const info = {
          hasUpdate: true,
          currentVersion,
          latestVersion: manifest.version,
          downloadUrl: platformInfo.url,
          releaseNotes: manifest.notes,
          pubDate: manifest.pub_date
        };
        if (!mountedRef.current) return;
        setUpdateInfo(info);
      } catch (e) {
        if (!mountedRef.current) return;
        if (!silent) {
          setError(e instanceof Error ? e : new Error("Failed to check for updates"));
        }
      } finally {
        if (mountedRef.current) {
          setIsChecking(false);
        }
      }
      return;
    }
    try {
      setIsChecking(true);
      setError(null);
      const { invoke } = await import("@tauri-apps/api/tauri");
      const result = await invoke("plugin:easy-updater|check_update", {
        params
      });
      if (!mountedRef.current) return;
      const dismissed = getDismissedVersion();
      if (dismissed && dismissed === result.latestVersion) {
        setIsDismissed(true);
        setUpdateInfo(result);
        return;
      }
      setUpdateInfo(result);
    } catch (e) {
      if (!mountedRef.current) return;
      if (!silent) {
        setError(e instanceof Error ? e : new Error("Failed to check for updates"));
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  }, [canUseTauri, provider, currentVersion, silent]);
  (0, import_react.useEffect)(() => {
    if (!checkOnStartup) {
      return;
    }
    void checkNow();
  }, [checkOnStartup, checkNow]);
  (0, import_react.useEffect)(() => {
    if (checkIntervalMs <= 0 || typeof window === "undefined") {
      return;
    }
    const id = window.setInterval(() => {
      void checkNow();
    }, checkIntervalMs);
    intervalRef.current = id;
    return () => {
      window.clearInterval(id);
    };
  }, [checkIntervalMs, checkNow]);
  const dismiss = (0, import_react.useCallback)(() => {
    if (updateInfo) {
      setDismissedVersion(updateInfo.latestVersion);
    }
    setIsDismissed(true);
  }, [updateInfo]);
  const value = (0, import_react.useMemo)(
    () => ({
      updateInfo,
      isChecking,
      error,
      checkNow,
      dismiss,
      isDismissed
    }),
    [updateInfo, isChecking, error, checkNow, dismiss, isDismissed]
  );
  return value;
}

// src/components/UpdateBanner.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function resolveTheme(theme = "auto") {
  if (theme === "auto" && typeof window !== "undefined" && "matchMedia" in window) {
    try {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch {
    }
  }
  return theme === "auto" ? "light" : theme;
}
async function openUrl(url) {
  if (typeof window === "undefined") return;
  try {
    const { invoke } = await import("@tauri-apps/api/tauri");
    await invoke("plugin:easy-updater|open_url", { url });
  } catch {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
    }
  }
}
function UpdateBanner(props) {
  const { updateInfo, onDismiss, position = "bottom", theme = "auto", className } = props;
  const resolvedTheme = resolveTheme(theme);
  const base = {
    position: "fixed",
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
    zIndex: 50
  };
  const positionStyle = position === "top" ? {
    top: 0
  } : {
    bottom: 0
  };
  const themeStyle = resolvedTheme === "dark" ? {
    backgroundColor: "rgba(15,23,42,0.95)",
    color: "white",
    borderTop: position === "bottom" ? "1px solid rgba(148,163,184,0.5)" : void 0,
    borderBottom: position === "top" ? "1px solid rgba(148,163,184,0.5)" : void 0
  } : {
    backgroundColor: "rgba(248,250,252,0.98)",
    color: "#020617",
    borderTop: position === "bottom" ? "1px solid #e2e8f0" : void 0,
    borderBottom: position === "top" ? "1px solid #e2e8f0" : void 0
  };
  const buttonStyle = resolvedTheme === "dark" ? {
    backgroundColor: "#22c55e",
    color: "#022c22"
  } : {
    backgroundColor: "#16a34a",
    color: "white"
  };
  const secondaryButtonStyle = resolvedTheme === "dark" ? {
    color: "#e5e7eb"
  } : {
    color: "#4b5563"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...base, ...positionStyle, ...themeStyle }, className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "0.125rem" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontWeight: 500 }, children: [
        "Nueva versi\xF3n ",
        updateInfo.latestVersion,
        " disponible"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { opacity: 0.8 }, children: [
        "Est\xE1s usando la versi\xF3n ",
        updateInfo.currentVersion,
        ". Descarga la \xFAltima actualizaci\xF3n."
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          style: {
            ...buttonStyle,
            borderRadius: "9999px",
            padding: "0.4rem 0.9rem",
            border: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500
          },
          onClick: () => {
            void openUrl(updateInfo.downloadUrl);
          },
          children: "Actualizar ahora"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          "aria-label": "Cerrar",
          style: {
            ...secondaryButtonStyle,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "1rem",
            lineHeight: 1
          },
          onClick: onDismiss,
          children: "\xD7"
        }
      )
    ] })
  ] });
}

// src/components/UpdateModal.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function resolveTheme2(theme = "auto") {
  if (theme === "auto" && typeof window !== "undefined" && "matchMedia" in window) {
    try {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch {
    }
  }
  return theme === "auto" ? "light" : theme;
}
async function openUrl2(url) {
  if (typeof window === "undefined") return;
  try {
    const { invoke } = await import("@tauri-apps/api/tauri");
    await invoke("plugin:easy-updater|open_url", { url });
  } catch {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
    }
  }
}
function UpdateModal(props) {
  const { updateInfo, onDismiss, appName, theme = "auto", className } = props;
  const resolvedTheme = resolveTheme2(theme);
  const overlayStyle = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60
  };
  const modalStyle = resolvedTheme === "dark" ? {
    backgroundColor: "#020617",
    color: "#e5e7eb",
    borderRadius: "0.75rem",
    padding: "1.5rem",
    maxWidth: "28rem",
    width: "100%",
    boxShadow: "0 20px 25px -5px rgba(15,23,42,0.8)"
  } : {
    backgroundColor: "white",
    color: "#0f172a",
    borderRadius: "0.75rem",
    padding: "1.5rem",
    maxWidth: "28rem",
    width: "100%",
    boxShadow: "0 20px 25px -5px rgba(15,23,42,0.2)"
  };
  const primaryButtonStyle = resolvedTheme === "dark" ? {
    backgroundColor: "#22c55e",
    color: "#022c22"
  } : {
    backgroundColor: "#16a34a",
    color: "white"
  };
  const secondaryButtonStyle = resolvedTheme === "dark" ? {
    borderColor: "#4b5563",
    color: "#e5e7eb"
  } : {
    borderColor: "#cbd5f5",
    color: "#1f2937"
  };
  const textMuted = {
    opacity: 0.8,
    fontSize: "0.875rem"
  };
  const title = appName ? `${appName} tiene una nueva versi\xF3n` : "Nueva actualizaci\xF3n disponible";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: overlayStyle, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: modalStyle, className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.75rem"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "h2",
              {
                style: {
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: "0.25rem"
                },
                children: title
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("p", { style: textMuted, children: [
              "Versi\xF3n actual ",
              updateInfo.currentVersion,
              " \xB7 Nueva versi\xF3n ",
              updateInfo.latestVersion
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              "aria-label": "Cerrar",
              onClick: onDismiss,
              style: {
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
                lineHeight: 1,
                marginLeft: "0.5rem"
              },
              children: "\xD7"
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        style: {
          marginTop: "0.75rem",
          marginBottom: "1rem",
          maxHeight: "12rem",
          overflowY: "auto",
          padding: "0.5rem",
          borderRadius: "0.5rem",
          backgroundColor: resolvedTheme === "dark" ? "#020617" : "#f1f5f9",
          fontSize: "0.875rem",
          whiteSpace: "pre-wrap"
        },
        children: updateInfo.releaseNotes || "Esta actualizaci\xF3n incluye mejoras y correcciones de errores."
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.5rem",
          marginTop: "0.5rem"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              onClick: onDismiss,
              style: {
                ...secondaryButtonStyle,
                background: "transparent",
                padding: "0.45rem 0.9rem",
                borderRadius: "9999px",
                borderWidth: 1,
                borderStyle: "solid",
                cursor: "pointer",
                fontSize: "0.875rem"
              },
              children: "Recordarme despu\xE9s"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              onClick: () => {
                void openUrl2(updateInfo.downloadUrl);
              },
              style: {
                ...primaryButtonStyle,
                padding: "0.45rem 0.9rem",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500
              },
              children: "Descargar ahora"
            }
          )
        ]
      }
    )
  ] }) });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UpdateBanner,
  UpdateModal,
  createGitHubProvider,
  createHttpProvider,
  createS3Provider,
  getCurrentPlatform,
  isNewerVersion,
  useUpdateChecker
});
//# sourceMappingURL=index.js.map