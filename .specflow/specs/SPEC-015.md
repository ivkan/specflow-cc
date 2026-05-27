---
id: SPEC-015
type: bugfix
status: running
priority: medium
complexity: small
created: 2026-05-27
source: TODO-028
delta: true
---

# SPEC-015 — Validate TODO Frontmatter in `cmdTodoReindex` (Fail/Mark Instead of Silent Defaults)

## Context

`cmdTodoReindex` in [`bin/lib/todo.cjs`](../../bin/lib/todo.cjs) (lines ~267-354) is the chokepoint where individual `TODO-XXX.md` files become rows in `.specflow/todos/INDEX.md`. Today, when `parseFrontmatter()` returns no usable fields — for example, because the TODO was written in prose format (no `---` block; `**Status:** open` instead of YAML) — the reindex code silently fills defaults:

```js
todos.push({
  id: fm.id || file.replace('.md', ''),
  title: fm.title || '',
  priority: fm.priority || '—',
  status: fm.status || 'open',
  created: fm.created || '',
});
```

The result: a malformed TODO produces a perfectly valid-looking INDEX row with an empty title and default status. Drift is hidden, and downstream commands (`/sf:plan`, `/sf:next`) operate on rows that look fine but lack the data they need.

**Observed in production (2026-05-27, `~/Projects/topgun/topgun`):** `TODO-408.md` was created by `/sf:done` in prose format. `INDEX.md` showed `| 111 | TODO-408 |  | — | open |  |` with no error. `/sf:plan TODO-408` then operated on a row with no title.

Reindex is the narrowest waist where this can be caught. Adding validation here is defense-in-depth that does not require pinning the TODO template into every command path or installing PreToolUse hooks.

## Delta

### MODIFIED

