# STATE.md Template

<!-- This file is kept compact (<100 lines). Old decisions are automatically rotated to DECISIONS_ARCHIVE.md. -->

## Active Specifications

<!-- Multi-spec registry. Zero rows = no active specs. One row = single-spec ergonomics (no prompt). -->
<!-- Multiple rows = resolver emits AskUserQuestion picker when no SPEC-ID argument provided. -->

| SPEC-ID | Status | Next Step |
|---------|--------|-----------|

## Queue

| # | ID | Title | Priority | Status |
|---|----|-------|----------|--------|
| — | — | — | — | — |

## Decisions

| Date | Decision |
|------|----------|
| — | — |

## Project Patterns

- [Patterns discovered during work]

## Warnings

| Date | Specification | Reason |
|------|---------------|--------|
| — | — | — |

## Execution Status

Track orchestrated execution progress:

| Spec ID | Mode | Progress | Last Updated |
|---------|------|----------|--------------|
| — | — | — | — |

**Status indicators:**
- `Wave X/Y (N%)` — orchestrated execution in progress
- `Complete` — execution finished successfully
- `Paused` — execution paused via /sf:pause
- `Failed (Wave X)` — execution failed at wave X

**Notes:**
- This section only tracks orchestrated (multi-wave) executions
- Single-mode executions do not create entries here
- State file: `.specflow/execution/SPEC-XXX-state.json`

---
*Last updated: [date]*
