# Conventions

This document defines repository-wide conventions.

## Repository Purpose

This repository contains MyKitchen, a local web app that calculates Salad
Chopping hours from local Salad installation data.

The repository now includes the React/Vite UI, local helper, parser, rig
inspection, storage inspection, and guarded job-cache cleanup.

## Documentation Principles

- Keep project rules explicit, portable, and stack-aware.
- Keep shared behavior in `AGENTS.md` and `docs/`.
- Update documentation when product scope, commands, architecture, security, or
  workflow decisions change.
- Prefer short rules that can be followed during real work.

## Required Documents

This project should maintain:

- `README.md`: project purpose, setup, usage, and documentation map.
- `AGENTS.md`: agent behavior and project-specific workflow rules.
- `.gitignore`: stack-appropriate ignored files.
- Authoritative version source, currently `package.json`.
- `docs/ROADMAP.md`: product direction.
- `docs/SNAPSHOTS.md`: chronological project memory.
- `docs/TECHDEBT.md`: accepted risks, shortcuts, and cleanup items.

Optional future documents:

- `docs/ARCHITECTURE.md`: system structure and technical decisions.
- `docs/SECURITY.md`: security model and sensitive filesystem workflows.
- `docs/adr/`: formal architecture decision records.

## Public Metadata

Do not include AI agent names, AI tool names, model names, provider names, or
generated-by signatures in public project metadata.

This applies to:

- Branch names.
- Commit messages.
- Pull request titles and descriptions.
- Tags and releases.
- Changelogs.
- README files.
- Product-visible text.

## Salad Data Handling

- Do not commit local Salad logs, tokens, generated runtime data, or copied
  installation directories.
- Treat Salad installation data as local user data.
- Document any filesystem access model before implementation.
- Prefer read-only access to Salad files unless the user explicitly requests a
  write operation.
