import type { OsType } from '@tauri-apps/api/os';

/**
 * Returns the current platform identifier used in update manifests.
 *
 * Values:
 * - "windows-x86_64"
 * - "darwin-x86_64"
 * - "darwin-aarch64"
 * - "linux-x86_64"
 *
 * If called outside a Tauri context (e.g. SSR), it resolves to an empty string.
 */
export async function getCurrentPlatform(): Promise<string> {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    // Dynamically import to keep SSR-safe.
    const os = await import('@tauri-apps/api/os');

    const type: OsType = await os.type();
    const arch = await os.arch();

    const normalizedOs = normalizeOs(type);
    const normalizedArch = normalizeArch(arch);

    if (!normalizedOs || !normalizedArch) {
      return '';
    }

    return `${normalizedOs}-${normalizedArch}`;
  } catch {
    // If anything fails (not in Tauri, permission issues, etc.) return empty.
    return '';
  }
}

function normalizeOs(os: OsType | string): string {
  const lower = os.toLowerCase();
  if (lower.startsWith('win')) return 'windows';
  if (lower.startsWith('mac')) return 'darwin';
  if (lower.startsWith('linux')) return 'linux';
  return '';
}

function normalizeArch(arch: string): string {
  const lower = arch.toLowerCase();
  if (lower === 'x86_64' || lower === 'x64' || lower === 'amd64') {
    return 'x86_64';
  }
  if (lower === 'aarch64' || lower === 'arm64') {
    return 'aarch64';
  }
  return '';
}

