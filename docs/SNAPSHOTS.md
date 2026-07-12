# Snapshots

## 2026-07-12 - Block 030: Salad Week Alignment and Premium Date Range Picker

Branch:

- `main`

Current state:

- Restructured the dashboard layout:
  - Aligned the interactive graph directly to the right of the primary card (Hero Panel) in a 2-column top grid (`.hero-chart-row`).
  - Positioned the 4 metric cards below in a 4-column row.
  - Placed the Salad Server clocks comparison widget and the Fidelity side panel in a bottom row (`.bottom-grid`).
  - Styled all panels (`.hero-panel`, `.side-panel`, `.metric-card`) to use flex column layouts for visual alignment and equal-height stretching.
- Refined the interactive graph to prevent Y-axis and X-axis labels from overlapping at the origin by adjusting margins and adding tickMargin attributes.
- Implemented Salad Server time comparison, showing Salad Server Time (UTC) vs. Local Rig Time side-by-side with calendar dates and timezone date crossover / rollover indicators.
- Added a "Salad Week Start Day" setting in the Configuration tab (persisted via `localStorage`), enabling custom definition of the start of the week.
- Developed a custom, premium popover date range picker calendar `DatePickerPopover` supporting quick presets (Current Salad Week, Previous Salad Week, Last 7 Days) and manual calendar date range selection.
- Modified Star Chef calculations to compute and filter qualification progress dynamically based on the selected date range.
- Added a quick controls bar below the header to launch Salad, sync, start/stop/restart background services, stop suite, and reboot the rig.
- Separated Salad desktop app detection from background service check to show true process status.
- Version bumped to 0.12.0.

Decisions:

- Introduce custom date range filtering client-side for dynamic Star Chef qualification estimation, supporting the flexible "week start day" settings.

Risks:

- None identified; all tests passed.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-08 - Block 029: Scan Support for .txt Main Salad Logs

Branch:

- `main`

Current state:

- Resolved the "flat 0h history graph after 9 AM" issue by updating `src/helper/server.js`'s log file collection and reading functions. Previously, the helper was hardcoded to only scan `.log` files, thus completely ignoring the main Salad log files (named `log-YYYYMMDD.txt`), which contain all the container workload active signals.
- Configured log filters and path-inside verification to allow `.txt` file extensions.
- Verified that all hourly history buckets populate correctly through direct API querying.
- Version bumped to 0.10.8.

Decisions:

- Expand log scan pattern from just `.log` to include `.txt` files under the verified local directory.

Risks:

- None identified; all tests passed.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-08 - Block 028: Dev Dependency Incorporation

Branch:

- `main`

Current state:

- Incorporated the `@mvuljevas/pragmatik` dev dependency added by the user.
- Version bumped to 0.10.7.

Decisions:

- Track and commit user's added dependency to keep the worktree clean.

Risks:

- None identified.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-08 - Block 027: Workload Classifier Priority Logic Fix

Branch:

- `main`

Current state:

- Fixed the workload classifier (`workloadClassifier.js`) logic where the historical mining log check was placed above active container and bandwidth checks. This caused any past T-Rex logs to permanently override and block container workload classification, keeping the UI stuck in the "Mining (T-Rex)" status.
- Validated classification outputs using targeted scripting.
- Version bumped to 0.10.6.

Decisions:

- Move active workload checks (WSL, container processes, active container logs) above historical mining checks so live container activity is prioritized.

Risks:

- None identified; all tests passed.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-08 - Block 026: UI Grid Layout Refinement and Workload Classification Fix

Branch:

- `main`

Current state:

- Solved the low container hours reporting bug by assigning a custom 5-minute duration and 6-minute gap limit to container workload status events, allowing them to merge into continuous intervals.
- Fixed the workload classifier (`workloadClassifier.js`) to verify the active signal source file before declaring it as a mining workload, preventing container workloads from being incorrectly classified as T-Rex mining.
- Cleaned up the dashboard UI:
  - Removed the Money panel card because earnings details are not exposed by the helper.
  - Split the 4 status panel metrics into individual first-class `MetricCard` components.
  - Refined `.command-grid` to be a solid 3-column layout on desktop, where the main Hero panel spans 2 rows.
  - Added a responsive vertical stack fallback for screen widths under 1180px.
  - Added margin space below the top header menu (`.app-header`).
- Version bumped to 0.10.5.

Decisions:

