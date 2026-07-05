# Technical Debt

## TD-001: Concrete React Vite Template Adoption

Status: resolved.

Context:

- The local `AGENTS` repository recommends `templates/react-vite-spa/` for a
  React SPA, Vite, or PWA application.
- The concrete template now exists and has been adopted.

Impact:

- The project has a minimal React/Vite shell and uses `package.json` as the
  authoritative version source.

Resolution path:

- No further action required unless the upstream template changes in a way this
  project should adopt.

## TD-002: Filesystem Access Model Undecided

Status: resolved.

Context:

- A browser-only app cannot directly read `C:\ProgramData\Salad` without user
  file selection or a local bridge.

Impact:

- The app architecture is now defined as a React/Vite browser UI backed by a
  small read-only localhost helper.

Resolution path:

- Documented in `docs/ARCHITECTURE.md` and `docs/SECURITY.md`.

## TD-003: Star Chef Rule Source Needs Update Policy

Status: open.

Context:

- The current known threshold is 3000 minutes, approximately 50 hours, of
  Chopping per week.

Impact:

- Hardcoding the threshold without documenting source and update behavior can
  make the app stale if Salad changes the rule.

Resolution path:

- Store the threshold in a clearly named configuration constant and document
  the official source checked during implementation.

## TD-004: Local Helper Not Implemented

Status: resolved.

Context:

- The selected architecture depends on a read-only localhost helper for Salad
  filesystem inspection and process status.

Impact:

- The browser UI can now inspect helper health, process status, and bounded log
  metadata from localhost.

Resolution path:

- Implemented in `src/helper/server.js`.

## TD-005: Dashboard Uses Sample Data

Status: resolved.

Context:

- The first dashboard screen used structured placeholder values for process status,
  workload status, Chopping history, and recent events.

Impact:

- The UI reflects local helper status, log metadata, and Chopping-hour history
  when available.

Resolution path:

- Implemented with `/salad/chopping-history`; offline helper state now uses
  explicit empty values instead of fabricated demo values.

## TD-006: Process Detection Is Heuristic

Status: open.

Context:

- The local helper checks Windows process names with `tasklist` and a small set
  of Salad/workload name hints.

Impact:

- Active workload status may be unknown or incomplete until real process names
  are confirmed on machines running Salad.

Resolution path:

- Validate process names against a real Salad installation and update the
  helper's allowlisted process hints.

## TD-007: Chopping Parser Uses Miner Signal Heuristics

Status: open.

Context:

- The parser scans every readable Salad `.log` file, derives Chopping intervals
  from lines containing `Mining at`, and closes intervals when signal gaps
  exceed two minutes.

Impact:

- It can calculate useful local history from available logs, but exact Salad
  Chopping semantics may require additional status events or official behavior
  confirmation.

Resolution path:

- Compare calculated intervals against known Salad sessions and refine parser
  boundaries with additional log sources when needed.

## TD-009: Rig Activity Is Metadata-Inferred

Status: open.

Context:

- The dashboard now shows rig log activity inferred from all Salad log
  modification timestamps.

Impact:

- This improves visibility into local rig/app activity, but it is not the same
  as confirmed Chopping or Star Chef credit.

Resolution path:

- Replace or refine inferred activity when SaladBowl, NDM, or WSL lifecycle log
  patterns are validated as reliable Chopping start/stop signals.

## TD-010: Optimization Plan Is Advisory

Status: open.

Context:

- The Rig view generates max-availability recommendations from detected
  hardware, Windows power state, WSL readiness, GPU telemetry, and Salad
  processes.

Impact:

- The app can guide optimization, but it does not yet apply Windows power,
  NVIDIA, WSL, or Salad setting changes automatically.

Resolution path:

- Add explicit confirmation flows per action, starting with reversible Windows
  power-plan changes and keeping elevated operations isolated to the helper.

## TD-011: WSL VHD Cleanup Needs Runtime Coordination

Status: open.

Context:

- Salad container storage is reported through the WSL `ext4.vhdx` allocation.
- Full cleanup can remove the Salad WSL storage folder after explicit
  confirmation, but it does not yet coordinate stopping Salad services or WSL.

Impact:

- Users can identify the real disk consumer and choose guarded cleanup, but a
  full WSL cleanup should be performed only when Salad is idle.

Resolution path:

- Before enabling non-dry-run full cleanup from the UI, detect active Salad/WSL
  runtime state and offer a controlled stop flow or block the action with a
  clear reason.

## TD-008: Multi-PC Totals Need Import Workflow

Status: open.

Context:

- The helper can export a local machine report, but the UI does not yet import a
  second PC report or combine totals.

Impact:

- Users with multiple machines must read each machine separately until import
  is implemented.

Resolution path:

- Add JSON import in the Machines view and compute combined 7-day totals from
  local plus imported reports.
