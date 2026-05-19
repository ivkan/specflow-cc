---
id: SPEC-013
type: feature
status: review
priority: p1
complexity: medium
created: 2026-05-19
delta: true
discussion: DISC-001
---

# SPEC-013: Audit/Review Recommendation Field + `--apply=minor` Quick-Fix Path

## Context

Two recurring UX gaps in the SpecFlow audit/review lifecycle force the user to manually decide "what next" on every cycle:

1. **No explicit recommendation in `/sf:audit` and `/sf:review` output.** When findings are non-blocking (audit "Recommendations" or review "Minor"), the Next Step block offers a choice without telling the user which path to take.
2. **No short-cut path** to apply 2–3 minor findings inline and finalize without running another full audit/review cycle.

This spec closes both gaps with a single unified change:
- A shared `bin/lib/recommend.cjs` module, exposed via `node bin/sf-tools.cjs recommend`, that maps `{severity counts, source}` → `{action, reason}`.
- A `Recommendation:` line in the Next Step block of `/sf:audit` and `/sf:review` output (emitted by the auditor and reviewer agents).
- An `--apply=minor` flag on `/sf:done` and `/sf:run` that internally invokes existing `/sf:fix` (review path) or `/sf:revise` (audit path) machinery, runs a project test+lint gate, and transitions to finalize/execute on success — with no second audit/review cycle.

### Prior Discussion

See `.specflow/discussions/DISC-001-audit-review-ux-gaps.md`. All four design questions are locked:

1. **Shared module location** — `bin/lib/recommend.cjs` exposed via `sf-tools.cjs recommend` subcommand (matches CLI-boundary rule from PROJECT.md).
2. **Quick-fix UX** — flag `--apply=minor` on existing `/sf:done` and `/sf:run` (not a new command, not interactive).
3. **Severity mapping** — per-command, no taxonomy change to auditor (2-tier) or reviewer (3-tier). See mapping table below.
4. **Safety gate** — project test suite + lint after applying fixes; abort + leave status unchanged on failure; no full re-audit.

### Carried Assumption (audit must verify)

**Single unified spec, not split.** The two gaps share the same mapping module, the same four command surfaces, and the same severity sources. Splitting forces gratuitous churn (one spec adds the module with no consumer, the next adds the flag). Risk if wrong: medium spec becomes large; mitigation: `/sf:split` is viable since `--apply=minor` work is a clean second wave.

## Goal

After `/sf:audit` or `/sf:review` runs, the user sees a single deterministic Recommendation in the Next Step block. When only non-blocking findings exist, the user can finalize-or-execute in one command (`/sf:done --apply=minor` or `/sf:run --apply=minor`) without manually invoking `/sf:fix`/`/sf:revise` and without running a second audit/review cycle. Existing audit/review guarantees (status integrity on failure) are preserved.

## Goal Analysis

**Goal Statement:** Deliver a single deterministic Recommendation line on `/sf:audit`/`/sf:review` output, and an `--apply=minor` quick-fix surface on `/sf:done`/`/sf:run` that applies non-blocking findings inline and gates on tests/lint or structural validation — without a second audit/review cycle.

**Required Artifacts:**
- `bin/lib/recommend.cjs` — pure mapping module (severity counts + source → action/reason).
- `bin/sf-tools.cjs recommend` subcommand — CLI dispatch shelled out by agents and `--apply=minor` callers.
- `agents/spec-auditor.md` Step 7.5 wiring — emits `**Recommendation:**` line in AUDIT RESULT output and Audit History.
- `agents/impl-reviewer.md` Step 7.5 wiring — emits `**Recommendation:**` line in REVIEW RESULT output and Review History.
- `commands/sf/done.md` `--apply=minor` handler — severity precondition, numbered-target `/sf:fix` shell-out, test+lint gate, finalize.
- `commands/sf/run.md` `--apply=minor` handler — severity precondition, numbered-target `/sf:revise --internal` shell-out, structural validate gate, execute.
- `commands/sf/revise.md` `--internal` flag — suppresses Step 8 STATE.md mutation when invoked by `--apply=minor` caller.
- `commands/sf/fix.md` `--internal` flag — suppresses Step 8 STATE.md mutation when invoked by `--apply=minor` caller (symmetric to revise.md).
- `test/recommend.test.cjs` — truth-table coverage + CLI integration + error cases.

**Required Wiring:**
- `recommend.cjs` ← consumed by `sf-tools.cjs recommend` subcommand ← shelled out by `spec-auditor` Step 7.5, `impl-reviewer` Step 7.5, `done.md --apply=minor`, `run.md --apply=minor`.
- `done.md --apply=minor` → parses latest Review History → numbered Minor list → `/sf:fix SPEC-XXX "N,M,K" --internal` → test+lint gate → `/sf:done` finalize path.
- `run.md --apply=minor` → parses latest Audit History → numbered Recommendations list → `/sf:revise SPEC-XXX "N,M,K" --internal` → `sf-tools.cjs spec validate` → `/sf:run` execute path.

**Key Links:**
1. **Recommendation truth-table → STATE.md Next Step consistency.** The action verb emitted in the Recommendation line MUST match (or be a `--apply=minor` suffix of) the canonical `/sf:` command written to STATE.md `Next Step`. Verbs per source: audit-blocker → `revise` (matches `/sf:revise`); review-blocker → `fix` (matches `/sf:fix`); audit-minor → `run --apply=minor`; review-minor → `done --apply=minor`.
2. **`--apply=minor` caller → /sf:fix or /sf:revise (with `--internal`) → gate → finalize/execute.** The caller owns severity filtering (numbered list) and STATE.md transition; the invoked fix/revise machinery applies edits without touching STATE.md (because `--internal` is passed). On gate failure: STATE.md status is unchanged (sole rollback signal); applied commits remain in git.

## Observable Truths

1. **Audit clean** — running `/sf:audit` on a spec with zero Critical and zero Recommendations prints `Recommendation: run — spec is clean, ready for execution` in the Next Step block and STATE.md Next Step is `/sf:run`.

2. **Audit minor-only** — running `/sf:audit` on a spec with zero Critical and 2 Recommendations prints `Recommendation: run --apply=minor — 2 non-blocking recommendations, apply inline` and STATE.md Next Step is `/sf:run` (canonical command stays `/sf:run`; the suffix is advisory in the Next Step block).

3. **Audit blocker** — running `/sf:audit` on a spec with 1 Critical prints `Recommendation: revise — 1 critical issue blocks execution` and STATE.md Next Step is `/sf:revise`.

4. **Review clean** — running `/sf:review` on a spec implementation with zero Critical, Major, Minor prints `Recommendation: done — implementation is clean, ready to finalize` and STATE.md Next Step is `/sf:done`.

5. **Review minor-only** — running `/sf:review` on an implementation with 3 Minor findings prints `Recommendation: done --apply=minor — 3 minor findings, apply inline before finalize` and STATE.md Next Step is `/sf:done`.

6. **Quick-fix success** — running `/sf:done --apply=minor` on a spec in `review` status with only Minor findings: invokes `/sf:fix` machinery to apply each Minor finding as an atomic commit, runs `npm test` (or repo-configured test command) and lint, then proceeds to standard `/sf:done` finalization. No second `/sf:review` is invoked. STATE.md transitions `review → done`.