- Free up grid space by completely removing the unexposed Money panel card and converting the status signals to separate first-class grid cards.
- Add bottom margin to `.app-header` for consistent visual spacing.

Risks:

- None identified; all tests passed.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-08 - Block 025: Container Workload Active Chopping Support

Branch:

- `main`

Current state:

- The log parser (`choppingParser.js`) now supports detecting container-based compute workloads (matching `Running(Ready, Started)`) as active Chopping hours, in addition to mining workloads (`Mining at`).
- Added state-aware contextual timestamp parsing to match multiline workload reports with their header timestamps in the logs.
- Added a unit test validating container workload logs parsing.
- Version bumped to 0.10.4.

Decisions:

- Support both `Mining at` and `Running(Ready, Started)` to ensure container jobs are counted correctly as active compute/chopping time.
- Track log timestamps statefully within each log window loop to handle logs without timestamps on every line.

Risks:

- None identified; all tests passed.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-08 - Block 024: Real Salad RIG ID Discovery

Branch:

- `main`

Current state:

- The helper now scans Salad logs to find the real Salad Machine/RIG ID (UUID) and extracts its first 8 characters, matching the ID shown in Salad Settings.
- The UI dynamically displays this real Salad RIG ID instead of the "Not exposed locally" state.
- Fallback to hostname-based hash is preserved if logs are not available or have not recorded the registration.
- Version bumped to 0.10.3.

Decisions:

- Read logs directory and parse `GetWorkloadImageKeys(...)` calls to discover the real Salad machine ID.
- Fallback gracefully to hostname-based SHA-256 hash if log evidence is missing.

Risks:

- Reading logs might fail if the directory is completely missing or permissions prevent read access, which is already handled gracefully by returning null.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-07 - Block 023: Dependency Cleanup And Suite Stop/Restart Scripts

Branch:

- `main`

Current state:

- The `simplebar` vanilla package was removed. It was a leftover from before
  the React wrapper was adopted; the app only uses `simplebar-react` which
  depends on `simplebar-core` internally.
- The reference to `simplebar` in the Vite `manualChunks` config was also
  removed; the scrollbars chunk now lists only `simplebar-react`.
- Added `npm run suite:stop` (`src/dev/stop.js`) and `npm run suite:restart`
  (`src/dev/restart.js`) to stop and restart the local suite from the command
  line without requiring an open browser session or Settings view.
- `suite:stop` tries the graceful `/suite/shutdown` helper endpoint first,
  then falls back to port-based process termination via `taskkill`.
- `suite:restart` reuses the exported `stop()` function and then imports
  `suite.js` so only one UAC prompt is shown on Windows.
- Version bumped to 0.10.2.

Decisions:

- Keep `simplebar-react` as the only scrollbar dependency; `simplebar-core` is
  its own transitive dep and does not need to be listed separately.
- Export `stop()` from `stop.js` so `restart.js` can call it directly without
  spawning a subprocess or triggering a second UAC elevation.

Risks:

- None introduced; both changes are isolated to dev tooling and build config.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-07 - Block 022: Instant Chart Range Switching And Day Hourly View

Branch:

- `main`

Current state:

- Switching between Day, Week, Month, and Year chart ranges is now instant and
  requires no additional network requests.
- The helper always returns the full 365-day daily history plus a 24-bucket
  hourly history for the current day in a single payload.
- The UI slices the cached array client-side for Week, Month, and Year views.
- The Day view now renders 24 hourly buckets (00:00 to 23:00) instead of a
  single daily point.
- Version bumped to 0.10.1.

Decisions:

- Fetch the maximum range once and filter locally to keep range switching at
  zero latency.
- Hourly buckets are computed from the same parsed intervals already in memory,
  adding no extra log scan cost.
- The `days` query param on the endpoint is kept for backward compatibility but
  is now ignored; the server always returns 365 days.

Risks:

- The 365-day parse is the longest scan; if log volume grows significantly the
  initial load time may increase. A streaming or incremental approach would
  address this if needed.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-07 - Block 021: Chart Rendering And Auto-Refresh Bug Fixes

Branch:

- `main`

Current state:

- The Recharts graph now renders correctly on first load. The previous bug was
  caused by `ResponsiveContainer` receiving `height="100%"` while its CSS
  parent only had `min-height`, which Recharts measured as 0 px.
