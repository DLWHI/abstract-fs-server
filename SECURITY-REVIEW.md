# Security and efficiency review

Reviewed the storage API in `server.js` and `src/storage.js`, plus the
configuration and README. This is a static review; no runtime deployment or
network exposure was tested.

## Security findings

| # | Severity | Location | Finding | Confidence |
|---|----------|----------|---------|------------|
| 1 | HIGH | `server.js:21,60-160,169` | The storage API has no authentication or authorization, and `app.listen` does not restrict the listening interface. Any client able to reach the port can list, read, overwrite, create, or delete storage files. The default CORS middleware also allows any origin, so a browser page on another site can issue and read cross-origin requests. | 9/10 |
| 2 | MEDIUM | `src/storage.js:25-48`; used by `server.js:80-106` | The root check is lexical and does not account for symlinks below the storage directory. If a symlink exists in storage and points outside the root, file reads and writes through that symlink can escape the intended storage boundary. | 8/10 |
| 3 | MEDIUM | `server.js:102-113` | Uploads have no request-size limit, timeout, or concurrency limit. A reachable client can send a very large or slow body, consume disk space, or keep upload streams and connections occupied. | 8/10 |

### Security recommendations

1. Add authentication and authorization for every storage route. Bind to
   loopback by default for local use, and require an explicit host setting for
   network exposure. Configure CORS with an explicit origin allowlist; CORS is
   not a replacement for authentication.
2. Enforce the filesystem boundary in the presence of symlinks. Reject
   symlinks in traversed paths (using `lstat`-based checks) or use an
   operating-system-supported no-follow/open-beneath strategy. Apply the same
   policy to reads, writes, listings, and deletions.
3. Add a configurable maximum upload size, request timeout, and concurrent
   upload limit. Handle limit violations explicitly and avoid leaving a
   partial output file behind.

## Efficiency and reliability opportunities

- `getPathEntries` reads the entire directory and creates a full result array
  for every listing. It then stats entries with only five workers. Large
  directories therefore require O(n) memory and can take a long time to
  respond. Consider pagination or a configurable result cap, and measure
  whether increasing the metadata concurrency improves typical workloads.
- Directory entries are read with `withFileTypes`, but each candidate entry
  still incurs a separate `stat` call. Keep metadata lookups bounded, but
  avoid redundant calls where the required metadata is already available.
- `mkdir(root, { recursive: true })` is not awaited before the server starts.
  Await initialization before listening so startup failures are reported and
  requests cannot race root creation.
- The `/storage/info` error handler names its first parameter `_req` but refers
  to `req` in the catch block (`server.js:70-77`). If `statfs` fails, this
  raises a `ReferenceError` instead of using the normal error response path.
- `README.md` says the default port is 3000, while the fallback in `server.js`
  is 2999. The checked-in `config.json` currently sets 3000, which masks the
  mismatch unless the configuration is absent or has a falsy port.

## Scope

This was a source-level review, not a penetration test or benchmark. The
severity of network-access findings depends on where and how the server is
deployed; the current implementation itself does not provide an access
control boundary.
