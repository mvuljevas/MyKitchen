# Security

SaladChoppingHours reads local user data from a Salad installation. The app
must treat that data as private and local by default.

## Security Model

The selected architecture uses a browser UI and a read-only local helper.

The helper is trusted local code running on the user's machine. It should expose
only the minimum API needed by the UI and should bind to localhost only.

## Data Handling Rules

- Do not commit Salad logs, copied installation folders, tokens, runtime data,
  or machine-specific paths.
- Read Salad files only through explicit allowlisted paths.
- Prefer bounded reads over whole-file reads.
- Return structured summaries when possible.
- Do not send Salad data to remote services.
- Do not log raw Salad data in development output unless the user explicitly
  asks for debugging details.

## Filesystem Access Rules

The helper should avoid generic filesystem access endpoints. Each endpoint
should describe a product-level operation, such as checking status or reading a
bounded log window.

Allowed initial access:

- Salad installation directories selected or configured by the user.
- Relevant Salad log and configuration files needed for Chopping calculations.
- Local process inspection needed to detect active Salad status.

Disallowed initial access:

- Arbitrary user directories.
- Secret files such as `.env`, certificates, keys, or browser profiles.
- Write access to Salad installation data.
- Deleting, moving, or modifying local files.

## Localhost API Rules

The helper API should:

- Bind to `127.0.0.1` by default.
- Use a fixed or clearly configured local port.
- Reject path traversal.
- Normalize and validate all filesystem paths before reading.
- Enforce response size limits for log reads.
- Avoid broad CORS settings unless the development workflow requires them.

## Open Questions

- Whether localhost requests need a per-session token.
- Whether process detection needs elevated permissions on some systems.
- How to handle multiple Salad installation locations.

## Current Implementation

- Helper entrypoint: `src/helper/server.js`.
- Default bind address: `127.0.0.1`.
- Default port: `48173`.
- Default Salad path: `C:\ProgramData\Salad`.
- Log reads are limited to the last 64 KiB and the last 200 lines.
- Log file discovery is bounded by scan depth and result count.
- Chopping history parsing reads allowlisted miner logs under the configured
  Salad installation path and does not return raw log lines.
- The live monitor prints summarized events only and redacts command-line user
  values where possible.
- On Windows, the development suite relaunches through UAC when needed so the
  UI dev server, helper, and monitor run in one administrator context.
- Elevated execution is still local-only: the helper remains bound to localhost
  and the API stays purpose-built for Salad inspection.
- Hidden elevated execution can be stopped from the Settings view through the
  localhost-only managed suite shutdown endpoint.