- The auto-refresh interval no longer gets permanently stuck. The previous bug
  was caused by `refreshDashboard` being a `useCallback([historyDays])`
  dependency of the interval `useEffect`: changing the chart range destroyed
  and recreated the interval, and if a request was in flight at that moment
  `refreshInFlightRef.current` was never reset, blocking all future refreshes.
- `refreshDashboard` is now a stable callback that reads `historyDays` through
  a ref. The interval is created once on mount and its cleanup resets the
  in-flight guard.

Decisions:

- Use an explicit pixel height on `ResponsiveContainer` so Recharts always gets
  a non-zero measurement regardless of the parent CSS rule.
- Keep `historyDays` out of `useCallback` deps by routing it through a ref.

Risks:

- None introduced; both fixes are isolated to the UI render and effect lifecycle.

Next suggested step:

- Instant chart range switching (implemented in Block 022).

## 2026-07-06 - Block 019: Premium Dashboard Cockpit

Branch:

- `main`

Current state:

- The Overview dashboard now uses a premium cockpit-style layout inspired by a
  dense admin dashboard structure, while keeping MyKitchen product identity and
  source-labelled Salad data.
- The first viewport prioritizes current work, last-24-hours Chopping, rolling
  7-day Star Chef estimate, process status, and earnings availability.
- Earnings remain conservative: the UI only displays a dollar amount when an
  earnings field is present in the current helper payload; otherwise it states
  that earnings are not exposed by the helper.
- Dashboard data refreshes automatically every 15 seconds and keeps a styled
  manual sync action without requiring the user to press refresh for normal
  updates.
- Added a local MyKitchen SVG logo under `public/` and wired it as the browser
  favicon.
- The tab bar, buttons, dialogs, and dashboard surfaces remain custom-styled
  rather than relying on unstyled browser controls.

Decisions:

- Keep fidelity above excitement for money data; do not derive earnings from
  Chopping hours without a confirmed SaladBowl payload field.
- Keep secondary evidence such as coverage, rig activity, and parser context
  available below the priority summary instead of giving every signal equal
  first-viewport weight.

Risks:

- Real earnings display still depends on a future helper payload or validated
  SaladBowl source that exposes earnings data.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

## 2026-07-06 - Block 020: Sidebar, Interactive Charts, And Parser Fidelity

Branch:

- `main`

Current state:

- The dashboard navigation is now a left sidebar on desktop, with the content
  surface scrolling through SimpleBar instead of the browser body scrollbar.
- Recharts is installed and the Overview graph supports styled controls for
  day, week, month, and year windows plus area/bar modes.
- The UI requests `/salad/chopping-history` with the selected day count instead
  of always using the fixed 7-day response.
- The hero Chopping value now uses the parser `totalHours` for the selected
  window. Last-24-hours remains visible as a separate secondary metric, avoiding
  the previous mismatch where the monitor printed parser total while Overview
  showed only the 24-hour value.
- The dashboard API adapter keeps parser data available even when slower helper
  endpoints such as rig/status/report time out.
- The Rig view no longer renders suggested optimization actions.
- The displayed machine identity now distinguishes a Salad RIG ID from a local
  fallback hash. If no Salad RIG ID is exposed locally, the UI says so instead
  of presenting the fallback as the real Salad ID.
- Helper CORS now allows local Vite development ports in the `5170-5179` range.
- Vite splits chart and scrollbar dependencies into separate chunks.

Decisions:

- Parser totals are the source of truth for the headline Chopping total within
  the selected chart window.
- The local hostname hash is only a fallback identifier because it did not
  match the Salad machine ID visible in the user's reference.

Risks:

- A confirmed Salad RIG ID still depends on finding a reliable local SaladBowl
  payload or API field; current local config files did not expose the short ID.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.

Snapshots preserve project memory across sessions, handoffs, branch changes,
and context compaction.

## Format

Use this structure:

```text
## YYYY-MM-DD - Block NNN: Short Title

Branch:

- `branch-name`

Current state:

- What is true now.

Decisions:

- Decisions made in this block.

Risks:

- Risks, unknowns, or open questions.

Next suggested step:

- The next logical action.
```

## Rules

- Add snapshots after meaningful project changes.
- Keep snapshots factual and concise.
- Do not use snapshots as a replacement for roadmap or technical debt.
- Keep chronological order from oldest to newest.

## 2026-06-28 - Block 001: Workflow Foundation

Branch:

- `main`

Current state:

