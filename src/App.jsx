import { useCallback, useState } from "react";
import { ReactFSExplorer } from "react-fs-explorer";
import config from "../config.json";
import "./index.css";
import "react-fs-explorer/style.css";

const hostname = `http://localhost:${config.port}`;

const provider = async (path) => {
  const resTree = await fetch(`${hostname}/storage/tree/${path}`);
  const resInfo = await fetch(`${hostname}/storage/info/`);

  if (!resTree.ok) {
    const reason = await resInfo.json();
    const message = `Error making request to fetch files| Status: ${resTree.status}|Reason: ${reason.error}`;
    alert(message);
    console.log(message);
    return { files: [] };
  } else if (!resInfo.ok) {
    const reason = await resInfo.json();
    const message = `Error making request to fetch info| Status: ${resInfo.status}|Reason: ${reason.error}`;
    alert(message);
    console.log(message);
    return { files: [] };
  }

  const files = await resTree.json();
  const info = await resInfo.json();
  return { files, info };
};

const upload = async (file, path, onProgress) => {
  const target = [path, file.name].filter(Boolean).join("/");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${hostname}/storage/file/${target}`);

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    }
  };

  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) {
      const message = `File upload failed with status ${xhr.status}`;
      alert(message);
      console.log(message);
    }
    onProgress(0);
  };

  xhr.onerror = () => {
    const message = "Network error during upload";
    alert(message);
    console.log(message);
    onProgress(0);
  };

  xhr.setRequestHeader("Content-Type", file.type);
  xhr.send(file);
};

const erase = async (item) => {
  let url = "";
  if (item.id.startsWith("/")) {
    url = `${hostname}/storage/tree${item.id.split("/").map(encodeURIComponent).join("/")}`;
  }
  url = `${hostname}/storage/tree/${item.id.split("/").map(encodeURIComponent).join("/")}`;

  const res = await fetch(url, {
    method: "DELETE",
  });

  if (!res.ok) {
    const reason = await res.json();
    const message = `Error making request to delete file|Status: ${res.status}|Reason: ${reason.error}`;
    alert(message);
    console.log(message);
  }
};

const folder = async (name, path) => {
  const res = await fetch(`${hostname}/storage/folder/${path}/${name}`, {
    method: "POST",
  });

  if (!res.ok) {
    const reason = await res.json();
    const message = `Error making request to create folder|Status: ${res.status}|Reason: ${reason.error}`;
    alert(message);
    console.log(message);
  }
};

const source = (item) => {
  if (typeof item.id === "string") {
    if (item.id.startsWith("/")) {
      return `${hostname}/storage/file${item.id.split("/").map(encodeURIComponent).join("/")}`;
    }
    return `${hostname}/storage/file/${item.id.split("/").map(encodeURIComponent).join("/")}`;
  }
  const message = `Error resolving item url: unkown item provided`;
  alert(message);
  console.log(message);
  return message;
};

export default function App() {
  const [progress, setProgress] = useState(0);

  const progressUpload = useCallback(async (file, path) => {
    await upload(file, path, setProgress);
  }, []);

  return (
    <>
      <ReactFSExplorer
        provider={provider}
        sources={source}
        previews={source}
        onDelete={erase}
        onUpload={progressUpload}
        onFolderCreate={folder}
      />
      <div style={{ width: `${progress}%` }} className="progress-bar" />
    </>
  );
}
