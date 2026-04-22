import { debug } from "../utils/debug";
import { GITHUB_RELEASES_API_URL, GITHUB_RELEASES_DOWNLOAD_URL } from "../branding.ts";

export async function getLatestVersion(): Promise<string | null> {
    try {
      const response = await fetch(GITHUB_RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      const data = await response.json() as { tag_name?: string };
      const tag = data.tag_name;
      if (typeof tag !== 'string') {
        debug('[manifest] Latest version tag is not a valid string');
        return null;
      }
      // Tags are typically prefixed with 'v' (e.g. v0.0.4) — strip it.
      return tag.startsWith('v') ? tag.slice(1) : tag;
    } catch (error) {
      debug(`[manifest] Failed to get latest version: ${error}`);
    }
    return null;
}

export async function getManifest(_version: string): Promise<VersionManifest | null> {
    try {
        // GitHub Releases always exposes the latest artifacts under /releases/latest/download.
        // Older per-version manifest.json files are no longer published alongside releases.
        const url = `${GITHUB_RELEASES_DOWNLOAD_URL}/manifest.json`;
        debug(`[manifest] Getting latest manifest: ${url}`);
        const response = await fetch(url);
        const data = await response.json();
        return data as VersionManifest;
    } catch (error) {
        debug(`[manifest] Failed to get manifest: ${error}`);
    }
    return null;
}


export interface BinaryInfo {
  url: string;
  sha256: string;
  size: number;
  filename?: string;
}

export interface VersionManifest {
  version: string;
  build_time: string;
  build_timestamp: number;
  binaries: Record<string, BinaryInfo>;
}
