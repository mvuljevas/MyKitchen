# Architecture

This document records the current technical direction for SaladChoppingHours.

## Current Decision

SaladChoppingHours will use a local React/Vite browser UI backed by a small
read-only local helper process.

The helper will expose a localhost-only API for Salad installation inspection.
The browser UI will not attempt to read `C:\ProgramData\Salad` directly.

## Why This Model

Browser-only filesystem access is not enough for automatic Salad inspection.
A user-selected file picker flow would be safer than broad filesystem access,
but it would make recurring status checks and process detection awkward.

A desktop wrapper could work later, but it adds packaging complexity before the
core parser and calculation behavior are proven.

A local helper keeps the first implementation small while allowing:

- Read-only access to Salad log and configuration files.
- Local process status checks.
- A browser-based UI with a normal Vite development loop.
- A future migration path to a packaged desktop app if needed.

## Runtime Shape

```text
React/Vite UI
    |
    | localhost HTTP API
    v
Read-only local helper
    |
    +-- Salad installation files
    +-- Local process status
```

## Initial Helper Scope

The first helper implementation should be intentionally narrow:

- Read configured Salad installation paths.
- List relevant log files and basic metadata.
- Read bounded log slices for parser development.
- Report whether known Salad processes appear to be running.

The helper should not write to Salad files, modify system settings, or expose a
general filesystem browser.

## API Boundary

The UI should call purpose-built endpoints rather than generic filesystem
operations. Example endpoint shape:

```text
GET /health
GET /salad/status
GET /salad/logs
GET /salad/chopping-history
GET /salad/workload/current
GET /salad/events
GET /salad/report
GET /salad/elevate
GET /salad/logs/:id/window
```

These endpoints are implemented by `src/helper/server.js`.

Exact endpoint names can change during implementation, but the API should keep
the same constraints:

- Bind only to localhost.
- Return structured JSON.
- Bound reads by size, path allowlist, and file type.
- Avoid returning secrets or unrelated local files.

## Implementation Notes

The helper is implemented with Node.js using built-in modules only. It binds to
`127.0.0.1:48173` by default and can be configured with:

```text
SALAD_HELPER_HOST
SALAD_HELPER_PORT
SALAD_INSTALL_PATH
```

On Windows, the suite, helper, and monitor request UAC relaunch before opening
ports when the current process is not elevated. This keeps Salad process, WSL,
service, and hardware observability in one administrator context while still
binding the helper to localhost.

The elevated suite runs hidden by default and is managed by the app through
`GET /suite/status` and `GET /suite/shutdown`. `npm run suite` reuses an
existing healthy helper/UI instead of starting a duplicate listener.

## Deferred Decisions

- Whether to package the app as a desktop application.
- Whether to support non-Windows Salad installation paths.
- Whether to add authentication for localhost access.
- How to store user-selected Salad path preferences.
- Whether non-miner Salad logs should refine Chopping interval boundaries.
