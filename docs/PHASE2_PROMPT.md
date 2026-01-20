# Task: SpecFlow Implementation — Phase 2 (Revision & Execution)

## Context

**Project:** SpecFlow — spec-driven development system for Claude Code
**Directory:** ~/Projects/specflow-cc
**Full Specification:** docs/DESIGN.md
**Repository:** https://github.com/ivkan/specflow-cc

## Phase 1 Completed

The following are already implemented and working:
- `/sf init` — project initialization
- `/sf new` — specification creation
- `/sf audit` — specification audit
- `/sf status` — status display

**Existing files to study:**
- `commands/sf/init.md`, `new.md`, `audit.md`, `status.md`
- `agents/spec-creator.md`, `spec-auditor.md`
- `templates/project.md`, `state.md`, `spec.md`

## Reference

GSD (for pattern borrowing): `/Users/koristuvac/Projects/dev/get-shit-done`

**Relevant GSD files:**
- `workflows/execute-plan.md` — execution workflow
- `agents/gsd-executor.md` — executor agent pattern
- `agents/gsd-verifier.md` — verification agent pattern

---

## Phase 2: Revision & Execution Commands

### Goal

Complete the core workflow cycle:
- Specification revision based on audit feedback
- Specification execution (implementation)
- Implementation review (audit)
- Implementation fixes based on review
- Task completion

### Commands to Implement

#### 1. `/sf revise [instructions]`

**File:** `commands/sf/revise.md`

**Functionality:**
- Without arguments: show audit comments interactively
- With arguments: apply specified changes
- Read last audit from active specification
- Update specification based on instructions
- Record "Response to audit vN" in Audit History
- Update status in STATE.md to `auditing`

**Behavior:**
```
/sf revise          → Interactive: show comments, ask what to fix
/sf revise all      → Apply all audit comments
/sf revise 1,2      → Apply only items 1 and 2
/sf revise [text]   → Apply described changes
```

**Agent needed:** `agents/spec-reviser.md`

---

#### 2. `/sf run`

**File:** `commands/sf/run.md`

**Functionality:**
- Check if spec is `audited` status
- If not audited: show warning with audit comments, ask for confirmation
- Execute specification (implement the code)
- Create atomic commits during implementation
- Update status to `review` when done
- Create execution summary in specification

**Agent needed:** `agents/spec-executor.md`

**Key principle:** Follow specification exactly. Use deviation rules from DESIGN.md section 3.7 for handling edge cases.

---

#### 3. `/sf review`

**File:** `commands/sf/review.md`

**Functionality:**
- Read specification and implementation
- Launch subagent for implementation review (fresh context)
- Check:
  - Code quality and architecture
  - Compliance with specification
  - Integration with existing code
  - Best practices
  - Files deleted as specified
  - No duplication
- Record result in specification (Review History section)
- Update status: `done` if approved, `review` if needs fixes

**Agent needed:** `agents/impl-reviewer.md`

**Output format:** Similar to `/sf audit` but for implementation.

---

#### 4. `/sf fix [instructions]`

**File:** `commands/sf/fix.md`

**Functionality:**
- Without arguments: show review comments interactively
- With arguments: apply specified fixes
- Read last review from active specification
- Apply fixes to implementation
- Create atomic commits for fixes
- Record "Fix response vN" in Review History
- Update status to `review` for re-review

**Behavior:** Mirror of `/sf revise` but for implementation fixes.

**Agent needed:** Can reuse `spec-executor.md` with fix mode, or create `agents/impl-fixer.md`

---

#### 5. `/sf done`

**File:** `commands/sf/done.md`

**Functionality:**
- Check if spec has passed review (status should allow completion)
- If not reviewed/approved: show warning, ask for confirmation
- Create final commit if needed
- Update specification status to `done`
- Move specification to `.specflow/archive/`
- Update STATE.md:
  - Remove from queue
  - Record completion date
  - Extract decisions to Decisions table
- Show completion summary

---

## Implementation Requirements

### Atomic Commits

One commit per completed unit of work:
- `feat(sf): add /sf revise command`
- `feat(sf): add /sf run command`
- `feat(sf): add /sf review command`
- `feat(sf): add /sf fix command`
- `feat(sf): add /sf done command`

### Testing

After implementing each command:
1. Test with existing spec from Phase 1 test
2. Verify STATE.md updates correctly
3. Verify specification file updates correctly

### Consistency

- Follow patterns established in Phase 1 commands
- Use same XML structure for commands
- Use same agent prompt structure
- Maintain consistency with DESIGN.md

---

## Implementation Order

1. **Agent:** `agents/spec-reviser.md`
2. **Command:** `commands/sf/revise.md`
3. **Agent:** `agents/spec-executor.md`
4. **Command:** `commands/sf/run.md`
5. **Agent:** `agents/impl-reviewer.md`
6. **Command:** `commands/sf/review.md`
7. **Command:** `commands/sf/fix.md` (may reuse executor)
8. **Command:** `commands/sf/done.md`

---

## Phase 2 Completion Criteria

- [ ] `/sf revise` shows audit comments and applies changes
- [ ] `/sf revise all` applies all comments automatically
- [ ] `/sf run` executes specification with atomic commits
- [ ] `/sf run` shows warning if spec not audited
- [ ] `/sf review` performs implementation review
- [ ] `/sf fix` applies implementation fixes
- [ ] `/sf done` archives specification and updates state
- [ ] All commands work in Claude Code
- [ ] Code is committed and pushed

---

## After Completion

Report readiness for Phase 3 (Navigation & To-Do):
- `/sf list`
- `/sf show`
- `/sf next`
- `/sf todo`
- `/sf todos`
- `/sf plan`
- `/sf priority`
- `/sf pause`
- `/sf resume`

---

## Notes

- The `/sf run` command is the most complex — it needs to actually write code
- Consider how executor handles large specifications
- Review should check deletion of old files explicitly
- `/sf done` should gracefully handle edge cases (no review, etc.)
