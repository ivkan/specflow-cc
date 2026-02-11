---
id: SPEC-004
type: refactor
status: done
priority: high
complexity: medium
created: 2026-02-11
---

# Replace Bash/awk/sed Markdown Mutations with Read+Write Tool Instructions

## Context

Multiple SpecFlow command prompts and agent definitions use Bash `awk`/`sed` pipelines to mutate markdown files, particularly STATE.md. These shell scripts break when markdown table cells contain pipe characters (`|`), which is inherent to every markdown table. This causes repeated failures in:

- **Decision rotation** (STATE.md size check) -- a ~40-line awk script duplicated in 4 command files (`sf:run`, `sf:audit`, `sf:review`, `sf:done`) that parses the Decisions table, splits it, and rewrites both STATE.md and DECISIONS_ARCHIVE.md
- **Status field updates** across multiple agents and commands (updating Active Specification, Status, Next Step lines)

The Claude Code Insights report identified this as the most frequent friction source across 49 sessions. The fix is straightforward: replace Bash-based markdown mutation instructions with explicit Read+Write tool instructions (read the file, identify the section to change, write the updated content).

### Source

TODO-010 (high priority)

## Task

Audit every command prompt file (`commands/sf/*.md`) and agent definition file (`agents/*.md`) for Bash code blocks that **mutate** (write to) markdown files. Replace each mutation with explicit Read+Write tool instructions. Preserve Bash for read-only operations (grep, ls, wc -l, file existence checks, git commands).

## Goal Analysis

### Goal Statement

Eliminate all Bash-based markdown file mutation from SpecFlow prompts so that STATE.md and other markdown files are modified reliably regardless of content.

### Observable Truths

1. No command prompt contains awk or sed that writes to a `.md` file
2. No agent definition contains awk or sed that writes to a `.md` file
3. Decision rotation uses Read+Write instead of awk pipelines
4. All markdown mutation instructions follow a consistent Read-then-Write pattern
5. Bash usage in prompts is limited to read-only operations and git commands

### Required Artifacts

| Artifact | Enables Truths |
|----------|---------------|
| `commands/sf/run.md` (updated) | 1, 3 |
| `commands/sf/audit.md` (updated) | 1, 3 |
| `commands/sf/review.md` (updated) | 1, 3 |
| `commands/sf/done.md` (updated) | 1, 3 |
| `commands/sf/revise.md` (updated) | 1 |
| `agents/spec-executor.md` (updated) | 2, 4 |
| `agents/spec-executor-orchestrator.md` (updated) | 2, 4 |
| `agents/sf-spec-executor-orchestrator.md` (updated) | 2, 4 |
| `agents/spec-auditor.md` (updated) | 2, 4 |
| `agents/impl-reviewer.md` (updated) | 2, 4 |
| `agents/spec-reviser.md` (updated) | 2, 4 |
| `agents/spec-splitter.md` (updated) | 2, 4 |
| `agents/spec-creator.md` (updated) | 2, 4 |

### Required Wiring

- The replacement instructions must produce identical outcomes to the current awk/sed scripts
- The Read+Write pattern must be clearly described so Claude knows to: (1) Read the file, (2) identify what to change, (3) Write the updated file

### Key Links

- **Decision rotation logic**: Duplicated in `sf:run`, `sf:audit`, `sf:review`, `sf:done` -- must be replaced consistently in all four
- **Agent STATE.md updates**: Multiple agents write to STATE.md (spec-executor, orchestrator, auditor, reviewer, reviser, splitter, creator) -- must all use the same pattern

## Requirements

### Files to Modify

#### Command Prompts (commands/sf/)

1. **`commands/sf/run.md`** -- Step 9.5: Replace the ~40-line awk-based decision rotation script with Read+Write instructions
2. **`commands/sf/audit.md`** -- Step 6.5: Replace the identical ~40-line awk-based decision rotation script with Read+Write instructions
3. **`commands/sf/review.md`** -- Step 7.5: Replace the identical ~40-line awk-based decision rotation script with Read+Write instructions
4. **`commands/sf/done.md`** -- Step 9 "Check STATE.md Size and Rotate if Needed": Replace the identical ~40-line awk-based decision rotation script with Read+Write instructions
5. **`commands/sf/revise.md`** -- Step 5: Replace `sed 's/--no-analysis//g'` with non-Bash argument parsing instruction