- `bin/lib/todo.cjs` — Add frontmatter validation to `cmdTodoReindex`
  - In the file-processing loop (lines ~280-300): after `parseFrontmatter(content)`, check for required fields `id`, `title`, `created`
  - When any required field is missing OR the YAML block itself is absent: push a sentinel `{ malformed: true, reason: '<missing-fields-list>' }` instead of silently defaulting
  - Track a `malformedCount` for the run
  - Emit a per-file warning to `process.stderr` for each malformed file (filename + reason)
  - Render malformed rows in INDEX.md as `| N | TODO-XXX | MALFORMED: <reason> | — | — | — |`
  - After writing INDEX.md, if `malformedCount > 0`, set process exit code to non-zero (`process.exitCode = 1`) so callers can gate on it
  - Default behavior is strict — no opt-out flag is added unless an existing caller breaks (see Acceptance Criteria #3)
- `tests/todo-index.test.cjs` — Add unit tests for the new validation behavior (5 new cases covering AC#4)

## Task

In `cmdTodoReindex`, validate the frontmatter of every `TODO-*.md` file before adding it to the INDEX. When required fields (`id`, `title`, `created`) are missing or the frontmatter block itself is absent/unparseable, surface drift loudly: render a `MALFORMED` marker row, print a per-file warning to stderr, and set a non-zero process exit code so callers (CI, hooks, downstream commands) can gate on it. Existing well-formed TODOs must continue to render unchanged.

## Requirements

### File: `bin/lib/todo.cjs` (MODIFIED)

**Function: `cmdTodoReindex(cwd, raw)`**

1. **Required-field set.** Define the required-field set as `['id', 'title', 'created']` (a single source of truth — a top-level `const REQUIRED_TODO_FIELDS` near the top of the file).

2. **Validation in the file loop.** For each `TODO-*.md` file:
   - Call `parseFrontmatter(content)` as today.
   - Determine `missing = REQUIRED_TODO_FIELDS.filter(k => !fm[k] || String(fm[k]).trim() === '')`.
   - Also detect "no frontmatter block at all" — `parseFrontmatter` returns `frontmatter: {}` in this case, so `missing` will naturally contain all three required fields. Distinguish this case in the warning message: when `fm` is empty (no keys at all), the reason is `"no frontmatter block"`; otherwise the reason is `"missing fields: <comma-separated>"`.
   - If `missing.length > 0`, push a record `{ malformed: true, fileId: file.replace('.md', ''), reason: <string> }` onto the `todos` array instead of the normal record.
   - Otherwise push the normal record exactly as today (no behavior change for well-formed TODOs).

3. **Stderr warnings.** For each malformed file, write a line to `process.stderr` of the form:
   ```
   warn: <file> — <reason>
   ```
   Use `process.stderr.write(...)` directly; do not use `console.warn` (which adds prefixes in some contexts).

4. **Sorting.** Malformed records must still appear in the INDEX. Sort them deterministically — place them at the end of the table (after all well-formed TODOs), ordered by `fileId` ascending. Adjust the existing sort comparator to treat `malformed: true` as a higher sort key than any priority.

5. **INDEX row rendering.** For malformed records, render the row as:
   ```
   | N | TODO-XXX | MALFORMED: <reason> | — | — | — |
   ```
   The numeric column `N` still increments in order. The title column carries the `MALFORMED: <reason>` marker (truncated to 50 chars at the same boundary as well-formed titles, if needed).

6. **Counts.** Update the priority counts logic to ignore malformed records (do not double-count them as `unset`). Add a separate count: the `**Total:**` summary line gains a malformed component when `malformedCount > 0`:
   ```
   **Total:** N items (H high, M medium, L low, U unset, X malformed)
   ```
   When `malformedCount === 0`, the summary line is unchanged from today's format (preserves backward compatibility for tests/diffs of well-formed runs). **Malformed records count toward the `N items` total (they live in the same `todos` array passed to `output(...)`); they are excluded only from the priority breakdown (`H/M/L/unset`).**

7. **Exit code.** After `fs.writeFileSync(indexPath, ...)`, if `malformedCount > 0`, set `process.exitCode = 1`. Do **not** call `process.exit()` — the `output(...)` call must still complete so callers receive the JSON result. Setting `process.exitCode` lets Node exit non-zero after the event loop drains.

8. **JSON output.** Extend the `output(...)` result object with a `malformed` count:
   ```js
   output({ reindexed: todos.length, malformed: malformedCount, path: indexPath }, raw, `Reindexed ${todos.length} TODOs → INDEX.md`);
   ```
   The raw human message is unchanged (or optionally appends ` (X malformed)` when count > 0 — implementer's choice; document inline).

### File: `tests/todo-index.test.cjs` (MODIFIED)

Add 5 new test cases under the existing test harness (same `test(name, fn)` pattern):

1. **No frontmatter block.** Write a `TODO-099.md` with prose body and no `---` block. Run `cmdTodoReindex`. Assert: INDEX row contains `MALFORMED:` and `no frontmatter block`; stderr received a warning; `process.exitCode === 1`.
2. **Missing `id` field.** Write a TODO with frontmatter that omits `id` (but has `title` + `created`). Assert: row marked MALFORMED with reason mentioning `id`; exit code non-zero.
3. **Missing `title` field.** Same pattern; reason mentions `title`.
4. **Missing `created` field.** Same pattern; reason mentions `created`.
5. **Malformed YAML.** Write a TODO whose `---` block contains a line that breaks the simple parser (e.g., no colon, or only whitespace after dashes). Assert: treated as malformed (because required fields end up absent); warning + exit code as above.
6. **Regression guard.** Existing well-formed TODOs in the fixture produce no warnings, no `MALFORMED:` rows, and `process.exitCode` remains `0` (or whatever it was before the call — reset before each test). The test MUST also assert that the `**Total:**` summary line matches the exact legacy format (`**Total:** N items (H high, M medium, L low, U unset)` — no trailing `, 0 malformed` and no `X malformed` component) so downstream parsers/diffs of well-formed runs stay byte-identical.

The test must reset `process.exitCode = 0` before each test that asserts on it (since `process.exitCode` is process-wide state).

Use the existing `captureStdout` helper pattern and add a parallel `captureStderr` helper if not already present.

## Acceptance Criteria

(Verbatim from TODO-028.)

1. When a `TODO-*.md` file has no YAML frontmatter block, or is missing any of `id` / `title` / `created`, reindex MUST either:
   - render the INDEX row as `| N | TODO-XXX | MALFORMED: <reason> | — | — | — |`, AND
   - print a per-file warning to stderr (filename + missing fields), AND
   - exit non-zero overall (so callers can gate on it)
2. Existing well-formed TODOs continue to render unchanged — no regression in any well-formed TODO file on disk at implementation time.
3. The reindex CLI gains a `--strict` flag (or equivalent) only if needed to opt out of non-zero exit for bulk operations; default is strict. Document the choice inline.
4. Unit tests covering: (a) missing frontmatter block, (b) missing `id`, (c) missing `title`, (d) missing `created`, (e) malformed YAML.

## Constraints

- **Do NOT** pin `templates/todo-file.md` into every command/agent path that creates TODOs. The reindex validator is the safety net regardless. (Per TODO-028 "Out of scope".)
- **Do NOT** add a PreToolUse hook on `Write .specflow/todos/TODO-*.md`. Rejected in favor of this fix because it is noisy during triage and migrate-todos bulk ops. (Per TODO-028 "Out of scope".)
- **Do NOT** call `process.exit()` inside `cmdTodoReindex` — use `process.exitCode = 1` so the `output(...)` JSON still flushes.
- **Do NOT** add new runtime npm dependencies (per PROJECT.md constraint).
- **Do NOT** change `parseFrontmatter()` in `bin/lib/core.cjs`. Validation belongs at the `cmdTodoReindex` call site, not in the shared parser (which is also used by `cmdTodoLoad` and `cmdTodoList`, both of which have different tolerance for missing fields).
- **Do NOT** rewrite or "fix" malformed TODO files automatically. Reindex is a read-only-then-write-INDEX operation; touching the source TODOs would mask the very drift this spec is trying to surface.
- **Preserve** the existing INDEX.md header, table-column order, and `**Total:**` summary line format when zero TODOs are malformed (regression-safe for downstream tooling that may parse INDEX.md).

## Assumptions

- The existing `parseFrontmatter()` in `bin/lib/core.cjs` is sufficient — when the YAML block is malformed or absent, it returns `{ frontmatter: {} }`, which the new validation naturally detects via the missing-required-fields check. (Verified by reading `bin/lib/core.cjs` lines 57-90.)
- All 24 existing `TODO-XXX.md` files in `.specflow/todos/` are well-formed (have `id`, `title`, `created`). The spec must not introduce a regression for them. (TODO-028 says "27 current TODO files"; actual count today is 24 — the TODO was written against a different consumer project. The regression guarantee applies to whatever is on disk at implementation time.)
- No `--strict` flag is needed at implementation time. Strict-by-default with non-zero exit is the desired behavior per TODO-028 AC#3 ("only if needed"). If a bulk operation (`migrate-todos`) breaks during implementation, the implementer may add `--lenient` and document why inline. Default behavior in all callers (`/sf:todos`, `bin/sf-tools.cjs todo reindex`, and any command file that invokes it) is unchanged — they will see the non-zero exit code and can choose to act on it.
- The test runner is `node tests/todo-index.test.cjs` (matches the existing convention in that file's header comment; no `node --test` runner). The new tests follow the same pattern.
- `process.exitCode = 1` is the correct mechanism. Node sets the actual exit code at event-loop drain; this allows the JSON output to be written first. (Validated against the existing `bin/lib/core.cjs` `error()` helper, which uses `process.exit(1)` directly — but `error()` is for hard failures, whereas malformed TODOs are a soft "warn and signal" case.)
- No changes are needed to `commands/sf/*.md` files. Callers of `node bin/sf-tools.cjs todo reindex` already shell out; they will inherit the non-zero exit code automatically. The non-zero exit propagates identically regardless of invocation path — both the local form (`node bin/sf-tools.cjs todo reindex`, used in spec/test contexts) and the installed form (`node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex`, used by most consumer command files) shell out to the same `process.exitCode` mechanism. If any command's success criteria depend on a zero exit code in the malformed case, that is a separate (and desirable) failure surface — not in scope here.

## Audit History

### Audit v1 (2026-05-27)
**Status:** APPROVED

**Context Estimate:** ~17% total (well within ≤50% target)
- `bin/lib/todo.cjs` modification (single function, ~30 lines changed): ~6%
- `tests/todo-index.test.cjs` modification (add helper + 5-6 tests): ~6%
- Worker overhead: ~5%

**Delta validation:** 2/2 entries valid
- `bin/lib/todo.cjs` (MODIFIED) — file exists; line range 267-354 verified
- `tests/todo-index.test.cjs` (MODIFIED) — file exists; matches harness assumptions (`test()`, `captureStdout`, `fixture()`)

**Project compliance:** Honors PROJECT.md decisions
- No new runtime npm dependencies (explicitly cited in Constraints)
- Does not mutate STATE.md (no Bash/sed concern)
- Uses CommonJS `.cjs` convention
- Follows existing CLI boundary (no `require()` of internal modules from commands)

**Strategic fit:** Aligned with project goals
- Solves root cause (validation at narrowest waist), not symptom
- Documents and rejects two alternatives (template pinning, PreToolUse hook) with reasons inherited from TODO-028
- Defense-in-depth aligns with multi-active state / LLM-orchestrated architecture

**Deferred work:** All deferred items tracked
- "Out of scope" items in Constraints (template pinning, PreToolUse hook) are explicit *rejections*, not deferred work — no TODO needed
- `--strict` flag deferred until evidence demands it (Assumption #3) — implementation-time discretion, not unbounded future work
- Related but distinct: TODO-029 ("Wire cmdTodoCheckStale as exit gate") tracks the sibling concern in `/sf:done` finalize path

**Comment:** Tight, well-scoped bugfix spec. AC verbatim from TODO-028 (auditable), implementation guidance clearly bridges TODO ambiguity (`--strict` flag → "only if needed"), and conditional Total: line format change is justified against the regression-safe constraint. Test plan is concrete and complete. The spec correctly identifies that `parseFrontmatter()` returns `{}` for both "no `---` block" and "malformed YAML" cases, which is the keystone insight that makes the validation simple.

**Recommendations (optional, non-blocking):**

1. **AC#2 wording carries TODO-028's stale "27 current TODO files" count.** Actual count is 24 (verified via Glob). Assumption #2 addresses this, but consider tightening AC#2 to read `"no regression in any well-formed TODO file on disk at implementation time"` to remove the magic number. Minor doc hygiene.

2. **Requirement #6 introduces a conditional output format** (Total: line includes `X malformed` only when `malformedCount > 0`). This is the right call for regression safety, but the test plan should explicitly assert *both* forms — the malformed-only assertions in tests #1-#5 cover the augmented form, but the "Regression guard" (test #6) should explicitly check that the Total: line matches the *exact* legacy format (no trailing `, 0 malformed`).

3. **Requirement #5 (INDEX row numbering) is ambiguous about whether malformed rows count toward `**Total:** N items`.** Reading the implementation hint (`todos.length` in the `output(...)` call), they do — malformed records live in the same `todos` array. Worth one explicit sentence in Requirement #5 or #6: "Malformed records count toward the `N items` total; they are excluded only from the priority breakdown (`H/M/L/unset`)."

4. **Minor: spec mentions `node bin/sf-tools.cjs todo reindex` (local invocation).** Most consumer command files use `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex` (installed path). Both inherit `process.exitCode` identically, so no behavior gap, but Assumption #6 could note that the non-zero exit propagates regardless of invocation path — strengthens the "no command file changes needed" claim.

**Recommendation:** run --apply=minor — 4 non-blocking recommendation(s), apply inline

### Response v1 (2026-05-27)
**Source:** Audit v1
**Applied:** All 4 recommendations (1, 2, 3, 4) via `/sf:run --apply=minor` → `/sf:revise --internal`

**Changes:**
1. [✓] AC#2 stale "27 current TODO files" count — Replaced with "no regression in any well-formed TODO file on disk at implementation time" (removes the magic number, matches reality).
2. [✓] Test #6 (Regression guard) Total: line assertion — Extended to explicitly assert the exact legacy `**Total:** N items (H high, M medium, L low, U unset)` format (no trailing `, 0 malformed`, no `X malformed` component) so well-formed-run diffs stay byte-identical.
3. [✓] Requirement #6 ambiguity about whether malformed rows count toward `N items` — Added explicit sentence: malformed records count toward `N items` (same `todos` array) but are excluded from the H/M/L/unset priority breakdown.
4. [✓] Assumption #6 invocation-path note — Documented that non-zero `process.exitCode` propagates identically for both local (`node bin/sf-tools.cjs ...`) and installed (`node ~/.claude/specflow-cc/bin/sf-tools.cjs ...`) invocations, strengthening the "no command file changes needed" claim.

**Skipped:** none
**Deferred:** none

---

## Execution Summary

**Executed:** 2026-05-27
**Commits:** 2

### Files Created
None.

### Files Modified
- `bin/lib/todo.cjs` — Added `REQUIRED_TODO_FIELDS` const; replaced silent-defaulting loop body with frontmatter validation; updated sort comparator to place malformed records last; added MALFORMED sentinel row rendering; split priority counts to exclude malformed records; added conditional `X malformed` component to Total: line; set `process.exitCode = 1` after `writeFileSync` when malformed count > 0; added `malformed` field to `output()` result.
- `tests/todo-index.test.cjs` — Added `captureStderr` helper; added 6 new test cases (no frontmatter block, missing id, missing title, missing created, malformed YAML, regression guard with exact legacy Total: format assertion).

### Files Deleted
None.

### Acceptance Criteria Status
- [x] AC#1: When a TODO file has no YAML frontmatter block or is missing id/title/created, reindex renders `| N | TODO-XXX | MALFORMED: <reason> | — | — | — |`, prints a per-file stderr warning, and sets exit code non-zero.
- [x] AC#2: Existing well-formed TODOs continue to render unchanged — regression guard test (test #6) explicitly asserts byte-identical Total: format and zero stderr output.
- [x] AC#3: No `--strict` flag added; strict-by-default is the behavior per TODO-028 AC#3 ("only if needed"). Assumption #3 in spec documents this decision inline.
- [x] AC#4: Unit tests cover (a) missing frontmatter block, (b) missing `id`, (c) missing `title`, (d) missing `created`, (e) malformed YAML. All 15 tests pass (9 existing + 6 new).

### Deviations
None. Implementation matched the specification exactly.

### Notes
- The spec called for 5 new test cases (Requirements section for tests/todo-index.test.cjs lists items 1–5) plus "Regression guard" (item 6 in the test spec). All 6 cases were implemented.
- `parseFrontmatter()` was not changed (per Constraint). When the `---` block contains no `key: value` lines, it returns `{}`, which naturally causes all three required fields to be "missing" — the validation code distinguishes this case (`hasAnyKey === false`) and uses the `"no frontmatter block"` reason string.
- Test run result: 15 passed, 0 failed (`node tests/todo-index.test.cjs`).