7. **Quick-fix safety (test failure)** — running `/sf:done --apply=minor` when applied fixes break tests: command aborts, prints the failing test output, and leaves STATE.md status as `review` (no transition to `done`). The user is pointed to `/sf:fix` for full cycle.

8. **Quick-fix refusal (blocker present)** — running `/sf:done --apply=minor` on a spec with any Critical or Major review finding: command refuses with `Error: --apply=minor cannot be used when Critical or Major findings exist. Run /sf:fix instead.` and does not modify any files or state.

## Delta

### ADDED
- `bin/lib/recommend.cjs` — pure module exporting `recommend({source, critical, major, minor})` → `{action, reason}`; no I/O, no state mutation, fully unit-testable.
- `test/recommend.test.cjs` — `node --test` unit tests covering all six rows of the mapping table plus edge cases (negative counts, unknown source, missing fields).

### MODIFIED
- `bin/sf-tools.cjs` — Add `recommend` and `spec validate` subcommand dispatches.
  - `recommend`: Parses `--source <audit|review>`, `--critical N`, `--major N`, `--minor N` (default 0 for missing severity counts). Invokes `require('./lib/recommend.cjs').recommend(...)` and prints JSON `{action, reason}` to stdout. Exits non-zero with stderr message on missing/invalid `--source`.
  - `spec validate <SPEC-XXX>`: Positional spec ID. Reads `.specflow/specs/<SPEC-XXX>.md`, parses YAML frontmatter, verifies required fields and required headings. Exits 0 on success (no stdout); exits 1 with stderr `Error: spec validation failed: {reason}` on failure. Uses existing readers in `bin/lib/` (e.g., `bin/lib/core.cjs`). See R2.5 for exact contract.

- `agents/spec-auditor.md` — Add a step (between current Step 7 "Record Audit" and Step 8 "Update STATE.md") that calls `node bin/sf-tools.cjs recommend --source audit --critical N --minor M` with the categorized counts from Step 5, captures the `{action, reason}`, and emits a `**Recommendation:** {action} — {reason}` line in the AUDIT RESULT output's Next Step section.
  - Does NOT change Step 5 categorization (Critical/Recommendations stays 2-tier).
  - Does NOT change Step 6 status determination (APPROVED/NEEDS_DECOMPOSITION/NEEDS_REVISION unchanged).
  - Audit History recording (Step 7) appends a single `**Recommendation:** {action}` line below the existing fields.

- `agents/impl-reviewer.md` — Add a step (between current Step 7 "Record Review" and Step 8 "Update STATE.md") that calls `node bin/sf-tools.cjs recommend --source review --critical N --major N --minor M` with counts from Step 5, captures `{action, reason}`, and emits a `**Recommendation:** {action} — {reason}` line in the REVIEW RESULT output's Next Step section.
  - Does NOT change Step 5 categorization (Critical/Major/Minor stays 3-tier).
  - Does NOT change Step 6 status determination (APPROVED/CHANGES_REQUESTED unchanged).
  - Review History recording (Step 7) appends a single `**Recommendation:** {action}` line below the existing fields.

- `commands/sf/audit.md` — Document the new `Recommendation:` line in the Next Step block (around the existing "Next Step" sections at lines 189, 291, 319, 353). No logic change — auditor agent emits the line; this file documents the output schema.

- `commands/sf/review.md` — Document the new `Recommendation:` line in the Next Step block (around the existing "Next Step" sections at lines 186, 219, 263). No logic change.

- `commands/sf/done.md` — Add `--apply=minor` flag handling:
  1. Parse `--apply=minor` from invocation args.
  2. If absent: existing `/sf:done` behavior unchanged.
  3. If present:
     a. Resolve active spec; verify status == `review` (else print clear error, exit 1, no state mutation).
     b. Parse latest Review History entry; extract Critical, Major, Minor counts.
     c. Call `node bin/sf-tools.cjs recommend --source review --critical N --major M --minor K`. If `action != "done --apply=minor"`: refuse with `Error: --apply=minor requires only Minor findings (found {N} Critical, {M} Major). Run /sf:fix instead.` and exit 1. No state mutation.
     d. Invoke existing `/sf:fix` machinery internally to apply each Minor finding (atomic commit per fix, same as `/sf:fix all`).
     e. Run project test command (detect: `npm test` if `package.json` has a `test` script, else `node --test test/`). On non-zero exit: print test output, leave STATE.md status as `review`, exit 1.
     f. Run lint if configured (`package.json` `lint` script or `.eslintrc*` present); skip silently if absent. On non-zero exit: same abort semantics as (e).
     g. On success: proceed to existing `/sf:done` finalization (archive, STATE.md update, summary generation per SPEC-012).

- `commands/sf/run.md` — Add `--apply=minor` flag handling:
  1. Parse `--apply=minor` from invocation args.
  2. If absent: existing `/sf:run` behavior unchanged.
  3. If present:
     a. Resolve active spec; verify status == `audited` (else print clear error, exit 1, no state mutation).
     b. Parse latest Audit History entry; extract Critical and Recommendations counts.
     c. Call `node bin/sf-tools.cjs recommend --source audit --critical N --minor M` (Recommendations count maps to `--minor`). If `action != "run --apply=minor"`: refuse with `Error: --apply=minor requires only Recommendations (found {N} Critical). Run /sf:revise instead.` and exit 1.
     d. Invoke existing `/sf:revise` machinery internally to apply each Recommendation as a spec-level edit (atomic commit per fix).
     e. Validation gate: re-parse the spec via `node bin/sf-tools.cjs spec validate` (structural check: frontmatter parses, required sections present, dependencies resolve). On failure: print error, leave STATE.md status as `audited`, exit 1.
     f. On success: proceed to existing `/sf:run` execution path (wave dispatch, worker orchestration).

- `commands/sf/revise.md` — Accept `--internal` flag that suppresses Step 8 STATE.md mutation (status → `auditing`, Next Step → `/sf:audit`). When `--internal` is passed, `/sf:revise` applies edits and returns without touching STATE.md or spec frontmatter `status`. Rationale: `/sf:run --apply=minor` shells out to `/sf:revise` mid-flow and needs the spec lifecycle status to remain `audited` until the structural-validate gate passes. Step 8 conditional: skip status mutation when `--internal` is set; all other steps (including Audit History append for the revision, if applicable) run unchanged.

- `commands/sf/fix.md` — Accept `--internal` flag that suppresses Step 8 STATE.md mutation (status → `review`, Next Step → `/sf:review`). When `--internal` is passed, `/sf:fix` applies fix commits and returns without touching STATE.md or spec frontmatter. Rationale: symmetric to `revise.md` — `/sf:done --apply=minor` shells out to `/sf:fix` mid-flow and needs the spec lifecycle status to remain `review` until the test+lint gate passes. Verified during revision: `commands/sf/fix.md` Step 8 currently calls `node bin/sf-tools.cjs state add-active SPEC-XXX review /sf:review`, so the same mutation pattern exists; the `--internal` flag MUST guard that call.

## Requirements

### R1: Mapping module — `bin/lib/recommend.cjs`

