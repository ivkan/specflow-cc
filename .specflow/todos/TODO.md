# To-Do List

---

## TODO-001 — 2026-02-06
**Description:** Segmented execution with fresh context — split large specs into autonomous segments where each segment runs in a fresh subagent context to prevent quality degradation. Inspired by GSD execute-plan.md segmented pattern.
**Priority:** medium
**Notes:** Currently our orchestrator parallelizes by task groups. The improvement is to also segment within a single large task group, giving each segment fresh context. Affects spec-executor-orchestrator and spec-executor-worker interaction.

---

## TODO-002 — 2026-02-06
**Description:** Wave-based parallelization formalization — pre-compute wave numbers during spec creation (in spec-creator/splitter), not during execution. Waves should be explicit in the spec's Implementation Tasks table.
**Priority:** medium
**Notes:** Our newer spec-executor-orchestrator.md already reads pre-computed waves, but spec-creator doesn't always generate them. Need to ensure spec-creator always includes Wave column in Implementation Tasks. Affects spec-creator.md.

---

## TODO-003 — 2026-02-06
**Description:** Cross-project knowledge system (MCP memory) — a semantic search system across multiple SpecFlow projects to query decisions, patterns, pitfalls, and tech stack across projects. Inspired by GSD gsd-memory MCP server.
**Priority:** low
**Notes:** Large scope. Would require building an MCP server that extracts data from .specflow/ directories across projects. Useful for organizations with multiple SpecFlow-managed projects.

---

## TODO-004 — 2026-02-06
**Description:** SpecFlow prompt style guide — formalize conventions for writing agent prompts, command files, and specification documents. Cover XML vs Markdown usage, voice, structure, @-references.
**Priority:** low
**Notes:** Inspired by GSD-STYLE.md. Would help maintain consistency as the project grows and more contributors add/modify prompts.

---
*Last updated: 2026-02-06*
