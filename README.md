# SaladChoppingHours

SaladChoppingHours is a local React/Vite web application for reading a Salad
installation directory, detecting whether Salad is active, and calculating
weekly Chopping time toward Star Chef qualification.

## Current State

This repository has been aligned with the `react-vite-spa` template from the
local `AGENTS` repository and uses the `lean-context` workflow preset.

The application now has an initial dashboard for tracking Salad process status,
workload status, installation folder, weekly Chopping hours, and recent
log-derived signals. The selected architecture is a React/Vite browser UI backed
by a small read-only localhost helper for Salad file inspection and process
status.

The helper can report health, inspect known Salad processes, list bounded Salad
log metadata, expose a root endpoint map, read bounded log windows, and
calculate recent Chopping-hour history from every readable Salad `.log` file.
When the helper is not running, the dashboard shows an explicit empty/offline
state instead of fabricated sample values.

The dashboard separates local 7-day Chopping history from Salad lifetime totals.
Displayed hour values include source, confidence, and coverage context so
partial local logs are not presented as complete account history.
It also keeps last-24-hours, rolling-7-days, and estimated Star Chef progress as
separate values. Salad documents the Star Chef threshold as 3000 minutes per
week; this app uses a rolling 7-day estimate unless Salad publishes a more exact
qualification window.
Coverage separates logs found, logs scanned, logs with recognized activity
signals, and unreadable logs.
The dashboard also shows inferred rig log activity from all Salad log
timestamps. This helps explain local rig activity without counting it as
confirmed Star Chef progress unless recognized Chopping signals are present.

## Requirements

- Node.js 22 or newer.
- npm 11 or newer.

## Install

```bash
npm install
```

## Development

Run the full local suite in one terminal:

```bash
npm run suite
```

This starts the Vite UI, the read-only helper, and the live monitor together.
Use `Ctrl+C` in that terminal to stop all three.

```bash
npm run dev
```

Run the helper in a second terminal when you want local Salad status and log
metadata:

```bash
npm run helper
```

Watch local process, WSL, workload, and parser observations in a console:

```bash
npm run monitor
```

If you only want the UI and helper without console monitoring:

```bash
npm run suite:ui
```

Optional helper configuration:

```powershell
$env:SALAD_INSTALL_PATH = "C:\ProgramData\Salad"
$env:SALAD_HELPER_PORT = "48173"
npm run helper
```

## Verification

```bash
npm run build
npm test
```

## Planned Product Scope

- Read Salad logs and configuration from the local installation directory.
- Detect whether Salad and its workload service are currently running.
- Reconstruct Chopping intervals from local Salad miner log signals.
- Compare totals against the official Star Chef threshold.
- Present results in a local web interface without requiring an AI agent.

## Recommended Starting Point

- Template: `react-vite-spa`.
- App stack: React + Vite.
- Preset: `lean-context`.

The source `AGENTS` repository now contains the concrete
`templates/react-vite-spa/` directory, and this repository has adopted it.

## Version

The authoritative version source is `package.json`.

## Documentation Map

- [Agent rules](AGENTS.md)
- [AI Context](docs/AI_CONTEXT.md)
- [AI Search](docs/AI_SEARCH.md)
- [AI Token Budget](docs/AI_TOKEN_BUDGET.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Conventions](docs/CONVENTIONS.md)
- [Naming](docs/NAMING.md)
- [Workflows](docs/WORKFLOWS.md)
- [Roadmap](docs/ROADMAP.md)
- [Security](docs/SECURITY.md)
- [Technical Debt](docs/TECHDEBT.md)
- [Snapshots](docs/SNAPSHOTS.md)
