# To-Do List

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

## TODO-005 — 2026-02-06
**Description:** Retroactive spec integration (`/sf:integrate`) — create a completed specification from work already done outside the SpecFlow workflow. Analyzes recent git commits/diffs, generates a retrospective spec, validates against the code, and archives as completed. Fills the gap where developers fix bugs or make improvements ad-hoc and want to formalize them in the spec history.
**Priority:** medium
**Notes:** Inspired by GSD [#433](https://github.com/glittercowboy/get-shit-done/issues/433). Would need: git diff analysis, retrospective spec generation (reversed creator flow), automatic review of existing code against generated spec, and direct archiving. Key UX question: how much of the git history to consider (last N commits, since branch, manual selection).

---

## TODO-006 — 2026-02-06
**Description:** Autopilot mode (`/sf:autopilot`) — run the full spec lifecycle (audit → run → review → fix → done) without manual step invocations. For queued specs, processes them sequentially end-to-end. Stops only on blocking issues (failed review after N fix attempts, user intervention needed). Enables "start and walk away" workflows for well-defined specs.
**Priority:** medium
**Notes:** Inspired by GSD [#344](https://github.com/glittercowboy/get-shit-done/issues/344). Requires: cycle detection (prevent infinite audit↔revise or review↔fix loops), configurable max retry count, clear stop conditions, and a summary report at the end. Could support single-spec mode (`/sf:autopilot`) and batch mode (`/sf:autopilot --all` for entire queue).

---

## TODO-007 — 2026-02-06
**Description:** Dynamic spec revision during execution (`/sf:pivot`) — adjust the active specification mid-execution when requirements change or new information emerges. Currently requires pause → manual edit → resume, which loses execution context. A dedicated flow would: pause execution, present current progress, accept requirement changes, revise remaining tasks, and resume with updated plan.
**Priority:** medium
**Notes:** Combines ideas from GSD [#285](https://github.com/glittercowboy/get-shit-done/issues/285) (change of plans) and [#331](https://github.com/glittercowboy/get-shit-done/issues/331) (inject feedback mid-loop). Key challenge: preserving completed work while revising remaining tasks. Should integrate with the segmented execution model (SPEC-003) — only re-plan uncompleted segments.

---

## TODO-008 — 2026-02-06
**Description:** Health check command (`/sf:health`) — validate integrity of `.specflow/` directory structure. Checks: STATE.md consistency (referenced specs exist), orphan spec files not in queue, config.json validity, archive completeness, todo ID sequence gaps, and potential security issues (sensitive data in research/scan outputs). Reports issues with suggested fixes.
**Priority:** low
**Notes:** Inspired by GSD [#338](https://github.com/glittercowboy/get-shit-done/issues/338). Quick to implement, good reliability safeguard. Could run automatically before `/sf:status` or as a standalone diagnostic. Security aspect inspired by GSD [#429](https://github.com/glittercowboy/get-shit-done/issues/429) (API keys accidentally committed during codebase mapping).

---

## TODO-009 — 2026-02-06
**Description:** Execution trace logging — detailed structured log of all workflow decisions during `/sf:run`, `/sf:audit`, `/sf:review` and other multi-step commands. Captures: agent invocations, context estimates, wave/segment decisions, retry attempts, and timing. Written to `.specflow/logs/` for post-mortem debugging of agent behavior issues.
**Priority:** low
**Notes:** Inspired by GSD [#316](https://github.com/glittercowboy/get-shit-done/issues/316). STATE.md decision trail is high-level; this provides granular execution details. Useful for diagnosing: why a spec was flagged NEEDS_DECOMPOSITION, why a segment failed, or why a review was rejected. Should not pollute STATE.md — separate log files per execution.

---
*Last updated: 2026-02-06 (TODO-005..009 added from GSD issue analysis)*
