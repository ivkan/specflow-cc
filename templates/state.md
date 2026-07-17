# STATE.md Template

<!--
  SIZE POLICY — this file is bounded in BYTES, not lines.

  Limit: 32 KB (configurable via `state_max_bytes` in .specflow/config.json, or the
  SF_STATE_MAX_BYTES env var). Past roughly this size the file stops fitting in an
  agent's Read; an agent that reads it truncated and writes it back destroys everything
  after the cut. That has happened — a field STATE.md reached 205 KB at just 91 lines
  and lost its Decisions tail twice.

  Why bytes and not lines: the old rule here said "keep it under 100 lines". Markdown
  table rows grow in WIDTH, not number. That file was 91 lines. The rule never fired.

  ROW STYLE — every cell is a POINTER, never a narrative:
    - Target ≤ 300 chars, hard cap 500. Writes above the cap are REJECTED.
    - A decision row is: date | spec | verdict + where to read the detail.
      Good: `| 2026-07-17 | SPEC-350 | Audit v9 NEEDS_REVISION — 3 criticals; see Audit History |`
      Bad:  pasting the audit itself. That belongs in the spec's Audit History.

  MUTATIONS — never with the Write tool. Node has no Read cap; agents do:
    sf-tools state add-active | set-status | remove-active | add-decision
    sf-tools state set-execution | clear-execution | rotate | check | normalize
    sf-tools queue add | remove

  `state rotate` is lossless and idempotent: old decision rows and oversized cells move
  to DECISIONS_ARCHIVE.md and leave a pointer behind. Safe to run any time.
-->

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

<!-- Append with `sf-tools state add-decision <SPEC-ID> --summary "<text>"` — never by hand. -->
<!-- One row = one verdict + a pointer. ≤300 chars target, 500 hard cap. -->

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
