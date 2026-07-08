# AI Context

This file is the compact project summary for agents working in this repository.

## Project

- Name: MyKitchen.
- Purpose: local web application for automatically calculating Salad Chopping
  hours and Star Chef qualification signals from a Salad installation folder.
- Current version: 0.10.4.
- Current phase: dashboard connected to a narrow read-only local helper with
  Chopping-hour history, Windows/WSL observability, live monitor, machine report
  export, one-command local suite orchestration, explicit empty offline states,
  a terminal-style live monitor, all-readable-log scan coverage, rig
  hardware/runtime readiness inspection, Salad storage inspection and guarded
  job-cache cleanup, in-app docs for Salad/WSL storage behavior, Windows
  elevated-suite relaunch, automatic browser opening for the local suite,
  app-managed hidden suite execution, periodic dashboard refresh, and a
  left-sidebar priority cockpit layout with interactive chart windows for work,
  flow, and earnings availability.

## Stack

- Runtime: Node.js.
- Frontend: React + Vite.
- Application root: `src/`.
- Package manager: npm.
- Version source: `package.json`.
- Release tags: `vX.Y.Z`.

## Repository Shape

```text
.
├── AGENTS.md
├── index.html
├── package.json
├── README.md
├── docs/
│   ├── AI_CONTEXT.md
│   ├── AI_SEARCH.md
│   ├── AI_TOKEN_BUDGET.md
│   ├── CONVENTIONS.md
│   ├── NAMING.md
│   ├── ROADMAP.md
│   ├── SNAPSHOTS.md
│   ├── TECHDEBT.md
│   └── WORKFLOWS.md
├── LICENSE
└── src/
    ├── api/
    │   └── dashboard.js
    ├── data/
    │   └── emptyDashboard.js
    ├── helper/
    │   └── server.js
    ├── main.jsx
    └── styles.css
```

## Key Commands

```powershell
# install dependencies
npm install

# run local dev server
npm run suite

# run only Vite
npm run dev

# run read-only helper
npm run helper

# run console monitor
npm run monitor

# build verification
npm run build

# inspect state
git status --short --branch

# search
rg "pattern"
rg --files

# validate whitespace
git diff --check
```

## Important Files

- `README.md`: project purpose, planned scope, and documentation map.
- `AGENTS.md`: active agent workflow rules for this repository.
- `package.json`: authoritative version source and npm scripts.
- `src/`: React UI and local helper code.
- `src/helper/server.js`: localhost helper with health, status, logs, and log
  window endpoints.
- `src/helper/choppingParser.js`: parser for mining signal intervals and daily
  Chopping-hour totals.
- `src/helper/systemProbe.js`: Windows process, WSL, elevation, and machine
  inspection.
- `src/helper/workloadClassifier.js`: workload type/source/confidence
  classification.
- `src/helper/monitor.js`: console monitor for live helper observations.
- `src/helper/elevation.js`: Windows UAC relaunch and elevation inspection.
- `src/helper/rigProfile.js`: rig hardware, Windows, WSL, Salad, GPU, power, and
  max-availability optimization plan inspection.
- `src/helper/storageInspector.js`: Salad storage inventory, WSL VHD allocation
  reporting, and guarded cleanup candidate selection.
- `src/dev/suite.js`: one-command supervisor for UI, helper, and monitor.
- `src/api/dashboard.js`: UI API adapter with helper and explicit offline
  empty-state behavior. It keeps parser data usable even when slower secondary
  helper endpoints time out.
- `src/data/emptyDashboard.js`: empty dashboard values and Star Chef threshold.
- `docs/SNAPSHOTS.md`: chronological project memory.
- `docs/ROADMAP.md`: planned product direction.
- `docs/TECHDEBT.md`: accepted risks and open cleanup items.
- `docs/ARCHITECTURE.md`: selected local access architecture.
- `docs/SECURITY.md`: local data handling and helper API safety rules.

## Current Decisions

- Adopt `templates/react-vite-spa/` from the local `AGENTS` repository.
- Adopt `lean-context` workflow governance before adding product-specific
  behavior.
- Use a React/Vite browser UI backed by a small read-only localhost helper for
  Salad filesystem inspection and process status.
- Use the local helper for process status and log metadata.
- Calculate Chopping-hour history from miner log `Mining at` signals when the
  helper is running.
- Scan every readable Salad `.log` file for activity signals and expose
  coverage counts for found, scanned, signal-bearing, and unreadable logs.
- Expose inferred rig log activity from all Salad log modification timestamps,
  separately from confirmed Chopping intervals.
- Inspect rig configuration and generate advisory max-availability optimization
  telemetry without showing suggested optimization actions in the UI.
- Inspect Salad disk usage, highlight WSL `ext4.vhdx` allocation, and expose
  guarded cleanup actions limited to explicit job cache under `workloads`.
- Split workload storage into downloads/cache, recent workload packages, and
  obsolete workload packages.
- Show an in-app Docs tab with local Salad storage findings, original Salad and
  Microsoft WSL references, and operational guidance for the cleanup boundary.
- Keep Salad logs, boot logs, WSL runtime storage, rig configuration, and
  workload package folders outside normal cleanup.
- On Windows, `npm run suite`, `npm run helper`, and `npm run monitor` relaunch
  through UAC when not already elevated.
- `npm run suite` opens `http://127.0.0.1:5173/` in the default browser unless
  `SALAD_OPEN_BROWSER=0` is set.
- The elevated suite runs hidden by default, reuses an existing healthy helper
  or suite, and exposes `/suite/status` plus `/suite/shutdown` for app-managed
  lifecycle control.
- The Overview dashboard refreshes local helper data every 15 seconds and keeps
  manual sync as a styled secondary action.
- The Overview chart uses Recharts and can request 1, 7, 30, or 365 days from
  `/salad/chopping-history`.
- Windows UAC relaunch starts `node.exe` directly and the original `npm run
  suite` command waits for the dashboard URL before reporting background
  startup success.
- Keep lifetime Salad totals separate from local 7-day computed history.
- Show last-24-hours, rolling-7-days, and estimated Star Chef progress as
  separate values.
- Prioritize current workload, last-24-hours Chopping, rolling 7-day progress,
  and source-labelled earnings availability in the first viewport.
- Show the parser total for the selected chart window as the hero Chopping
  value; keep last-24-hours as a separate secondary metric.
- Use custom SimpleBar scroll surfaces for the app shell and scrollable panels.
- Treat the local hostname hash as a fallback machine ID, not as a confirmed
  Salad RIG ID.
- Do not fabricate sample dashboard values when helper data is unavailable.
- Prefer one elevated suite context on Windows so UI, helper, and monitor share
  administrator-level Salad, WSL, service, and hardware observability.
- Plan for a local web app that can read Salad logs and detect running Salad
  processes without requiring an AI agent.

## Current Risks

- Helper process detection is heuristic and Windows-focused.
- Parser currently uses miner log signals and a gap heuristic for intervals.
- Multi-PC totals require exported reports from each machine.
- Salad log formats and official Star Chef rules can change over time.
- Job-cache cleanup is conservative and intentionally excludes WSL runtime,
  logs, configuration, and workload package folders.

## Search Notes

- Use `docs/AI_SEARCH.md` before opening broad directories.
- Prefer slices over full files.
- Do not inspect ignored or generated paths unless directly needed.