- The repository contains workflow governance, documentation, ignore files, and
  a version source.
- Product code has not been added.
- `lean-context` has been adopted from the local `AGENTS` repository.
- The planned product is a local web app that calculates Salad Chopping hours
  and Star Chef qualification signals.

Decisions:

- Use docs-only governance as the initial template layer because the source
  `AGENTS` repository does not yet provide a concrete React/Vite template.
- Recommend a React SPA / Vite / PWA style app for the future product, pending
  confirmation before scaffolding.
- Keep the current authoritative version source as `VERSION`.
- Do not commit local Salad logs, tokens, copied installation data, or secrets.

Risks:

- Browser-only filesystem access to `C:\ProgramData\Salad` is not enough for
  automatic reading; a local backend, desktop wrapper, file picker flow, or
  trusted bridge must be chosen.
- The official Star Chef rule can change and needs an update policy.

Next suggested step:

- Confirm the app architecture and stack before adding product code.

## 2026-06-28 - Block 002: React Vite Template Adoption

Branch:

- `main`

Current state:

- The local `AGENTS` repository now provides `templates/react-vite-spa/`.
- The project has adopted the React/Vite template shell.
- `package.json` is now the authoritative version source.
- The app has a minimal `src/` shell only; no Salad-specific parsing or process
  detection has been implemented.

Decisions:

- Use React + Vite as the application stack.
- Keep `lean-context` active.
- Keep Salad-specific implementation for the next block after architecture
  confirmation.

Risks:

- Local filesystem access to `C:\ProgramData\Salad` still requires an explicit
  access model.
- Dependencies have not been installed or built yet in this block.

Next suggested step:

- Decide the local access architecture, then implement the first parser and
  status-detection slice.

## 2026-06-28 - Block 003: Local Access Architecture

Branch:

- `main`

Current state:

- The project has selected a local access model for Salad data.
- The app remains a React/Vite shell; no Salad parser, helper process, or
  process detection code has been implemented yet.
- Version remains `0.1.0` for the first real project commit.

Decisions:

- Use a React/Vite browser UI backed by a small read-only localhost helper.
- Keep the helper API purpose-built instead of exposing generic filesystem
  operations.
- Bind the helper to localhost and require bounded, allowlisted reads.

Risks:

- The helper still needs implementation and verification.
- Localhost API hardening details, including optional session tokens, remain
  open.
- Salad log formats and official Star Chef rules can still change.

Next suggested step:

- Add the narrow local helper skeleton, then implement bounded log metadata and
  parser fixtures.

## 2026-06-28 - Block 004: Dashboard Prototype

Branch:

- `main`

Current state:

- The React/Vite app now shows an initial dashboard prototype.
- The dashboard presents Salad installation folder, process status, workload
  status, weekly Chopping history, Star Chef progress, and recent signals.
- Values are structured placeholder data only; no Salad filesystem access, helper
  API, process detection, or log parser has been implemented yet.
- Version moved to `0.2.0`.

Decisions:

- Build the first user-facing experience before wiring real local data.
- Use CSS and native markup for the chart instead of adding a chart dependency.
- Keep dashboard data shaped around future helper responses.

Risks:

- The UI can look complete before the local data pipeline exists.
- Real Salad log formats still need inspection with private data kept out of
  the repository.

Next suggested step:

- Add the read-only local helper skeleton and replace dashboard placeholders with
  bounded helper responses.

## 2026-06-28 - Block 005: Local Helper Skeleton

Branch:

- `main`

Current state:

- The repository has a Node-based read-only localhost helper.
- The helper exposes `/health`, `/salad/status`, `/salad/logs`, and
  `/salad/logs/:id/window`.
- The dashboard loads helper status and log metadata when the helper is
  available, with structured placeholder data as fallback.
- Chopping-hour history is still placeholder data; log parsing and interval
  calculation have not been implemented.
- Version moved to `0.3.0`.

Decisions:

- Use built-in Node modules for the helper to avoid new dependencies.
- Keep helper access bounded to the configured Salad installation path.
- Keep UI Chopping totals separate from helper metadata until parser behavior
  is known.

Risks:

- Process and workload detection are heuristic until tested against a live
  Salad installation.
- The helper does not yet use a per-session localhost token.
- Real Salad log formats still need parser fixtures.

Next suggested step:

- Inspect bounded log windows from a real Salad installation and implement the
  first Chopping interval parser with anonymized fixtures.