Pure CommonJS module exporting one function:

```js
function recommend({ source, critical = 0, major = 0, minor = 0 }) {
  // returns { action: string, reason: string }
}
module.exports = { recommend };
```

Behavior (exhaustive — these are the only cases):

| source | critical | major | minor | action | reason (template) |
|--------|----------|-------|-------|--------|-------------------|
| `audit` | ≥1 | — | — | `revise` | `{critical} critical issue(s) block execution` |
| `audit` | 0 | — | ≥1 | `run --apply=minor` | `{minor} non-blocking recommendation(s), apply inline` |
| `audit` | 0 | — | 0 | `run` | `spec is clean, ready for execution` |
| `review` | ≥1 | — | — | `fix` | `{critical} critical finding(s) block finalize` |
| `review` | 0 | ≥1 | — | `fix` | `{major} major finding(s) block finalize` |
| `review` | 0 | 0 | ≥1 | `done --apply=minor` | `{minor} minor finding(s), apply inline before finalize` |
| `review` | 0 | 0 | 0 | `done` | `implementation is clean, ready to finalize` |

Notes:
- For `source: audit`, the `major` parameter is ignored (auditor has no Major tier). The CLI dispatch in `sf-tools.cjs` accepts `--major` for parser symmetry but does not pass it through.
- Unknown `source` throws an Error with message `Unknown source: {source}. Expected 'audit' or 'review'.`
- Negative count values throw `Counts must be non-negative integers.`

### R2: CLI dispatch — `bin/sf-tools.cjs recommend`

- Subcommand registered: `recommend`
- Flags: `--source <audit|review>` (required), `--critical <N>`, `--major <N>`, `--minor <N>` (each defaults to 0 if absent)
- Output: single line JSON `{"action":"...","reason":"..."}` to stdout, exit 0.
- Error: missing `--source` → stderr `Error: --source is required (audit|review)`, exit 1.
- Error: invalid `--source` value → stderr error from `recommend()`, exit 1.
- Error: non-integer count → stderr `Error: --{flag} must be a non-negative integer`, exit 1.

### R2.5: CLI dispatch — `bin/sf-tools.cjs spec validate`

- Subcommand registered: `spec validate <SPEC-XXX>` (positional spec ID, required)
- Behavior:
  1. Resolve spec path: `.specflow/specs/<SPEC-XXX>.md`. If file does not exist → exit 1, stderr `Error: spec validation failed: spec file not found at {path}`.
  2. Read file via `bin/lib/core.cjs` Read helper.
  3. Parse YAML frontmatter (the block between the two leading `---` lines). If frontmatter is missing or unparseable → exit 1, stderr `Error: spec validation failed: invalid or missing frontmatter`.
  4. Verify frontmatter contains required fields: `id`, `type`, `status`, `priority`. If any are missing → exit 1, stderr `Error: spec validation failed: missing frontmatter field '{field}'`.
  5. Verify the body contains a `## Requirements` heading (case-sensitive, line-start). If absent → exit 1, stderr `Error: spec validation failed: missing required heading '## Requirements'`.
- Output on success: no stdout, exit 0.
- This is the exact gate invoked by `/sf:run --apply=minor` (R6 step e) — no fallback path.

### R3: Auditor agent emits Recommendation line

In `agents/spec-auditor.md`, between current Step 7 (Record Audit) and Step 8 (Update STATE.md):

- Compute Critical count and Recommendations count from Step 5 categorization.
- Shell out to `node bin/sf-tools.cjs recommend --source audit --critical N --minor M`.
- Note: The CLI flag is `--minor` even though auditor uses the label "Recommendations"; this is intentional for parser symmetry across audit/review sources.
- Parse JSON response.
- In the AUDIT RESULT output (current "Next Step" line), emit:
  ```
  **Recommendation:** {action} — {reason}
  ```
- Also append the same line to the Audit History entry under Step 7.
- STATE.md Next Step field (Step 8) is unchanged — it continues to use the canonical command (`/sf:run`, `/sf:revise`, `/sf:split`); the recommendation field is advisory and only appears in agent output and audit history.

### R4: Reviewer agent emits Recommendation line

In `agents/impl-reviewer.md`, between current Step 7 (Record Review) and Step 8 (Update STATE.md):

- Compute Critical, Major, Minor counts from Step 5 categorization.
- Shell out to `node bin/sf-tools.cjs recommend --source review --critical N --major M --minor K`.
- Parse JSON response.
- In the REVIEW RESULT output (current "Next Step" line), emit:
  ```
  **Recommendation:** {action} — {reason}
  ```
- Also append the same line to the Review History entry under Step 7.
- STATE.md Next Step (Step 8) is unchanged — canonical command only.
- Verb mapping per source: for `source=review`, blocker verb is `fix` (matches STATE.md canonical `/sf:fix`); for `source=audit`, blocker verb is `revise` (matches STATE.md canonical `/sf:revise`). Non-blocker verbs are `done`/`done --apply=minor` (review) and `run`/`run --apply=minor` (audit). The asymmetry is deliberate: Recommendation verbs align with the existing per-path canonical commands, not with a unified verb set.

### R5: `commands/sf/done.md` accepts `--apply=minor`

Per Delta description above. Specific contracts:

- Status precondition: `review`. Any other status → exit 1 with `Error: --apply=minor requires status 'review' (current: {status})`. No state mutation.
- Severity precondition: latest Review History entry must show Critical=0 AND Major=0 AND Minor≥1. Computed via `node bin/sf-tools.cjs recommend --source review --critical N --major M --minor K`; refuse if action != `done --apply=minor`.
- Fix invocation: reuse existing `/sf:fix` mechanism (NOT a duplicate fixer). Method: parse latest Review History entry; extract numbered list of Minor items as a comma-separated string (e.g. `"4,5,7"` — the sequence numbers as they appear in the Minor section of Review History); shell out to existing `/sf:fix` machinery passing that string as the positional target arg (the same way `/sf:fix 1,2,3` works today). Also pass `--internal` so `/sf:fix` Step 8 does NOT mutate STATE.md (caller owns the status transition). Atomic commit per fix is preserved by `/sf:fix`'s existing behavior. Implementation MUST NOT duplicate fix logic.
- Test gate command resolution order:
  1. If `package.json` exists and has `scripts.test` → `npm test`.
  2. Else if `test/` directory exists → `node --test test/`.
  3. Else: skip with note `No test command detected; proceeding without test gate.` (still apply lint gate if available).
- Lint gate command resolution order:
  1. If `package.json` exists and has `scripts.lint` → `npm run lint`.
  2. Else if `.eslintrc*` or `eslint.config.*` present → `npx eslint .`.
  3. Else: skip silently.
- On test or lint non-zero exit: abort path, print captured stdout+stderr, leave STATE.md status as `review`, leave Review History as-is, exit 1.
- On all gates passing: continue into existing `/sf:done` finalization (archive spec, update STATE.md, generate L1 summary per SPEC-012).
- All STATE.md mutations use Read+Write (NOT Bash/awk/sed) per SPEC-004.

