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
The Rig view inspects Windows, WSL, CPU, memory, GPU, power plan, Salad
processes, and helper elevation, then generates a maximum-availability
optimization plan with explicit actions for supported safe changes.

The Settings view can inspect Salad disk usage, including the WSL `ext4.vhdx`
container disk image used by container jobs. Cleanup is split into safe cache,
obsolete re-downloadable workload folders, and full cache/WSL cleanup. Logs are
protected by default and require a separate irreversible confirmation before
deletion. The storage view also separates workload downloads, recent workload
packages, and obsolete workload packages so cache usage is not confused with
logs or weekly Chopping evidence.

The Docs view records the local Salad storage findings and links to the
original Salad and Microsoft WSL references. It explains that full cache/WSL
purge may force Salad to rebuild or re-download runtime data and should only be
used when Salad and its WSL runtime are stopped.

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
On Windows, the suite checks administrator status before opening ports. If the
current terminal is not elevated, it requests a native UAC relaunch and runs the
UI, helper, and monitor from a hidden elevated process managed by the app.
The elevated relaunch starts `node.exe` directly instead of keeping a PowerShell
window alive, and the original command waits until the dashboard responds before
reporting success.
If an existing healthy suite is already running, the command reuses it and opens
the dashboard instead of crashing on occupied ports.
The suite opens `http://127.0.0.1:5173/` in the default browser after Vite is
ready. Set `SALAD_OPEN_BROWSER=0` to disable this for scripted runs.
Use the Settings view to stop a managed hidden suite. Set `SALAD_FOREGROUND=1`
when you explicitly want a visible terminal for debugging.

```bash
npm run dev
```

Run the helper in a second terminal when you want local Salad status and log
metadata:

```bash
npm run helper
```

On Windows, the helper also requests UAC relaunch when started from a
non-elevated terminal.

Watch local process, WSL, workload, and parser observations in a console:

```bash
npm run monitor
```

On Windows, the standalone monitor also requests UAC relaunch so it runs in the
same elevated context as the rest of the local suite.

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
- Inspect local rig hardware and runtime readiness for Salad jobs.
- Inspect Salad disk usage and provide guarded cache cleanup actions.
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