## 2026-06-28 - Block 006: Miner Log History Parser

Branch:

- `main`

Current state:

- The helper exposes `/salad/chopping-history`.
- Chopping history is calculated from miner log lines containing `Mining at`.
- The dashboard uses helper-provided history when available and keeps sample
  placeholder data only as offline fallback.
- The chart scale is fixed at `0h` to `24h` so labels remain visible when a day
  approaches the maximum.
- Version moved to `0.4.0`.

Decisions:

- Treat miner `Mining at` lines as the first reliable Chopping activity signal.
- Close Chopping intervals when mining signals are separated by more than two
  minutes.
- Keep raw log lines inside the helper and return only summaries to the UI.

Risks:

- Parser accuracy still depends on validating miner signals against known Salad
  sessions.
- Some future Salad workloads may not use the same miner log patterns.

Next suggested step:

- Add anonymized parser fixtures and tests for interval reconstruction.

## 2026-06-28 - Block 007: Real-Time Observability

Branch:

- `main`

Current state:

- The helper inspects Windows processes with CIM, Salad WSL distro state, helper
  elevation, workload type, and parser coverage.
- The dashboard has a Salad-inspired dark UI with Overview, Live Monitor,
  Logs & Coverage, Machines, and Settings views.
- A console monitor is available with `npm run monitor`.
- Machine report export is available from `/salad/report`.
- Version moved to `0.5.0`.

Decisions:

- Keep lifetime account totals separate from computed local 7-day history.
- Use source, confidence, and coverage metadata on displayed Chopping values.
- Request elevated helper through Windows UAC only when needed.

Risks:

- Multi-PC import is not implemented yet.
- Workload classification and parser intervals still need validation against
  more Salad sessions and workload types.

Next suggested step:

- Implement machine report import and combined multi-PC 7-day totals.

## 2026-06-28 - Block 008: Local Suite Orchestration

Branch:

- `main`

Current state:

- A one-command local supervisor is available with `npm run suite`.
- The supervisor starts Vite, the read-only helper, and the console monitor in
  one terminal with prefixed output.
- `npm run suite:ui` starts only Vite and the helper.
- Version moved to `0.6.0`.

Decisions:

- Use built-in Node process management instead of adding a process manager
  dependency.
- Stop all child services from the same terminal with `Ctrl+C`.

Risks:

- The supervisor is development-focused and does not replace production
  packaging.

Next suggested step:

- Improve the Machines view with import of a second PC report when multi-PC
  totals become a priority.

## 2026-06-28 - Block 009: No-Sample Dashboard UX

Branch:

- `main`

Current state:

- The dashboard no longer uses fabricated demo data when the helper is
  offline.
- The UI presents last-24-hours, rolling-7-days, and estimated Star Chef
  progress as separate values with source, confidence, and coverage context.
- The Live Monitor view is now a terminal-style stream with newest events at
  the bottom, automatic scroll, and event colors by source/type.
- Navigation uses professional tab styling instead of pill controls.
- Version moved to `0.7.0`.

Decisions:

- Treat Salad's 3000-minute weekly Star Chef rule as a 50-hour threshold while
  showing the local app's calculation as a rolling 7-day estimate until Salad
  publishes a more exact qualification window.
- Show empty/offline state explicitly rather than implying real account data.

Risks:

- The rolling 7-day Star Chef estimate still needs validation against real
  Salad account behavior.
- Parser accuracy still depends on additional real-world log validation.

Next suggested step:

- Validate the rolling 7-day total against a real Salad machine with known
  recent Chopping sessions.

## 2026-06-28 - Block 010: Full Log Scan Coverage

Branch:

- `main`

Current state:

- The helper root endpoint now returns a JSON endpoint map instead of `Not
  found`.
- Chopping history now attempts to scan every readable Salad `.log` file instead
  of pre-filtering to known miner folders.
- Coverage distinguishes logs found, logs scanned, logs with recognized
  activity signals, and unreadable logs.
- The dashboard shows inferred rig log activity from all Salad log timestamps
  separately from confirmed Chopping/Star Chef progress.
- The dashboard explains unreadable logs with sample error reasons when present.
- Version moved to `0.7.1`.

Decisions:

- Keep Chopping-hour calculation tied to recognized activity signals, but scan
  all readable logs so new Salad log locations can contribute without changing
  the discovery filter first.