**Abort semantics (test/lint failure):** Applied fix commits remain in git history; user can manually `git revert` them or run a full `/sf:fix` cycle to re-apply and re-review. STATE.md status is the sole rollback signal — the spec lifecycle treats failed `--apply=minor` as if it never advanced (status stays `review`, no archive, no L1 summary generated). This is consistent with the "NO partial state on quick-fix failure" constraint: only STATE.md status is guaranteed unchanged on failure; the git history is left for the user to reconcile.

### R6: `commands/sf/run.md` accepts `--apply=minor`

Per Delta description above. Specific contracts:

- Status precondition: `audited`. Any other status → exit 1 with `Error: --apply=minor requires status 'audited' (current: {status})`. No state mutation.
- Severity precondition: latest Audit History entry must show Critical=0 AND Recommendations≥1. Computed via `node bin/sf-tools.cjs recommend --source audit --critical N --minor M`; refuse if action != `run --apply=minor`.
- Revise invocation: reuse existing `/sf:revise` mechanism. Method: parse latest Audit History Recommendations; extract numbered list as a comma-separated string (e.g. `"2,3,5"` — the sequence numbers as they appear in the Recommendations list of Audit History); shell out to existing `/sf:revise` machinery passing that string as the positional target arg (the same way `/sf:revise 1,2,3` works today). Also pass `--internal` so `/sf:revise` Step 8 does NOT mutate STATE.md (caller owns the status transition; status must remain `audited` until structural-validate gate passes). Implementation MUST NOT duplicate revise logic.
- Validation gate: spec re-parses cleanly. Command: `node bin/sf-tools.cjs spec validate SPEC-XXX` (exact contract in R2.5 — frontmatter parses, required fields present, `## Requirements` heading present). No fallback path — `spec validate` is shipped as part of G2 (see Implementation Tasks).
- On validation failure: abort path, print error, leave STATE.md status as `audited`, leave Audit History as-is, exit 1.
- On validation passing: continue into existing `/sf:run` execution (wave dispatch, worker orchestration).
- All STATE.md mutations use Read+Write per SPEC-004.

**Abort semantics (structural-validate failure):** Applied revise commits remain in git history; user can manually `git revert` them or run a full `/sf:revise` cycle to re-apply and re-audit. STATE.md status is the sole rollback signal — the spec lifecycle treats failed `--apply=minor` as if it never advanced (status stays `audited`, no execution dispatch). Because `/sf:revise --internal` did not mutate STATE.md, no status restoration is needed; the caller (`run.md`) simply does not advance. This is consistent with the "NO partial state on quick-fix failure" constraint.

### R7: Documentation of output schema

- `commands/sf/audit.md` — document the `Recommendation:` line in the four existing "Next Step" sections (around lines 189, 291, 319, 353). Show the line as part of the rendered output schema; explain it is emitted by the auditor agent.
- `commands/sf/review.md` — document the `Recommendation:` line in the three existing "Next Step" sections (around lines 186, 219, 263).
- `commands/sf/done.md` — document the `--apply=minor` flag in its usage section, including the refusal cases and the test+lint gate sequence.
- `commands/sf/run.md` — document the `--apply=minor` flag in its usage section, including the refusal cases and the structural validation gate.

### R8: Tests — `test/recommend.test.cjs`

Using `node --test`, cover at minimum:
- All 6 rows of the truth table in R1 with exactly the boundary counts (0 and 1).
- Counts >1 for each non-blocking row (verify reason includes correct count).
- Unknown source throws.
- Negative count throws.
- Missing source throws.
- CLI integration test: spawn `node bin/sf-tools.cjs recommend --source review --critical 0 --major 0 --minor 3`, assert stdout JSON matches `{action: "done --apply=minor", reason: "3 minor finding(s), apply inline before finalize"}`, exit code 0.
- CLI error test: spawn with missing `--source`, assert exit code 1 and stderr contains "--source is required".

## Acceptance Criteria

1. `node bin/sf-tools.cjs recommend --source audit --critical 0 --minor 0` outputs `{"action":"run","reason":"spec is clean, ready for execution"}` and exits 0.
2. `node bin/sf-tools.cjs recommend --source audit --critical 0 --minor 2` outputs `{"action":"run --apply=minor","reason":"2 non-blocking recommendation(s), apply inline"}` and exits 0.
3. `node bin/sf-tools.cjs recommend --source audit --critical 1 --minor 5` outputs `{"action":"revise","reason":"1 critical issue(s) block execution"}` and exits 0.
4. `node bin/sf-tools.cjs recommend --source review --critical 0 --major 0 --minor 3` outputs `{"action":"done --apply=minor","reason":"3 minor finding(s), apply inline before finalize"}` and exits 0.
5. `node bin/sf-tools.cjs recommend --source review --critical 0 --major 1 --minor 0` outputs `{"action":"fix","reason":"1 major finding(s) block finalize"}` and exits 0.
6. `node bin/sf-tools.cjs recommend --source bogus --critical 0` exits 1 with stderr containing `Unknown source`.
7. `node --test test/recommend.test.cjs` passes all assertions.
8. Running `/sf:audit` on a spec with only Recommendations renders a Next Step block containing `**Recommendation:** run --apply=minor — N non-blocking recommendation(s), apply inline` and STATE.md Next Step is `/sf:run`.
9. Running `/sf:review` on an implementation with only Minor findings renders a Next Step block containing `**Recommendation:** done --apply=minor — N minor finding(s), apply inline before finalize` and STATE.md Next Step is `/sf:done`.
10. Running `/sf:done --apply=minor` on a spec in `review` status with only Minor findings: applies fixes via `/sf:fix` machinery, runs test+lint, transitions STATE.md status `review → done`, archives spec.
11. Running `/sf:done --apply=minor` when the latest Review History shows ≥1 Major finding: exits 1 with `Error: --apply=minor cannot be used when Critical or Major findings exist` (or equivalent wording), STATE.md status remains `review`, no commits made.
12. Running `/sf:done --apply=minor` when tests fail after fix application: exits 1 with captured test output, STATE.md status remains `review` (fix commits remain in git; tests are the rollback signal).
13. Running `/sf:run --apply=minor` on a spec in `audited` status with Critical=0 and Recommendations≥1: applies revisions via `/sf:revise` machinery, runs structural validation, proceeds to execution.
14. Running `/sf:run --apply=minor` on a spec with any Critical: exits 1 with refusal error pointing to `/sf:revise`.
15. Auditor's Audit History entry for any new audit includes a `**Recommendation:**` line.
16. Reviewer's Review History entry for any new review includes a `**Recommendation:**` line.
17. `node bin/sf-tools.cjs spec validate SPEC-013` (or any valid spec) exits 0 with no stdout.
18. `node bin/sf-tools.cjs spec validate SPEC-NONEXISTENT` exits 1 with stderr containing `spec file not found`.
19. `node bin/sf-tools.cjs spec validate` on a spec with malformed frontmatter (missing required field `id`) exits 1 with stderr containing `missing frontmatter field 'id'`.
20. `node bin/sf-tools.cjs spec validate` on a spec missing the `## Requirements` heading exits 1 with stderr containing `missing required heading`.

