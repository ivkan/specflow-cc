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

## TODO-011 — 2026-02-11
**Description:** Active spec validation and child spec disambiguation — before executing any workflow command (`/sf:run`, `/sf:review`, `/sf:fix`, etc.), verify the target spec ID against STATE.md active spec. When child specs exist (e.g., SPEC-016a, SPEC-016b), require explicit confirmation of which child to target. Prevents costly mis-targeting that wastes a full command cycle.
**Priority:** medium
**Notes:** Identified by Claude Code Insights report. Claude targeted SPEC-016b instead of SPEC-016a in one session, requiring interrupt and restart. Could be implemented as a guard clause in the shared workflow preamble or as a pre-execution validation step in each command prompt.

---

## TODO-012 — 2026-02-11
**Description:** Impact analysis / dry-run before execution (`/sf:impact` or `--dry-run` flag) — analyze blast radius of a spec before committing to implementation. Runs `tsc --noEmit`, maps affected files, estimates cascading changes, and reports scope assessment. Prevents the pattern where scoped fixes balloon (e.g., 5 targeted TS errors → 42 actual errors + broken mocks).
**Priority:** medium
**Notes:** Identified by Claude Code Insights report. A session targeting 5 TypeScript errors discovered 41 additional errors and broken integration test mocks, forcing expanded scope. Could be a standalone command or an optional pre-step in `/sf:run`. Should produce a brief report: files affected, estimated change count, risk areas.

---

## TODO-013 — 2026-02-11
**Description:** Parallel spec execution — run multiple independent specifications simultaneously via coordinated sub-agents on separate feature branches. A coordinator reads the dependency graph, identifies non-dependent specs, spawns parallel Task agents (one per spec), and merges completed branches sequentially with integration testing after each merge.
**Priority:** low
**Notes:** Described in Claude Code Insights "On the Horizon" section. Builds on existing Task tool usage (193 invocations in 10 days). Requires: dependency graph analysis from `/sf:deps`, branch management per spec, conflict detection, and a merge coordinator. Large scope but could compress multi-day sprints significantly. Depends on TODO-006 (autopilot) as a prerequisite for single-spec autonomous execution.

---
*Last updated: 2026-02-11 (TODO-006 converted to SPEC-005; TODO-010 converted to SPEC-004; TODO-011..013 from Claude Code Insights analysis)*
