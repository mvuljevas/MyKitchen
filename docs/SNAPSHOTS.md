# Snapshots

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
- Values are structured sample data only; no Salad filesystem access, helper
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

- Add the read-only local helper skeleton and replace dashboard sample data with
  bounded helper responses.

## 2026-06-28 - Block 005: Local Helper Skeleton

Branch:

- `main`

Current state:

- The repository has a Node-based read-only localhost helper.
- The helper exposes `/health`, `/salad/status`, `/salad/logs`, and
  `/salad/logs/:id/window`.
- The dashboard loads helper status and log metadata when the helper is
  available, with structured sample data as fallback.
- Chopping-hour history is still sample data; log parsing and interval
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
  data only as offline fallback.
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