## Validation Checklist

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | `node bin/sf-tools.cjs recommend --source review --critical 0 --major 0 --minor 3` | stdout: `{"action":"done --apply=minor","reason":"3 minor finding(s), apply inline before finalize"}`, exit 0 |
| 2 | Run `/sf:review` on a spec with only Minor findings | Output contains a `Recommendation:` line; Review History entry contains the same line; STATE.md Next Step is `/sf:done` |
| 3 | Run `/sf:done --apply=minor` on the spec from check 2 | Fix commits made (one per Minor finding); `npm test` runs and passes; STATE.md status transitions `review → done`; spec archived |
| 4 | Run `/sf:done --apply=minor` on a spec whose Review History shows 1 Major + 2 Minor | Command refuses with clear error citing Major; STATE.md status remains `review`; no commits made; no file mutations |
| 5 | In a test environment, simulate test failure after fix application (e.g., introduce a failing assertion via the Minor fix) and run `/sf:done --apply=minor` | Command aborts with test output; STATE.md status remains `review`; fix commits exist in git history but spec is not archived; user is pointed to `/sf:fix` |

## Constraints

- **NO new runtime npm dependencies.** The mapping module, CLI dispatch, test command detection, and lint command detection must use only Node.js built-ins (`child_process`, `fs`, `path`).
- **NO Bash/awk/sed mutations** of STATE.md or any `.specflow/` markdown file. Use the existing Read+Write helpers in `bin/lib/core.cjs` or equivalent (per SPEC-004).
- **NO inline STATE.md parsing** in command markdown. Use `node bin/sf-tools.cjs state resolve` (per SPEC-011).
- **NO duplication of fix or revise logic.** `/sf:done --apply=minor` MUST invoke existing `/sf:fix` machinery; `/sf:run --apply=minor` MUST invoke existing `/sf:revise` machinery. Severity filtering happens in the `--apply=minor` caller (`done.md` / `run.md`) by computing numbered targets from Review/Audit History and passing them via the existing positional API — `fix.md` / `revise.md` surfaces are unchanged with respect to severity (the only addition is the `--internal` flag for status-mutation suppression). Severity-flag extension is explicitly NOT needed.
- **NO change to auditor or reviewer severity taxonomies.** Auditor remains 2-tier (Critical/Recommendations); reviewer remains 3-tier (Critical/Major/Minor). The Recommendation field is purely a presentation/output addition.
- **NO change to STATE.md "Next Step" canonical commands.** The recommendation appears only in agent output blocks and history entries; STATE.md continues to list `/sf:run`, `/sf:done`, `/sf:revise`, `/sf:fix` without the `--apply=minor` suffix.
- **NO full re-audit or re-review** after `--apply=minor` applies fixes. Validation is the test+lint gate (review path) or structural spec validate (audit path), per DISC-001 decision 4.
- **NO partial state on quick-fix failure.** On test/lint/validate failure, STATE.md status must equal what it was before `--apply=minor` was invoked. Fix commits may remain in git (user can manually revert or run full `/sf:fix`/`/sf:revise`), but the spec lifecycle status is unchanged.
- **`--apply=minor` MUST refuse with non-zero exit** if any blocker exists (Critical for audit; Critical or Major for review). The refusal message must reference the full alternative (`/sf:fix` or `/sf:revise`).
- **All atomic writes** to spec files use the Read-then-Write pattern from `bin/lib/core.cjs` per the project Atomic Writes rule.

## Assumptions

These were resolved in DISC-001 and are treated as facts, not open assumptions:

- ~~Where the mapping logic lives~~ → `bin/lib/recommend.cjs` via `sf-tools.cjs recommend`.
- ~~How the quick-fix surface is exposed~~ → `--apply=minor` flag.
- ~~Whether the auditor/reviewer taxonomies change~~ → No, per-command mapping.
- ~~What the safety gate is~~ → Project test+lint (review path), structural spec validate (audit path).

Genuine assumptions made during spec drafting (open to challenge during audit):

1. ~~Existing `/sf:fix` machinery accepts a severity filter.~~ **Resolved in DISC-002 (decision A):** `/sf:fix` accepts numbered targets via the existing positional API (`/sf:fix 1,2,3`); no severity-flag extension needed. The `--apply=minor` caller in `done.md` (R5) computes the numbered list from Review History and passes it through the positional arg.
2. ~~Existing `/sf:revise` machinery accepts a filter for Recommendations-only.~~ **Resolved in DISC-002 (decision A):** Same pattern as above — `/sf:revise` accepts numbered targets via existing positional API; `run.md` (R6) computes the numbered list from Audit History Recommendations.
3. **Test command detection** falls back gracefully: `npm test` → `node --test test/` → skip. Repo currently uses `node --test` per PROJECT.md.
4. **Lint detection** is optional — many SpecFlow user repos won't have a linter. Skipping silently is acceptable per DISC-001 ("Run lint if configured (skip if no linter detected)").
5. **STATE.md `Next Step` field stays canonical** (no `--apply=minor` suffix). The suffix appears only in the auditor/reviewer output Next Step block, which is a separate surface. Rationale: STATE.md is consumed by other commands and tools that don't understand the suffix.
6. **Audit history "Recommendation" line** does not break SPEC-012 archive summaries. The summary generator reads structured fields from audit/review history; a new field appended at the bottom should be ignored gracefully. Audit will verify by inspecting `bin/lib/archive-summary.cjs`.
7. **Agent files live at `agents/spec-auditor.md` and `agents/impl-reviewer.md`** (project-relative, not `~/.claude/specflow-cc/agents/`). Verified by glob during spec drafting.

## Implementation Tasks

### Task Groups

| Group | Wave | Tasks | Dependencies | Est. Context |
|-------|------|-------|--------------|--------------|
| G1 | 1 | Create `bin/lib/recommend.cjs` pure module with `recommend()` function; create `test/recommend.test.cjs` covering all 6 truth-table rows + edge cases | — | ~12% |
| G2 | 2 | Add `recommend` and `spec validate` subcommand dispatches in `bin/sf-tools.cjs` (per R2 and R2.5); extend `test/recommend.test.cjs` with CLI integration tests for `recommend`; add `test/spec-validate.test.cjs` with success + each failure-mode case for `spec validate` | G1 | ~12% |
| G3 | 2 | Update `agents/spec-auditor.md`: add Step 7.5 to shell out to `sf-tools.cjs recommend`, emit `**Recommendation:**` line in output and audit history. Verify `bin/lib/archive-summary.cjs` parser handles the new `**Recommendation:**` line gracefully before merging (read parser code, confirm it is label-keyed or anchor-based — not strict-positional — against history entries; per Assumption 6) | G1 | ~11% |
| G4 | 2 | Update `agents/impl-reviewer.md`: add Step 7.5 to shell out to `sf-tools.cjs recommend`, emit `**Recommendation:**` line in output and review history. Same parser verification as G3 against review history entries | G1 | ~11% |
| G5 | 3 | Update `commands/sf/done.md`: add `--apply=minor` flag handling, severity precondition check via `sf-tools.cjs recommend`, internal `/sf:fix` invocation, test+lint gate, abort semantics | G2 | ~18% |
| G6 | 3 | Update `commands/sf/run.md`: add `--apply=minor` flag handling, severity precondition check, internal `/sf:revise` invocation, structural validation gate, abort semantics | G2 | ~18% |
| G7 | 4 | Update `commands/sf/audit.md` and `commands/sf/review.md` to document the new `Recommendation:` line in their output schema sections; update `commands/sf/done.md` and `commands/sf/run.md` usage docs for `--apply=minor` | G3, G4, G5, G6 | ~8% |