#### Agent Definitions (agents/)

6. **`agents/spec-executor.md`** -- Step 9: Clarify that STATE.md update uses Read+Write (currently says "Update" but does not specify tool; add explicit instruction)
7. **`agents/spec-executor-orchestrator.md`** -- Step 2.5, Step 3.6, Step 6, Step 7: Replace `STATE.md Execution Status table` update instructions with explicit Read+Write pattern; clarify that all STATE.md updates use Read+Write
8. **`agents/sf-spec-executor-orchestrator.md`** -- Step 8: Clarify STATE.md update uses Read+Write
9. **`agents/spec-auditor.md`** -- Step 8: Clarify STATE.md update uses Read+Write
10. **`agents/impl-reviewer.md`** -- Step 8: Clarify STATE.md update uses Read+Write
11. **`agents/spec-reviser.md`** -- Step 7: Clarify STATE.md update uses Read+Write
12. **`agents/spec-splitter.md`** -- Step 8: Clarify STATE.md update uses Read+Write
13. **`agents/spec-creator.md`** -- Step 7: Clarify STATE.md update uses Read+Write

### Replacement Pattern

For **decision rotation** (the main fix, used in 4 files), replace the Bash code block with this Read+Write instruction pattern:

```
### Check STATE.md Size and Rotate if Needed

After updating STATE.md, check if rotation is needed:

1. Use the Read tool to read `.specflow/STATE.md` and count total lines
2. If total lines <= 100, no action needed
3. If total lines > 100:
   a. Read the `## Decisions` section and extract all decision rows (lines matching `| YYYY-`)
   b. Count decision rows. If <= 7, no rotation needed
   c. If > 7 decisions:
      - Identify the 5 most recent decisions (last 5 rows) -- these STAY
      - Identify older decisions (all rows except last 5) -- these MOVE to archive
      - Read `.specflow/DECISIONS_ARCHIVE.md` (create with template if missing)
      - Write updated DECISIONS_ARCHIVE.md: insert old decisions after the table header row
      - Write updated STATE.md: replace Decisions section content with only the 5 most recent decisions
```

For **STATE.md status updates** (used in all agents), add this explicit instruction pattern:

```
Update STATE.md by reading the current file content, then writing the updated file with:
- "**Status:**" line changed to the new status
- "**Next Step:**" line changed to the new next step
- No other content modified

