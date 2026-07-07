# Agent Workflow

This React/Vite project uses the AGENTS workflow and `lean-context`.

## Core Rules

- Work in small, traceable blocks.
- Read the repository documentation before proposing or changing structure.
- Do not modify code or documentation before understanding the current project
  state.
- Do not revert user changes unless explicitly requested.
- Keep public metadata neutral: do not use agent names, AI tool names, provider
  names, or generated-by signatures in branches, commits, pull requests, tags,
  changelogs, templates, or public documentation.
- Keep app code in `src/`.
- Keep public static files in `public/`.
- Do not add large dependencies without clear need.
- Keep documentation updated whenever decisions affect architecture, workflow,
  versioning, snapshots, roadmap, technical debt, security, commands, routes, or
  product scope.
- Prefer reusable structure over one-off project-specific rules.

## Project Boundary

MyKitchen is intended to become a local web application that analyzes a
Salad installation directory and computes Chopping hours automatically.

The repository currently contains the React/Vite template shell. Do not
implement Salad-specific parsing, process detection, or filesystem access until
the next implementation block is confirmed.

## Initial Project Behavior

When a user asks the agent to analyze the repository, treat these prompts as
equivalent:

```text
Analiza el repo.
Analyze this repository.
Review the project structure.
Inspect the repo and tell me where we are.
What is the current state of this project?
Audit the repository setup.
Read the docs and summarize the current state.
```

The agent must:

1. Read `README.md`, `AGENTS.md`, `docs/AI_CONTEXT.md`, and recent entries in
   `docs/SNAPSHOTS.md`.
2. Inspect the project structure and current git state.
3. Identify whether this is a new project or an existing project adopting the
   workflow.
4. Summarize the current state.
5. Ask what to build next.

## Lean Context Loading

This repository uses the `lean-context` preset as an active workflow layer.

- Retrieve context before reading context.
- Do not read the whole repository unless the user explicitly asks for a full
  audit.
- Start with `README.md`, `AGENTS.md`, `docs/AI_CONTEXT.md`, and recent entries
  in `docs/SNAPSHOTS.md`.
- Use `docs/AI_SEARCH.md` to locate the relevant files before opening them.
- Use `rg` before opening files.
- Prefer small file slices over complete files.
- Respect `.aiignore` and `.rgignore` unless the user explicitly asks to
  inspect ignored material.
- Avoid generated output, dependency folders, build artifacts, caches, secrets,
  and lockfiles unless they are directly relevant.
- Update `docs/AI_CONTEXT.md` when architecture, commands, stack, or important
  project boundaries change.

## Template and Preset Recommendation

Before downloading, copying, or applying a template, recommend the smallest
useful template and preset combination from the user's project description.

- Recommend one primary template.
- Recommend `lean-context` by default when the user wants AI quota efficiency,
  MCP guidance, GitHub workflow help, or search-first agent behavior.
- Treat MCPs, compression, and tracking tools as optional capabilities.
- For existing projects, propose an adoption path instead of overwriting files.
- If no concrete template exists, document the gap and use the smallest
  self-contained governance layer.

## Optional MCPs

- Treat MCP servers as optional accelerators, not required dependencies.
- Prefer read-only MCP resources before invoking tools.
- Use MCP Roots or equivalent filesystem restrictions when available.
- Do not expose secrets, `.env` files, dependency folders, build output, or
  private credentials through MCP resources.
- Keep MCP outputs bounded and summarize large results.

## Work Blocks

Each work block should include:

1. Scope confirmation or a clear assumption.
2. Focused implementation or documentation changes.
3. Local verification when applicable.
4. Snapshot update when the project state changes.
5. Roadmap update when product direction changes.
6. Technical debt update when debt is created, changed, accepted, or resolved.
7. README update when setup, usage, commands, or project scope changes.
8. Version-file update when the iteration changes the project state.
9. Matching git tag creation for the new version when the iteration is closed
   and appropriate.
10. Suggested next logical step.

## Versioning

Projects based on these rules use Semantic Versioning for meaningful
iterations:

```text
MAJOR.MINOR.PATCH
```

- `MAJOR`: incompatible workflow, API, or project behavior changes.
- `MINOR`: backward-compatible new workflows or features.
- `PATCH`: backward-compatible fixes, clarifications, or documentation updates.

Current authoritative version source:

```text
package.json
```

Keep `package.json.version` synchronized with the matching tag. If npm updates
lockfile metadata, keep it synchronized too.

Git tag format:

```text
vX.Y.Z
```

Do not push commits or tags without explicit user approval.

## Git Rules

- Use descriptive, neutral branch names.
- Keep branches focused by feature, documentation block, or template block.
- Do not push without explicit user approval.
- Create local version tags only when a versioned iteration is closed.
- Do not push tags without explicit user approval.
- Do not mix unrelated refactors with feature work.

## Quality Rules

- Validate documentation links after structural changes.
- Keep Markdown headings consistent and readable.
- Prefer English for repository documentation and workflow rules.
- Keep Spanish phrases only when documenting prompts or user-facing examples
  the agent should recognize.
- Prefer concrete rules over vague guidance.

## Next-Step Fallback

At the end of every iteration, suggest the next logical step from
`docs/ROADMAP.md`. If roadmap is missing or not actionable, use
`docs/TECHDEBT.md`. If neither provides a clear next action, ask the user how
they would like to proceed.