- Treat log timestamp activity as inferred rig activity only, not confirmed Star
  Chef progress.
- Preserve explicit coverage gaps rather than silently treating unreadable logs
  as zero activity.

Risks:

- Very large real-world logs may require streaming parsing if full-file reads
  become too slow or memory-heavy.
- Non-mining workload logs still need additional signal patterns before they can
  contribute confirmed Chopping intervals.

Next suggested step:

- Add parser signal patterns from SaladBowl or WSL job lifecycle logs once real
  examples are identified.

## 2026-06-28 - Block 011: Rig Readiness And Optimization Plan

Branch:

- `main`

Current state:

- The helper exposes `/salad/rig/config` for Windows, CPU, memory, GPU, power
  plan, WSL, Salad process, and elevation inspection.
- The helper exposes `/salad/rig/optimize` for an advisory maximum-availability
  optimization plan.
- The dashboard has a Rig tab with readiness score, hardware cards, WSL/Salad
  runtime state, GPU telemetry, and optimization actions.
- The monitor and existing dashboard remain read-only for system changes.
- Version moved to `0.8.0`.

Decisions:

- Keep optimization advisory by default. Do not change Windows power policy,
  NVIDIA settings, WSL, or Salad automatically without a later explicit
  confirmation flow.
- Treat dedicated NVIDIA GPU, 32 GB or more RAM, WSL/virtualization readiness,
  and active Bowl service as readiness signals.

Risks:

- GPU telemetry depends on `nvidia-smi`; AMD/iGPU telemetry is currently limited
  to Windows controller metadata.
- Applying optimizations safely will require per-action validation and rollback
  behavior.

Next suggested step:

- Add explicit, reversible apply flows for selected optimization actions,
  beginning with Windows power-plan switching.

## 2026-06-28 - Block 012: Windows Elevated Suite Relaunch

Branch:

- `main`

Current state:

- `npm run suite` requests a native Windows UAC relaunch when the current
  process is not elevated, then starts Vite, helper, and monitor from the
  elevated process.
- `npm run helper` and `npm run monitor` also request UAC relaunch when started
  standalone on Windows.
- Elevation detection and relaunch logic is centralized in
  `src/helper/elevation.js`.
- Version moved to `0.8.1`.

Decisions:

- Prefer one elevated local suite context on Windows so UI, helper, and monitor
  see the same Salad process, WSL, service, and hardware state.
- Keep UAC visible and user-approved; commands are launched programmatically but
  Windows consent is not bypassed.

Risks:

- The elevated process opens a separate administrator PowerShell window so the
  user has a visible place to stop the suite with `Ctrl+C`.
- Future packaged builds should replace the dev PowerShell relaunch with a
  native app manifest or installer-level elevation strategy.

Next suggested step:

- Add a packaged Windows launch strategy once the app moves beyond the dev
  suite.

## 2026-06-28 - Block 013: Suite Browser Auto-Open

Branch:

- `main`

Current state:

- `npm run suite` opens `http://127.0.0.1:5173/` in the default browser after
  Vite is ready.
- Browser auto-open can be disabled with `SALAD_OPEN_BROWSER=0`.
- Version moved to `0.8.2`.

Decisions:

- Keep browser launching in `src/dev/suite.js` so it works for the elevated
  relaunch flow and `suite:ui`.

Risks:

- Browser auto-open uses platform shell helpers and may fail on unusual desktop
  environments; the suite prints the URL manually if that happens.

Next suggested step:

- Add a packaged Windows launch strategy once the app moves beyond the dev
  suite.

## 2026-06-28 - Block 014: Hidden Managed Suite

Branch:

- `main`

Current state:

- The elevated Windows relaunch runs hidden by default instead of leaving a
  visible administrator PowerShell window.
- `npm run suite` checks for an existing healthy helper and UI before starting
  new listeners, preventing duplicate `48173` startup crashes.
- The helper handles `EADDRINUSE` without an unhandled Node error.
- The app exposes managed suite state in Settings and can stop the hidden suite
  through `/suite/shutdown`.
- Version moved to `0.8.3`.

Decisions:

- Use the app's Live Monitor and Settings view as the operational surface for
  the background suite.
- Keep `SALAD_FOREGROUND=1` available for visible-terminal debugging.

Risks:

- If an older helper without `/suite/shutdown` is already running, the app can
  reuse it but cannot stop that older process from Settings.

Next suggested step:

