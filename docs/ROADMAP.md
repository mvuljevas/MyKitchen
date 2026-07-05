# Roadmap

## Phase 0: Workflow Foundation

- Adopt AGENTS workflow governance.
- Adopt `lean-context` context-loading rules.
- Document product boundary and open risks.
- Adopt the `react-vite-spa` template.

Status: complete.

## Phase 1: Local Access Architecture Decision

- Decide how the UI will access Salad installation files.
- Decide how to detect active Salad processes.
- Create architecture and security notes before code.

Status: complete.

## Phase 2: Core Calculation

- Add a narrow read-only local helper skeleton.
- Add bounded anonymized log fixtures for parser development.
- Replace dashboard placeholders with parsed helper responses and explicit empty
  offline states.
- Parse Salad start and stop status events.
- Collapse duplicate state transitions.
- Reconstruct Chopping intervals.
- Calculate rolling 7-day, current-week, and previous-week totals.
- Compare totals to the Star Chef threshold.

Status: started.

## Phase 3: Local Web UI

- Show active/inactive Salad status.
- Show current workload status when available.
- Show Chopping totals, last-24-hours, rolling-7-days, and qualification
  estimate.
- Show source log window and terminal-style live events.
- Show rig hardware/runtime readiness and max-availability optimization advice.
- Show Salad disk allocation and guarded cache cleanup actions.

Status: started.

## Phase 4: Verification and Packaging

- Add anonymized fixtures.
- Add parser and calculation tests.
- Add local run instructions.
- Decide whether to package as PWA, desktop wrapper, or local service.

Status: started.
