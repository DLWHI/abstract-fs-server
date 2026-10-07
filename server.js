import express from "express";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import {
  getPathEntries,
  getStorageInfo,
  resolvePath,
} from "./src/lib/local.js";
import config from "./config.json" with { type: "json" };

const app = express();
const root = config.root;
const distPath = path.join(import.meta.dirname, "dist");
mkdir(root, { recursive: true });

function getRequestPath(req, required = true) {
  const wildcard = req.params.path;
  if (Array.isArray(wildcard) && wildcard.length > 0) {
    return wildcard.join("/");
  }
  if (typeof wildcard === "string" && wildcard !== "") {
    return wildcard;
  }
  if (!required) return "/";
  throw new TypeError("A storage path is required");
}

function sendError(res, error) {
  const statusByCode = {
    EACCES: 403,
    EEXIST: 409,
    EISDIR: 400,
    ENOENT: 404,
    ENOTDIR: 400,
    ENOSPC: 507,
    ENOTEMPTY: 400,
    EPERM: 403,
  };
  const status =
    statusByCode[error.code] ??
    (error instanceof TypeError || error instanceof RangeError ? 400 : 500);

  res.status(status).json({ error: error.message });
}

app.get("/storage/tree/{*path}", async (req, res) => {
  try {
    const files = await getPathEntries(root, getRequestPath(req, false));
    res.json({ files });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/storage/info", async (_req, res) => {
  try {
    const info = await getStorageInfo(root);
    res.json({ info });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/storage/file/{*path}", async (req, res) => {
  try {
    const filePath = resolvePath(getRequestPath(req), root);
    const details = await stat(filePath);
    if (details.isDirectory()) {
      throw new TypeError("The requested path is a directory");
    }
    if (!details.isFile()) {
      throw new TypeError("The requested path is not a regular file");
    }

    res.sendFile(filePath);
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error);
    } else {
      sendError(res, error);
    }
  }
});

app.post("/storage/file/{*path}", async (req, res) => {
  let output;
  try {
    const filePath = resolvePath(getRequestPath(req), root);
    output = createWriteStream(filePath);
    await pipeline(req, output);
    res.status(201).end();
  } catch (error) {
    if (output && !output.destroyed) output.destroy();
    sendError(res, error);
  }
});

app.post("/storage/folder/{*path}", async (req, res) => {
  try {
    const folderPath = resolvePath(getRequestPath(req), root);
    await mkdir(folderPath, { recursive: false });
    res.status(201).end();
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/storage/tree/{*path}", async (req, res) => {
  try {
    if (
      req.query.recursive !== undefined &&
      req.query.recursive !== "true" &&
      req.query.recursive !== "false"
    ) {
      throw new TypeError("recursive must be true or false");
    }

    const entryPath = resolvePath(getRequestPath(req), root);
    if (entryPath === path.resolve(root)) {
      throw new RangeError("Cannot delete the storage root");
    }

    await rm(entryPath, { recursive: req.query.recursive === "true" });
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

app.use(express.static(distPath));

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(config.port, () => {
  console.log(`Server is up and running at http://localhost:${config.port}`);
});
