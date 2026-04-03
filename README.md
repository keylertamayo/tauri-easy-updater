## tauri-easy-updater

Hassle-free auto-updates for Tauri apps. No signing keys required.

### Repository Metadata

- Repository name: `tauri-easy-updater`
- Description: `Hassle-free auto-updates for Tauri apps. No signing keys required.`

### Quick Start

#### Paso 1 – Rust (Cargo.toml)

```toml
[dependencies]
tauri-easy-updater = "0.1"
```

En tu `main.rs`:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_easy_updater::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### Paso 2 – Frontend

```bash
npm install tauri-easy-updater
```

```tsx
import {
  useUpdateChecker,
  UpdateBanner,
  createGitHubProvider,
} from 'tauri-easy-updater';

function App() {
  const { updateInfo, dismiss } = useUpdateChecker({
    currentVersion: '1.0.0',
    provider: createGitHubProvider({ owner: 'myuser', repo: 'myapp' }),
  });

  return (
    <>
      {updateInfo?.hasUpdate && (
        <UpdateBanner updateInfo={updateInfo} onDismiss={dismiss} />
      )}
      {/* tu app */}
    </>
  );
}
```

#### Paso 3 – Al hacer release

```bash
npx tauri-easy-updater-cli generate-manifest \
  --version 1.1.0 \
  --base-url "https://github.com/myuser/myapp/releases/download/v1.1.0"
# Sube update-manifest.json a tu release de GitHub
```