Note: G3 and G4 only depend on G1 (the pure module is sufficient for them to wire shell-out). The CLI dispatch (G2) is what the agents actually invoke at runtime, but the documentation/wiring in the agent prompts can reference the CLI shape established by G1's truth table. If the auditor decides G3/G4 should wait for G2 to land first (to avoid referencing a not-yet-wired CLI subcommand), move them to Wave 3.

### Execution Plan

| Wave | Groups | Parallel? | Workers |
|------|--------|-----------|---------|
| 1 | G1 | No | 1 |
| 2 | G2, G3, G4 | Yes | 3 |
| 3 | G5, G6 | Yes | 2 |
| 4 | G7 | No | 1 |

**Total workers needed:** 3 (max in Wave 2)

## Out of Scope

- Unifying auditor and reviewer severity taxonomies (auditor's 2-tier vs reviewer's 3-tier asymmetry). DISC-001 decision 3 explicitly keeps both unchanged.
- Adding `--apply=major` or `--apply=all` flags (DISC-001 notes these as future-extensible but not in this spec).
- Interactive prompts for severity selection (DISC-001 decision 2: non-interactive flag, works in autopilot/CI).
- Re-running the full audit or review agent after `--apply=minor` (DISC-001 decision 4: targeted test+lint gate only).
- Changing the canonical `Next Step` value in STATE.md to include `--apply=minor` (kept as advisory in agent output only).
- Refactoring `/sf:fix` or `/sf:revise` internals beyond what is strictly required to invoke them with a severity filter.

## Audit History

### Audit v1 (2026-05-19)
**Status:** NEEDS_REVISION

**Context Estimate:** ~86% total across 7 task groups; max single worker ~18% (G5 / G6). Distributed wave execution keeps per-worker context within target (≤30%).

**Delta validation:** 9/9 entries valid (2 ADDED files do not exist, 7 MODIFIED files exist). One inconsistency: Delta entry for `commands/sf/review.md` cites line numbers `186, 219, 263, 344`, but only 3 `## Next Step` sections exist (lines 186, 219, 263). R7 lists the correct 3 lines — Delta entry should align.

**Project compliance:** ✓ Honors PROJECT.md decisions (no new runtime deps, no Bash/awk/sed mutations, no inline STATE.md parsing, CLI boundary via sf-tools.cjs).

**Strategic fit:** ✓ Aligned with project goals — UX polish for existing audit/review lifecycle, no scope overlap with completed SPEC-005/011/012.

**Deferred work:** 5 items in Out of Scope (`--apply=major`, `--apply=all`, taxonomy unification, full re-audit, etc.). None tracked as TODOs — recommend creating TODOs for the most plausible future extensions.

**Critical:**

1. **Action verb `revise` for review-path blockers is misleading.** The truth table (R1) maps `review + critical≥1` and `review + major≥1` to action `revise`, but the canonical command for blocking review findings is `/sf:fix` (per `commands/sf/review.md` line 265 and STATE.md transitions in `/sf:fix`). The Recommendation line will tell users `**Recommendation:** revise — 1 critical finding(s) block finalize` while STATE.md Next Step is `/sf:fix`. This contradicts Observable Truth wording and creates a usability bug. DISC-001 line 96 itself flags this as "revise (i.e. `/sf:fix` for full cycle)" — the spec must resolve this naming. Suggested fix: review-path blockers should map to action `fix` (not `revise`), with reason templates updated. Alternative: action `revise` is overloaded but spec must explicitly explain that for review path it means `/sf:fix`.

2. **`/sf:revise` machinery sets status to `auditing` and Next Step to `/sf:audit` as a side effect** (per `commands/sf/revise.md` lines 523-528 and Step 8 in the inline fallback). The `/sf:run --apply=minor` flow described in Delta and R6 says to invoke revise machinery, then proceed to execution. But the existing revise machinery mutates STATE.md mid-flow, breaking the assumption that status stays at `audited` until validation passes. The spec doesn't address how `--apply=minor` avoids or rolls back this status mutation. Either (a) spec must specify a "no-status-mutation" mode of revise invocation, or (b) spec must explicitly describe restoring status to `audited` after revise machinery returns, and (c) must define the failure path if validation fails AFTER revise has already mutated STATE.md.

3. **Existing `/sf:fix` and `/sf:revise` do not accept a `--severity=minor` filter.** They accept `all`, `"1,2,3"` (numbered items), or interactive/custom modes (`commands/sf/fix.md` Step 5, `commands/sf/revise.md` Step 5). Assumption 1 calls this "trivially extendable" but the spec doesn't describe HOW the `--apply=minor` caller passes severity-filtered items. Concrete options: (a) compute numbered Minor items from latest Review/Audit and pass as `"1,2,3"`, (b) add a new `--severity=minor` flag to fix.md/revise.md as part of this spec. Either choice has implementation implications that need explicit spec direction. Without this, G5/G6 implementers may pick incompatible approaches.

**Recommendations:**

4. **Delta entry for `commands/sf/review.md` cites 4 line numbers (line 85: "lines 186, 219, 263, 344") but only 3 Next Step sections exist.** R7 correctly lists 3. Drop the `344` to align the Delta with R7.

5. **Add explicit note in R3** that for the auditor source, the CLI param is `--minor M` even though the source-side label is "Recommendations". Implementers reading R3 in isolation may pass `--recommendations` or be confused about the name asymmetry. The truth table covers this but R3's prose does not call it out.

6. **Goal Analysis section not present.** This is a medium spec with 8 Observable Truths — recommend a brief Goal Analysis section with subsections (Required Artifacts, Required Wiring, Key Links) for traceability. Truth coverage and artifact mapping look solid implicitly, but explicit structure helps future spec referencers.

7. **Add explicit TODO trigger for deferred work in Out of Scope.** Items `--apply=major`, `--apply=all`, taxonomy unification, interactive severity selection are explicitly deferred. Create TODOs via `/sf:todo` to prevent scope loss across spec lifecycles.

8. **R5 / R6 abort semantics on partial state are ambiguous for the run-path validation failure.** If `/sf:revise` machinery mutates the spec file (atomic commit applied) then validation fails: the spec says "leave STATE.md status as `audited`" but does not address whether the applied commits should be reverted, kept, or surfaced to the user. Suggest spelling out: "Applied commits remain in git history; user can manually revert via `git revert` or run full `/sf:revise` cycle. STATE.md status is the sole rollback signal."

9. **Strategic note:** Acceptance Criterion 5 outputs `{"action":"revise",...}` for review path. If Critical 1 fix is adopted (verb-per-source-path), this criterion will need to update to `{"action":"fix",...}`. Flag for re-confirmation after revision.

10. **[Deferred]** Deferred work mentioned but no TODO found: `--apply=major`, `--apply=all`, taxonomy unification. Create via `/sf:todo` to prevent scope loss.