Use the Read tool to read `.specflow/STATE.md`, then use the Write tool to write the updated content.
Do NOT use Bash (awk, sed, or echo) to modify `.specflow/STATE.md`.
```

### Constraint: Read-Only Bash Preserved

The following Bash patterns are read-only and MUST be preserved unchanged:

- `[ -d .specflow ]` -- directory existence check
- `[ -f .specflow/config.json ]` -- file existence check
- `wc -l < .specflow/STATE.md` -- line counting (read-only, may be replaced by Read tool in decision rotation)
- `grep -c "pattern" file` -- counting matches (read-only)
- `ls -1 .specflow/specs/SPEC-*.md` -- listing files (read-only)
- `git status`, `git log`, `git add`, `git commit` -- git operations
- `cat .specflow/config.json | grep ...` -- config reading (read-only)
- `mkdir -p` -- directory creation (not markdown mutation)
- `mv` -- file moves (not markdown mutation)
- `rm` -- file deletion (not markdown mutation)

### Anti-Duplication: Extract Decision Rotation

The decision rotation logic is currently duplicated verbatim in 4 files. After replacing with Read+Write instructions, the replacement text should be identical across all 4 files (or reference a shared description). This prevents future drift.

## Acceptance Criteria

1. `commands/sf/run.md` Step 9.5 contains no awk or sed commands; decision rotation uses Read+Write instructions
2. `commands/sf/audit.md` Step 6.5 contains no awk or sed commands; decision rotation uses Read+Write instructions
3. `commands/sf/review.md` Step 7.5 contains no awk or sed commands; decision rotation uses Read+Write instructions
4. `commands/sf/done.md` "Check STATE.md Size" section contains no awk or sed commands; decision rotation uses Read+Write instructions
5. `commands/sf/revise.md` contains no sed command for argument parsing
6. All agent files that update STATE.md include an explicit "use Read+Write, not Bash" instruction for markdown mutation
7. All existing read-only Bash usage (file checks, grep, ls, git) is preserved unchanged
8. The decision rotation replacement text is identical across all 4 command files that use it
9. Running `grep -r 'awk\|sed ' commands/sf/*.md agents/*.md` returns zero matches that write to `.md` files (read-only grep/sed for non-file-mutation purposes may remain)

## Constraints

- Do NOT change the logical behavior of any command or agent -- only change the tool used for markdown mutation
- Do NOT add new features, steps, or workflow changes beyond the tool migration
- Do NOT modify template files (`templates/*.md`), the TODO file, or archived specs
- Do NOT change Bash usage for non-markdown operations (git, file checks, directory creation)
- Preserve all existing markdown output format instructions (the "IMPORTANT: Output the following..." blocks)

## Assumptions

- The Read+Write pattern (read file, modify in memory, write file) is the standard approach Claude Code uses when instructed to update markdown files without Bash
- The `Edit` tool (old_string/new_string) is also acceptable for targeted edits, but the Read+Write instruction pattern is more natural for command prompts that instruct future Claude instances
- Line count check (`wc -l`) is acceptable as read-only Bash since it does not mutate any file, but the decision rotation replacement explicitly uses the Read tool to count lines for consistency with the Read+Write pattern
- The `sed 's/--no-analysis//g'` in `sf:revise.md` can be replaced with a plain-text instruction: "Remove the `--no-analysis` flag from the arguments string"
- Agent files that say "Update STATE.md" without specifying a tool are ambiguous -- adding explicit "use Read+Write" makes the instruction clearer and prevents Bash-based mutation

## Implementation Tasks

### Task Groups

| Group | Wave | Tasks | Dependencies | Est. Context |
|-------|------|-------|--------------|--------------|
| G1 | 1 | Replace decision rotation in `sf:run.md`, `sf:audit.md`, `sf:review.md`, `sf:done.md` (identical replacement in all 4) | -- | ~25% |
| G2 | 1 | Replace sed in `sf:revise.md`; add explicit Read+Write instructions in all 8 agent files | -- | ~20% |
| G3 | 2 | Verify all files: grep for remaining awk/sed mutations, confirm read-only Bash preserved, confirm consistency | G1, G2 | ~5% |

### Execution Plan

| Wave | Groups | Parallel? | Workers |
|------|--------|-----------|---------|
| 1 | G1, G2 | Yes | 2 |
| 2 | G3 | No | 1 |

**Total workers needed:** 2 (max in any wave)

## Audit History

### Audit v1 (2026-02-11)
**Status:** NEEDS_REVISION

**Context Estimate:** ~50% total

**Critical:**
1. Item #8 references wrong file for Execution Status table steps. The spec says `sf-spec-executor-orchestrator.md` has "Step 2.5 and Step 3.6" with Execution Status table update instructions, but those steps (Step 2.5: Initialize State File, Step 3.6: Update State Per Wave) and their "Update STATE.md Execution Status table" instructions actually exist in `spec-executor-orchestrator.md` (WITHOUT the `sf-` prefix). The `sf-spec-executor-orchestrator.md` does not contain Step 2.5 or Step 3.6 at all. The Execution Status table update instructions (at lines 328, 595, 682 of `spec-executor-orchestrator.md`) should be attributed to item #7, not item #8. Item #7 currently only mentions "Step 7/Step 8" but should also include Step 2.5, Step 3.6, and Step 6.
2. Context section and Observable Truth #4 claim "Queue table row removal" in `sf:done` uses Bash/shell text processing, but `sf:done.md` line 221 already uses a plain-text instruction ("Remove SPEC-XXX row from Queue table.") with no awk/sed/bash. The Queue table replacement pattern in the Requirements section (lines 130-135) solves a problem that does not exist. Observable Truth #4 should be removed or reworded, and the Queue table replacement pattern section should be removed to avoid confusing the implementor.

**Recommendations:**
3. The Context section says decision rotation is "duplicated in 3 command files" but the Requirements section and Implementation Tasks correctly identify 4 files (including `sf:done`). The Context bullet should say "4 command files" for consistency.
4. Key Links section lists only `sf:run`, `sf:audit`, `sf:review` for decision rotation consistency but omits `sf:done`. Should include all 4 files.
5. The `wc -l` line count in the decision rotation replacement pattern (step 1: "Read STATE.md and count total lines") creates a subtle inconsistency: the replacement says to count lines by reading the file, but the existing code uses `wc -l` (read-only Bash). Consider whether the replacement should explicitly state "Use the Read tool to read the file and count lines" or preserve `wc -l` for line counting since it is read-only. Either approach works but should be explicit.
6. G2 description says "all 8 agent files" but the spec lists 8 agent files total (items 6-13). Since item #8 (`sf-spec-executor-orchestrator.md`) needs less work than described (no Step 2.5/3.6 to fix there), the context estimate for G2 (~20%) may be slightly generous but is acceptable.

### Response v1 (2026-02-11)
**Applied:** All 6 items (2 critical + 4 recommendations)

**Changes:**
1. [✓] Critical #1: Item #8 wrong file reference -- Corrected item #7 to list all applicable steps (Step 2.5, Step 3.6, Step 6, Step 7, Step 8) for `spec-executor-orchestrator.md`; rewrote item #8 to reference only the actual steps in `sf-spec-executor-orchestrator.md` (Step 6, Step 7)
2. [✓] Critical #2: Queue table manipulation claim inaccurate -- Removed Observable Truth #4 ("Queue table manipulation uses Read+Write instead of shell text processing"); removed the Queue table replacement pattern section (lines 130-135); removed `commands/sf/done.md` from Required Artifacts table row for Observable Truth #4 (now renumbered as Truth #3); updated item #4 in Files to Modify to reference only decision rotation (removed Queue table language)
3. [✓] Recommendation #3: Context inconsistency -- Changed Context bullet from "3 command files" to "4 command files"
4. [✓] Recommendation #4: Key Links omits sf:done -- Added `sf:done` to the decision rotation consistency Key Link (now lists all four files)
5. [✓] Recommendation #5: wc -l inconsistency -- Updated decision rotation replacement pattern step 1 to explicitly say "Use the Read tool to read `.specflow/STATE.md` and count total lines"; added clarification in Assumptions section and Constraint: Read-Only Bash Preserved section that `wc -l` is acceptable read-only Bash but decision rotation replacement uses Read tool for consistency
6. [✓] Recommendation #6: G2 context estimate note -- Accepted as-is; no change needed (audit acknowledges estimate is acceptable)

**Skipped:** None

### Audit v2 (2026-02-11)
**Status:** APPROVED

**Context Estimate:** ~50% total

**v1 Fix Verification:**
- Critical #1 (item #8 wrong file): Fixed. Item #7 now correctly references `spec-executor-orchestrator.md` with expanded step list. Item #8 now correctly references `sf-spec-executor-orchestrator.md`. Two minor residual inaccuracies remain (see recommendations 1-2 below).
- Critical #2 (Queue table claim): Fixed. Observable Truth #4 removed. Queue table replacement pattern removed. Only 5 Observable Truths remain, all accurate.
- Recommendation #3 (Context "3 files"): Fixed. Now says "4 command files".
- Recommendation #4 (Key Links sf:done): Fixed. All four files listed.
- Recommendation #5 (wc -l): Fixed. Replacement pattern step 1 says "Use the Read tool". Assumptions section clarifies.
- Recommendation #6 (G2 estimate): Accepted as-is. Fine.

**Audit Dimensions:**
- Clarity: Pass. Title, context, task, and replacement patterns are all clear and specific.
- Completeness: Pass. All 13 files to modify are listed with exact step references. Replacement patterns provided for both mutation types. Read-only Bash preservation list is thorough.
- Testability: Pass. All 9 acceptance criteria are concrete and verifiable (especially criterion #9 with exact grep command).
- Scope: Pass. Constraints clearly bound the work to tool migration only. No scope creep.
- Feasibility: Pass. Replacing awk/sed blocks with Read+Write instructions in prompt files is straightforward.
- Architecture fit: Pass. Read+Write is the standard tool pattern for Claude Code markdown file updates.
- Non-duplication: Pass. Anti-duplication section explicitly addresses the 4-file consistency requirement.
- Cognitive load: Pass. The replacement patterns are simpler and more readable than the awk scripts they replace.
- Strategic fit: Pass. This addresses the #1 friction source identified across 49 sessions.
- Project compliance: Pass (no PROJECT.md to violate).

**Goal-Backward Validation:**
- All 5 Observable Truths have corresponding artifacts: Truths 1,3 covered by command files; Truths 2,4 covered by agent files; Truth 5 covered by the preserved read-only Bash list and acceptance criterion #7.
- All 13 artifacts map to at least one truth. No orphan artifacts.
- Wiring is complete: replacement patterns are specified for both mutation types.
- Key links identified: decision rotation consistency (4 files) and agent update pattern (8 files).

**Execution Scope:**

| Metric | Est. Context | Target | Status |
|--------|--------------|--------|--------|
| Total spec context | ~50% | <=50% | Borderline OK |
| Largest task group | ~25% | <=30% | OK |
| Worker overhead | ~10% | <=10% | OK |

Quality Projection: GOOD range (30-50%)

**Recommendations:**
1. Item #7 lists "Step 8" for `spec-executor-orchestrator.md`, but that file has no Step 8 (its last step is Step 7). The "Step 8" reference likely leaked from `sf-spec-executor-orchestrator.md` during the v1 fix. Item #7 should read: "Step 2.5, Step 3.6, Step 6, Step 7".
2. Item #8 says "Step 6, Step 7" for `sf-spec-executor-orchestrator.md`, but Step 6 (Aggregated Self-Check) and Step 7 (Create Final Summary) in that file do not update STATE.md. Only Step 8 (Update STATE.md) does. Item #8 should read: "Step 8: Clarify STATE.md update uses Read+Write".

**Comment:** Well-structured refactor spec with clear problem statement, precise replacement patterns, and thorough file coverage. The two remaining step reference inaccuracies are minor -- implementors reading the actual files would immediately identify the correct steps since they are titled "Update STATE.md". Ready for implementation.

### Response v2 (2026-02-11)
**Applied:** Both audit v2 recommendations (2 items)

**Changes:**
1. [✓] Item #7 step reference fix -- Removed "Step 8" from `spec-executor-orchestrator.md` step list (now reads: "Step 2.5, Step 3.6, Step 6, Step 7")
2. [✓] Item #8 step reference fix -- Changed "Step 6, Step 7" to "Step 8" for `sf-spec-executor-orchestrator.md` (only Step 8 updates STATE.md)

**Skipped:** None

---

## Execution Summary

**Executed:** 2026-02-11
**Mode:** orchestrated (2 waves, 3 groups)
**Commits:** 10

### Execution Waves

| Wave | Groups | Status |
|------|--------|--------|
| 1 | G1, G2 | complete |
| 2 | G3 (verification) | complete |

### Files Modified
- `commands/sf/run.md` -- replaced decision rotation awk script with Read+Write instructions (Step 9.5)
- `commands/sf/audit.md` -- replaced decision rotation awk script with Read+Write instructions (Step 6.5)
- `commands/sf/review.md` -- replaced decision rotation awk script with Read+Write instructions (Step 7.5)
- `commands/sf/done.md` -- replaced decision rotation awk script with Read+Write instructions (Step 9)
- `commands/sf/revise.md` -- replaced sed command with plain-text instruction (Step 5)
- `agents/spec-executor.md` -- added explicit Read+Write instruction for STATE.md updates (Step 9)
- `agents/spec-executor-orchestrator.md` -- added explicit Read+Write instructions (Step 2.5, 3.6, 6, 7)
- `agents/sf-spec-executor-orchestrator.md` -- added explicit Read+Write instruction (Step 8)
- `agents/spec-auditor.md` -- added explicit Read+Write instruction (Step 8)
- `agents/impl-reviewer.md` -- added explicit Read+Write instruction (Step 8)
- `agents/spec-reviser.md` -- added explicit Read+Write instruction (Step 7)
- `agents/spec-splitter.md` -- added explicit Read+Write instruction (Step 8)
- `agents/spec-creator.md` -- added explicit Read+Write instruction (Step 7)

### Acceptance Criteria Status
- [x] AC1: `commands/sf/run.md` Step 9.5 contains no awk or sed commands; decision rotation uses Read+Write instructions
- [x] AC2: `commands/sf/audit.md` Step 6.5 contains no awk or sed commands; decision rotation uses Read+Write instructions
- [x] AC3: `commands/sf/review.md` Step 7.5 contains no awk or sed commands; decision rotation uses Read+Write instructions
- [x] AC4: `commands/sf/done.md` "Check STATE.md Size" section contains no awk or sed commands; decision rotation uses Read+Write instructions
- [x] AC5: `commands/sf/revise.md` contains no sed command for argument parsing
- [x] AC6: All 8 agent files that update STATE.md include an explicit "use Read+Write, not Bash" instruction for markdown mutation
- [x] AC7: All existing read-only Bash usage (file checks, grep, ls, git) is preserved unchanged
- [x] AC8: The decision rotation replacement text is identical across all 4 command files
- [x] AC9: No awk/sed commands that write to `.md` files remain in any command or agent file

### Deviations
- [Rule 3 - Blocking] G1 worker modified `~/.claude/` copies only; orchestrator applied identical changes to project repo copies and committed separately

### Notes
- All modified files synced to `~/.claude/` installation directory for immediate effect
- 10 commits total: 8 from G2 worker (agent files) + 2 from orchestrator (command files + revise.md)

---

## Review History

### Review v1 (2026-02-11 15:30)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Passed:**

- [✓] AC1: `commands/sf/run.md` Step 9.5 decision rotation — verified Read+Write instructions, no awk/sed commands
- [✓] AC2: `commands/sf/audit.md` Step 6.5 decision rotation — verified Read+Write instructions, no awk/sed commands
- [✓] AC3: `commands/sf/review.md` Step 7.5 decision rotation — verified Read+Write instructions, no awk/sed commands
- [✓] AC4: `commands/sf/done.md` Step 9 decision rotation — verified Read+Write instructions, no awk/sed commands
- [✓] AC5: `commands/sf/revise.md` — verified no sed command for argument parsing
- [✓] AC6: All 8 agent files — verified explicit "Do NOT use Bash (awk, sed, or echo)" instruction present
- [✓] AC7: Read-only Bash preserved — verified file checks, grep, ls, git commands unchanged
- [✓] AC8: Decision rotation consistency — verified identical replacement text across all 4 command files
- [✓] AC9: No awk/sed markdown mutations — verified zero actual awk/sed commands that write to .md files
- [✓] All 13 files modified as specified in execution summary
- [✓] All 10 commits exist in git history with correct feat(sf-004) prefix
- [✓] Consistent Read+Write pattern across all agent files
- [✓] Security — no hardcoded secrets, no vulnerabilities introduced
- [✓] Integration — changes fit naturally with existing command/agent structure
- [✓] Architecture — Read+Write pattern is the established Claude Code approach for markdown updates
- [✓] Non-duplication — decision rotation replacement eliminates previous 4-file duplication
- [✓] Cognitive load — Read+Write instructions are significantly clearer than awk scripts

**Summary:** Implementation perfectly meets all 9 acceptance criteria. All awk/sed-based markdown mutations have been replaced with explicit Read+Write tool instructions. Decision rotation logic is now consistent across all 4 command files using identical replacement text. All 8 agent files include the explicit anti-Bash instruction. Read-only Bash operations (file checks, git commands) are correctly preserved. Code quality is excellent — the replacement instructions are clearer, more maintainable, and eliminate the pipe character parsing issue that caused the original friction. No constraint violations, no security issues, proper git commits. The implementation eliminates the #1 friction source identified in the Claude Code Insights report.

---

## Completion

**Completed:** 2026-02-11
**Total Commits:** 10
**Audit Cycles:** 2
**Review Cycles:** 1