- Add a small tray or packaged Windows host when moving beyond the dev suite.

## 2026-06-28 - Block 015: Direct Elevated Node Relaunch

Branch:

- `main`

Current state:

- Windows elevated relaunch starts `node.exe` directly instead of launching a
  persistent PowerShell child.
- The original `npm run suite` command waits for `http://127.0.0.1:5173/` to
  respond before reporting that the background suite is running.
- Version moved to `0.8.4`.

Decisions:

- Use PowerShell only as the native UAC launcher and keep the long-lived process
  as hidden Node.js.
- Keep `SALAD_FOREGROUND=1` as the diagnostic path when startup cannot be
  confirmed.

Risks:

- Windows UAC itself must still be visible; only the elevated app process is
  hidden.

Next suggested step:

- Add persistent startup logs for packaged Windows troubleshooting.

## 2026-07-05 - Block 016: Salad Storage Inspection And Guarded Cleanup

Branch:

- `main`

Current state:

- The helper exposes `/salad/storage` to report Salad disk usage, top-level
  storage categories, largest files, the WSL `ext4.vhdx` allocation, and cleanup
  candidates.
- The helper exposes `/salad/storage/purge` with dry-run default behavior and
  guarded modes that later proved too broad and were replaced in Block 018 by
  job-cache-only cleanup.
- Salad logs were protected by default and required a separate irreversible
  confirmation because deletion cannot be reverted and removes evidence used for
  Chopping-hour validation.
- The Settings view now shows storage inspection and cleanup actions.
- The Rig view can apply the Windows High Performance power plan action.
- Workload and activity cards use clearer labels and smaller typography to
  reduce awkward wrapping.
- Installed RAM is shown separately from Windows-usable RAM.
- Version moved to `0.9.0`.

Decisions:

- Treat Salad WSL storage as the primary local allocation signal because the
  WSL VHD can grow with container jobs and may not shrink automatically.
- Keep cleanup actions explicit and local-only; safe mode never deletes logs or
  WSL storage.

Risks:

- The broader cleanup model could force Salad to rebuild or re-download
  workloads and was later removed.

Next suggested step:

- Replace the broad cleanup model with a narrower job-cache-only boundary.

## 2026-07-05 - Block 017: In-App Storage Behavior Docs

Branch:

- `main`

Current state:

- Added a Docs tab to the app with local Salad storage findings for this rig.
- The Docs tab links to the original Salad container troubleshooting, Salad
  Chopping Power, and Microsoft WSL disk space references.
- The Docs tab explains why Salad's WSL `ext4.vhdx` can grow and why host disk
  space may not immediately return after data is removed inside WSL.
- Storage inspection now splits workload storage into downloads/cache, recent
  workload packages, and obsolete workload packages.
- Earlier broad runtime purge guidance was documented here, then replaced in
  Block 018 by job-cache-only cleanup.
- Version moved to `0.9.1`.

Decisions:

- Keep operational cleanup controls in Settings and explanatory behavior docs
  in a separate Docs tab.

Risks:

- Broad runtime cleanup still relied on explicit user confirmation at this
  point and was later removed.

Next suggested step:

- Replace broad runtime cleanup with a conservative job-cache-only purge.

## 2026-07-05 - Block 018: MyKitchen Identity And Conservative Job-Cache Cleanup

Branch:

- `main`

Current state:

- The project identity is now MyKitchen in package metadata, browser title,
  app chrome, helper output, and current documentation.
- Tailwind is wired into Vite and used for the storage cleanup confirmation
  dialog.
- Native browser confirmation and prompt dialogs were removed from the storage
  cleanup flow.
- Storage purge candidates are limited to explicit job cache folders under
  `workloads`, such as `_downloads`, `cache`, `tmp`, and `temp`.
- Logs, boot logs, WSL runtime storage, rig configuration, and workload package
  folders are excluded from cleanup candidates.
- The storage purge endpoint ignores the older broad cleanup mode by mapping it
  back to job-cache cleanup.
- Version moved to `0.10.0`.

Decisions:

- Keep storage cleanup narrowly focused on job cache only.
- Treat log deletion as a separate feature, not part of cleanup.
- Do not delete workload package folders based only on age.

Risks:

- Disk used by WSL runtime storage can still be reported but is no longer
  recoverable through the app cleanup button.

Next suggested step:

- Add a separate import workflow for multi-PC machine reports.