### Response v1 (2026-05-19)
**Applied:** all 3 critical issues + all 5 recommendations per DISC-002 locked decisions (user-confirmed 2026-05-19, options A/A/A for criticals; defaults for recs 4-8 per DISC-002 line 130-136).

**Changes:**
1. [✓ Applied] Critical 1 — action verb conflict for review-path blockers — R1 truth table rows for `review + critical≥1` and `review + major≥1` changed from action `revise` to action `fix`; AC 5 expected output updated to `{"action":"fix","reason":"1 major finding(s) block finalize"}`; R4 prose appended with verb-per-source mapping ("source=review blocker verb is `fix` matching `/sf:fix`; source=audit blocker verb is `revise` matching `/sf:revise`"). Recommendation line and STATE.md Next Step now align per-path.
2. [✓ Applied] Critical 2 — `/sf:revise` STATE.md side-effect during `/sf:run --apply=minor` — Delta MODIFIED gains new entry for `commands/sf/revise.md` documenting `--internal` flag that suppresses Step 8 status mutation. R6 step (d) updated to specify `--internal` is passed when shelling out to `/sf:revise`. Verified during revision that `commands/sf/fix.md` Step 8 has the same mutation pattern (line 179: `node bin/sf-tools.cjs state add-active SPEC-XXX review /sf:review`), so a parallel Delta MODIFIED entry for `commands/sf/fix.md` with the same `--internal` flag rationale was added (referenced from R5 step (d)).
3. [✓ Applied] Critical 3 — severity filter delivery to `/sf:fix` and `/sf:revise` — R5 step (d) rewritten to: parse latest Review History, extract numbered Minor items as comma-separated string, shell out to `/sf:fix SPEC-XXX "N,M,K" --internal` via existing positional API. R6 step (d) rewritten symmetrically for Audit History Recommendations → `/sf:revise SPEC-XXX "N,M,K" --internal`. Assumptions 1 and 2 marked resolved (strikethrough + replacement text citing DISC-002 decision A). Constraint on "NO duplication" clarified explicitly: severity filtering happens in the `--apply=minor` caller; fix.md/revise.md surfaces unchanged with respect to severity.
4. [✓ Applied] Rec 4 — Delta entry for `commands/sf/review.md` cited 4 line numbers, only 3 exist — dropped `344` from the Delta MODIFIED line (now reads `186, 219, 263`); R7 already lists the correct 3 lines (no change there).
5. [✓ Applied] Rec 5 — R3 doesn't call out audit-source `--minor` vs label "Recommendations" — added a one-line clarification note in R3 after the "Shell out to..." sentence: "Note: The CLI flag is `--minor` even though auditor uses the label 'Recommendations'; this is intentional for parser symmetry across audit/review sources."
6. [✓ Applied] Rec 6 — Goal Analysis section missing — added a Goal Analysis section between `## Goal` and `## Observable Truths` with Goal Statement, Required Artifacts (9 bullets including `commands/sf/fix.md --internal` and `commands/sf/revise.md --internal`), Required Wiring (3 connection points), and Key Links (2 critical paths: truth-table → STATE.md Next Step consistency; `--apply=minor` caller → gate → finalize/execute).
7. [⏸ Deferred → 4 TODOs] Rec 7 — Out-of-Scope deferrals not tracked as TODOs — deferred to mandatory Step 5.5 TODO creation; 4 TODOs created (one per deferred item: `--apply=major`, `--apply=all`, taxonomy unification, interactive severity selection). See TODOs Created below.
8. [✓ Applied] Rec 8 — R5/R6 abort semantics ambiguous for applied commits on validation failure — added a closing paragraph to BOTH R5 and R6: "Applied [fix|revise] commits remain in git history; user can manually `git revert` them or run a full `/sf:[fix|revise]` cycle. STATE.md status is the sole rollback signal — the spec lifecycle treats failed `--apply=minor` as if it never advanced. This is consistent with the 'NO partial state on quick-fix failure' constraint."

**Skipped:** none — all 8 audit items addressed (item 7 deferred via TODO mechanism per DISC-002 default; not skipped).

**Deferred:** 4 items from Rec 7 → individual TODOs (see below).

**TODOs Created:**
- TODO-023 — Add `--apply=major` flag to /sf:done / /sf:run (extension of SPEC-013)
- TODO-024 — Add `--apply=all` flag to /sf:done / /sf:run (extension of SPEC-013)
- TODO-025 — Unify auditor and reviewer severity taxonomies (auditor 2-tier ↔ reviewer 3-tier)
- TODO-026 — Interactive severity selection prompt (alternative UX to --apply=minor flag)

### Audit v2 (2026-05-19)
**Status:** APPROVED

**Context Estimate:** ~86% total across 7 task groups; max single worker ~18% (G5 / G6). Distributed wave execution keeps per-worker context within target (≤30%). Unchanged from v1 — revision did not alter task grouping.

**v1 Critical Resolution Verification:**

| v1 Critical | Resolution Verified |
|-------------|---------------------|
| C1: review-blocker verb conflict | ✓ R1 truth-table rows 4 & 5 use action `fix`; AC 5 outputs `"action":"fix"`; R4 prose (line 205) explicitly documents verb-per-source mapping; Key Links #1 in Goal Analysis spells out canonical alignment |
| C2: `/sf:revise` STATE.md side-effect | ✓ New Delta entry for `commands/sf/revise.md` introduces `--internal` flag suppressing Step 8 mutation; R6 step (d) passes `--internal`; symmetric Delta entry for `commands/sf/fix.md` (smart symmetric extension); R5 step (d) passes `--internal` for `/sf:done --apply=minor` path |
| C3: severity-filter strategy | ✓ R5/R6 step (d) rewritten to use existing positional API `"N,M,K"`; verified `commands/sf/fix.md` line 98 and `commands/sf/revise.md` line 165 already document `"1,2,3"` numbered targets; Assumptions 1 & 2 marked resolved with DISC-002 citation; "NO duplication" constraint clarified |

**Delta validation:** 11/11 entries valid (2 ADDED files do not exist on disk as expected; 9 MODIFIED files all exist: `bin/sf-tools.cjs`, `agents/spec-auditor.md`, `agents/impl-reviewer.md`, `commands/sf/audit.md`, `commands/sf/review.md`, `commands/sf/done.md`, `commands/sf/run.md`, `commands/sf/revise.md`, `commands/sf/fix.md`).

**Goal Analysis validation:** ✓ Section now present (was the v1 Rec 6 gap). All four subsections (Goal Statement, Required Artifacts, Required Wiring, Key Links) populated. Required Artifacts (9) match Delta entries 1:1. Key Links #2 correctly identifies the critical gate path that Critical 2's resolution depends on. Goal Statement → Observable Truths coverage: every truth (1–8) maps to ≥1 artifact and ≥1 wiring connection.

**Project compliance:** ✓ Honors all PROJECT.md decisions:
- No new runtime npm dependencies (uses Node.js built-ins only — explicit constraint)
- No Bash/awk/sed mutations of STATE.md (constraint explicit; R5/R6 reaffirm SPEC-004)
- No inline STATE.md parsing (constraint explicit; per SPEC-011)
- CLI boundary preserved (recommend logic in `bin/sf-tools.cjs` subcommand)
- No scope intrusion (out-of-scope items deferred to TODO-023..026; no project-wide deferrals violated)

