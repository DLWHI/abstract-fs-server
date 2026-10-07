import path from "node:path";
import { readdir, stat, statfs } from "node:fs/promises";

const imageExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const videoExtensions = new Set([
  ".avi",
  ".m4v",
  ".mkv",
  ".mov",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".webm",
]);

export function resolvePath(requestedPath, root) {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("ABSTRACTFS_SERVER_ROOT is not configured");
  }
  if (typeof requestedPath !== "string") {
    throw new TypeError("A storage path is required");
  }

  const absoluteRoot = path.resolve(root);
  const normalized = requestedPath
    .replace(/^[\\/]+/, "")
    .replace(/[\\/]+/g, path.sep);
  const resolved = path.resolve(absoluteRoot, normalized);
  const fromRoot = path.relative(absoluteRoot, resolved);

  if (
    fromRoot === ".." ||
    fromRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(fromRoot)
  ) {
    throw new RangeError(`Path is outside the storage root: ${requestedPath}`);
  }

  return resolved;
}

function toStoragePath(absolutePath, root) {
  const relative = path.relative(path.resolve(root), absolutePath);
  return relative ? `/${relative.split(path.sep).join("/")}` : "/";
}

export async function getPathEntries(root, requestedPath = "/", maxStats = 5) {
  const absolutePath = resolvePath(requestedPath, root);
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const result = new Array(entries.length);
  let nextIndex = 0;

  async function collectEntries() {
    while (nextIndex < entries.length) {
      const index = nextIndex++;
      const entry = entries[index];
      if (!entry.isDirectory() && !entry.isFile()) continue;

      const entryPath = path.join(absolutePath, entry.name);
      const details = await stat(entryPath);
      if (!details.isDirectory() && !details.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      const entity = {
        id: toStoragePath(entryPath, root),
        type: details.isDirectory()
          ? "folder"
          : imageExtensions.has(extension)
            ? "image"
            : videoExtensions.has(extension)
              ? "video"
              : "file",
        modified: details.mtime.toISOString(),
      };

      if (details.isFile()) entity.size = details.size;
      result[index] = entity;
    }
  }

  const workerCount = Math.min(entries.length, Math.max(1, maxStats));
  await Promise.all(
    Array.from({ length: workerCount }, () => collectEntries()),
  );

  return result.filter((entry) => entry !== undefined);
}

export async function getStorageInfo(root) {
  const stats = await statfs(root);
  const total = stats.blocks * stats.bsize;
  const used = (stats.blocks - stats.bfree) * stats.bsize;

  return {
    free: stats.bavail * stats.bsize,
    used,
    total,
  };
}
