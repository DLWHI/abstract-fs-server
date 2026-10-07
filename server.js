import express from "express";
import cors from "cors";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat, readdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { getPathEntries, getStorageInfo, resolvePath } from "./src/storage.js";
import config from "./config.json" with { type: "json" };

const app = express();
const root = config.root;
const distPath = path.join(import.meta.dirname, "dist");
mkdir(root, { recursive: true });
app.use(cors(config.cors));

function log(message, request) {
  console.log(
    `${new Date().toLocaleString()} | ${message}. Request: `,
    request,
  );
}

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
    res.json(files);
  } catch (error) {
    log(`Error building tree path: ${error.message}`, req);
    sendError(res, error);
  }
});

app.get("/storage/info", async (_req, res) => {
  try {
    const info = await getStorageInfo(root);
    res.json(info);
  } catch (error) {
    log(`Error aquring storage info: ${error.message}`, req);
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
    log(`Error fetching file preview: ${error.message}`, req);
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
    log(`Error receiving file to upload: ${error.message}`, req);
    sendError(res, error);
  }
});

app.post("/storage/folder/{*path}", async (req, res) => {
  try {
    const folderPath = resolvePath(getRequestPath(req), root);
    await mkdir(folderPath, { recursive: false });
    res.status(201).end();
  } catch (error) {
    log(`Error creating folder: ${error.message}`, req);
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
    const recursive = req.query.recursive === "true";
    const details = await stat(entryPath);
    // i hate js
    if (details.isDirectory()) {
      if (recursive) {
        await rm(entryPath, { recursive: true });
      } else {
        const children = await readdir(entryPath);
        if (children.length === 0) {
          await rm(entryPath, { recursive: true });
        } else {
          log("Failed attempt to erase empty directory", req);
          res.status(400).json({ error: "Directory is not empty" });
          return;
        }
      }
    } else if (details.isFile()) {
      await rm(entryPath);
    }
    res.status(204).end();
  } catch (error) {
    log(`Error deleting folder: ${error.message}`, req);
    sendError(res, error);
  }
});

app.use(express.static(distPath));

app.listen(config.port, () => {
  console.log(
    `${new Date().toLocaleString()} | Server is up and running at http://localhost:${config.port}`,
  );
});
