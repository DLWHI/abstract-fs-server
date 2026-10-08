# react-fs-server

Basic backend-server for [react-fs-explorer](https://github.com/DLWHI/react-fs-explorer) ui component

## Usage

(Optional) Build package

```sh
npm run build
```

This will bundle and create `dist/index.html` which can be served by server.  
Then run the package

```sh
node server.js
```

If it prints `"Server is up and running at {hostname}"`, your file server is running and ready to go

## Configuration

Server can be configurated via `config.json` file. Options include:

- root - Root folder of server. Path resolution is going relative to this path. Creates directory if it does not exist. Defaults to `"./storage"`
- port - Port on which server should listen. Defaults to 3000
- cors - Additionaly, there is an option to specify CORS config in format of npm [`cors`](https://www.npmjs.com/package/cors) package.

## Storage API

Storage paths are supplied as wildcard path segments and are relative to that directory; for example, `/storage/tree/documents`. `GET /storage/tree/` lists the root.

- `GET /storage/tree/{path}` lists a directory's files and folders at specified path. Returned object contains id (path), type, modify date and size of file
- `GET /storage/info` returns the root's free, used, and total disk space.
- `GET /storage/file/{path}` streams a file. Requesting a directory returns `400 Bad Request`.
- `POST /storage/file/{path}` writes the raw request body to the file. An empty body creates an empty file.
- `POST /storage/folder/{path}` creates a folder.
- `DELETE /storage/tree/{path}` removes a file or empty folder. Set
  `recursive=true` to also remove a folder's contents. The parameter may be
  omitted or set to `true` or `false`; other values return `400 Bad Request`.
  Deleting the storage root is not allowed.

Successful reads return `200`, file and folder creation return `201`, and
successful deletion returns `204`. Errors return a JSON object with an `error`
message and an appropriate HTTP status.
