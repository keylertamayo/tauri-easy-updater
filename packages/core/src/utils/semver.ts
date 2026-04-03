/**
 * Parse a semver-like string into parts, handling an optional `v` prefix
 * and optional prerelease segment.
 */
function parseVersion(input: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
} | null {
  let v = input.trim();
  if (v.startsWith('v') || v.startsWith('V')) {
    v = v.slice(1);
  }

  const [core, prerelease] = v.split('-', 2);
  const parts = core.split('.');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const [majStr, minStr, patchStr = '0'] = parts;

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

/**
 * Compare two prerelease identifiers according to semver rules.
 *
 * Returns:
 * - 1 if `a` > `b`
 * - -1 if `a` < `b`
 * - 0 if equal
 */
function comparePrerelease(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1; // release > prerelease
  if (b === null) return -1;

  const aParts = a.split('.');
  const bParts = b.split('.');
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i += 1) {
    const ai = aParts[i];
    const bi = bParts[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;

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

/**
 * Returns true if `latest` represents a strictly newer version than `current`.
 *
 * - Handles an optional `v` prefix (e.g. `v1.2.3`).
 * - Supports prerelease segments (e.g. `1.2.3-beta.1`).
 * - Falls back to `false` if parsing fails.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;

  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  if (a.patch !== b.patch) return a.patch > b.patch;

  return comparePrerelease(a.prerelease, b.prerelease) > 0;
}

