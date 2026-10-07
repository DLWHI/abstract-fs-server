# abstract-fs-server
Basic backend-server for abstract-fs ui component

## Storage API

Set `ABSTRACTFS_SERVER_ROOT` to the directory the server exposes. Storage paths
are supplied as wildcard path segments and are relative to that directory; for
example, `/storage/tree/documents`. `GET /storage/tree/` lists the root.

- `GET /storage/tree/{path}` lists a directory's files and folders.
- `GET /storage/info` returns the root's free, used, and total disk space.
- `GET /storage/file/{path}` streams a file with its MIME type inferred from
  its extension. Requesting a directory returns `400 Bad Request`.
- `POST /storage/file/{path}` writes the raw request body to
  the file. An empty body creates an empty file.
- `POST /storage/folder/{path}` creates a folder.
- `DELETE /storage/tree/{path}` removes a file or empty folder. Set
  `recursive=true` to also remove a folder's contents. The parameter may be
  omitted or set to `true` or `false`; other values return `400 Bad Request`.
  Deleting the storage root is not allowed.

Successful reads return `200`, file and folder creation return `201`, and
successful deletion returns `204`. Errors return a JSON object with an `error`
message and an appropriate HTTP status.
