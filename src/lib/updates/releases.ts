const REPOSITORY = "hieunc229/mailflare";
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;

interface ReleaseStatus {
  available: boolean;
  currentVersion: string;
  targetVersion?: string;
  releaseUrl: string;
  checkedAt: string;
  manualOnly: true;
}

// Public stable releases only. Never send installation credentials upstream.
function versionParts(value: string): number[] {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.exec(value);
  if (!match) throw new Error("The release has an unsupported version number.");
  const parts = match.slice(1).map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) throw new Error("Invalid release version.");
  return parts;
}

export function isNewerRelease(target: string, current: string): boolean {
  const a = versionParts(target);
  const b = versionParts(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

// Coalesce requests within a Worker isolate; bound both successful and failed checks.
let cached: { version: string; expires: number; result: Promise<ReleaseStatus> } | undefined;

export async function checkLatestRelease(currentVersion: string): Promise<ReleaseStatus> {
  if (cached?.version === currentVersion && cached.expires > Date.now()) return cached.result;
  const entry = { version: currentVersion, expires: Date.now() + 3_600_000, result: fetchRelease(currentVersion) };
  cached = entry;
  try {
    return await entry.result;
  } catch (error) {
    entry.expires = Date.now() + 60_000;
    throw error;
  }
}

async function fetchRelease(currentVersion: string): Promise<ReleaseStatus> {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "TypeWit-Mail-release-check" },
    signal: AbortSignal.timeout(8_000),
    redirect: "error",
  });
  const base: ReleaseStatus = { available: false, currentVersion, releaseUrl: RELEASES_URL, checkedAt: new Date().toISOString(), manualOnly: true };
  if (response.status === 404) return base;
  if (!response.ok) throw new Error("Could not check upstream releases. Try again later or view GitHub releases directly.");
  const release = await response.json() as { tag_name?: unknown; draft?: boolean; prerelease?: boolean };
  if (release.draft || release.prerelease || typeof release.tag_name !== "string") {
    throw new Error("No valid stable release information was returned.");
  }
  return {
    ...base,
    available: isNewerRelease(release.tag_name, currentVersion),
    targetVersion: release.tag_name.replace(/^v/, ""),
    releaseUrl: `${RELEASES_URL}/tag/${encodeURIComponent(release.tag_name)}`,
  };
}