**Language profile:** No `## Language Profile` section in PROJECT.md → check skipped (correct behavior).

**Strategic fit:** ✓ Aligned with project goals — UX polish over existing audit/review lifecycle. Reuses existing `/sf:fix`/`/sf:revise` machinery via established positional API (no reinvention). Symmetric extension of `--internal` to both `fix.md` and `revise.md` is a clean structural improvement that emerged from revision and strengthens the design.

**Deferred work:** ✓ All four genuine deferred extensions tracked as TODO-023..026 (`--apply=major`, `--apply=all`, taxonomy unification, interactive severity selection). The remaining "Out of Scope" entries (re-running full audit/review, canonical Next Step suffix, refactoring fix/revise internals) are explicit architectural non-goals from DISC-001 — these are anti-features, not deferred work, so no TODO required.

**Recommendations:**

1. **`node bin/sf-tools.cjs spec validate` does not currently exist** in `bin/sf-tools.cjs` (the existing subcommands are `spec load`, `spec list`, `spec next-id`). R6 step (e) acknowledges this with a graceful fallback ("if no such subcommand exists, the lightest available structural check..."), but this leaves G6 implementers a choice that could ship inconsistently. Consider one of: (a) add `spec validate` as an explicit task in G2 alongside the `recommend` subcommand (the structural check is small — frontmatter parse + section header presence), or (b) pin the fallback to a specific behavior (e.g., "re-run `node bin/sf-tools.cjs spec load SPEC-XXX` and assert exit 0; assert frontmatter contains `status`, `id`, `type`, `priority`; assert `## Requirements` heading present"). Option (a) is cleaner and adds minimal scope.

2. **Audit history "Recommendation" line interaction with SPEC-012 archive summaries** is asserted in Assumption 6 ("should be ignored gracefully") but not verified during this audit. Recommend G3/G4 implementers spot-check `bin/lib/archive-summary.cjs` parser logic against a sample Audit/Review History entry containing the new `**Recommendation:**` line before merging. If the parser is strict-positional rather than label-keyed, the new line could shift section detection. Low risk (Assumption 6 reasoning is sound), but verification belongs in the implementation step, not deferred to discovery during done/review.

**Comment:** v1 critical issues are all cleanly resolved; the symmetric extension of `--internal` to `commands/sf/fix.md` (beyond just `commands/sf/revise.md`) is a particularly strong choice that emerged from honest verification during revision and prevents an entire class of future asymmetry bugs. Goal Analysis fills the v1 traceability gap. The 7 task groups split across 4 waves keep per-worker context within target. Two optional recommendations remain but neither blocks execution.

### Direct Application (2026-05-19, post-Audit v2)

**Rec 1 applied:** Added R2.5 with explicit `spec validate` contract (frontmatter parse + required fields + `## Requirements` heading check); updated Delta entry for `bin/sf-tools.cjs` to include both `recommend` and `spec validate` subcommands; updated R6 step (e) to remove the "or equivalent" fallback and reference R2.5; extended G2 task description to ship `spec validate` alongside `recommend`; added AC 17–20 covering success + each failure-mode case.

**Rec 2 applied:** Extended G3 and G4 task descriptions with an explicit `bin/lib/archive-summary.cjs` parser spot-check step (verify label-keyed/anchor-based, not strict-positional, against history entries containing the new `**Recommendation:**` line — per Assumption 6) before merging.

Frontmatter `status: auditing` → `status: audited` to match STATE.md.

## Execution Summary

**Executed:** 2026-05-19
**Mode:** orchestrated
**Commits:** 5

### Execution Waves

| Wave | Groups | Status |
|------|--------|--------|
| 1 | G1 | complete |
| 2 | G2, G3, G4 | complete |
| 3 | G5, G6 | complete |
| 4 | G7 | complete |

### Files Created

- `bin/lib/recommend.cjs` — pure recommend() mapping module
- `test/recommend.test.cjs` — 28 unit + CLI integration tests
- `test/spec-validate.test.cjs` — 11 spec validate CLI tests

### Files Modified

- `bin/sf-tools.cjs` — added `recommend` and `spec validate` subcommand dispatches
- `agents/spec-auditor.md` — added Step 7.5 (Recommendation line emission)
- `agents/impl-reviewer.md` — added Step 7.5 (Recommendation line emission)
- `commands/sf/done.md` — added Step 2.5 (`--apply=minor` handler) + fix.md `--internal` doc
- `commands/sf/run.md` — added Step 3.5 (`--apply=minor` handler) + revise.md `--internal` doc
- `commands/sf/fix.md` — added `--internal` flag (Step 8 STATE.md mutation guard)
- `commands/sf/revise.md` — added `--internal` flag (Step 8 STATE.md mutation guard)
- `commands/sf/audit.md` — documented `Recommendation:` line in output schema
- `commands/sf/review.md` — documented `Recommendation:` line in output schema

### Acceptance Criteria Status

- [x] AC 1: `recommend --source audit --critical 0 --minor 0` → `{"action":"run",...}` exit 0
- [x] AC 2: `recommend --source audit --critical 0 --minor 2` → `{"action":"run --apply=minor",...}` exit 0
- [x] AC 3: `recommend --source audit --critical 1 --minor 5` → `{"action":"revise",...}` exit 0
- [x] AC 4: `recommend --source review --critical 0 --major 0 --minor 3` → `{"action":"done --apply=minor",...}` exit 0
- [x] AC 5: `recommend --source review --critical 0 --major 1 --minor 0` → `{"action":"fix",...}` exit 0
- [x] AC 6: `recommend --source bogus` exits 1 with `Unknown source`
- [x] AC 7: `node --test test/recommend.test.cjs` passes all assertions (28/28)
- [x] AC 8: auditor agent Step 7.5 emits `**Recommendation:**` in AUDIT RESULT Next Step block
- [x] AC 9: reviewer agent Step 7.5 emits `**Recommendation:**` in REVIEW RESULT Next Step block
- [x] AC 10: `done.md --apply=minor` handler documented (severity check, /sf:fix, test+lint gate)
- [x] AC 11: `done.md --apply=minor` refuses with error when Critical/Major findings exist
- [x] AC 12: `done.md --apply=minor` aborts on test failure; STATE.md status unchanged
- [x] AC 13: `run.md --apply=minor` applies revisions via /sf:revise machinery + validate gate
- [x] AC 14: `run.md --apply=minor` refuses with error when Critical findings exist
- [x] AC 15: `spec-auditor.md` Step 7.5 adds `**Recommendation:**` to Audit History entry
- [x] AC 16: `impl-reviewer.md` Step 7.5 adds `**Recommendation:**` to Review History entry
- [x] AC 17: `spec validate SPEC-013` exits 0 with no stdout
- [x] AC 18: `spec validate SPEC-NONEXISTENT` exits 1 with `spec file not found`
- [x] AC 19: `spec validate` on spec missing `id` exits 1 with `missing frontmatter field 'id'`
- [x] AC 20: `spec validate` on spec missing `## Requirements` exits 1 with `missing required heading`

### Deviations

None — implemented as specified.
