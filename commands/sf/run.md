---
name: sf:run
description: Execute the specification (implement the code)
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<purpose>
Execute the active specification by implementing all requirements. Creates atomic commits during implementation and prepares for review.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/PROJECT.md
@~/.claude/specflow-cc/agents/spec-executor.md
</context>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf:init` first.
```
Exit.

## Step 2: Get Active Specification

Read `.specflow/STATE.md` and extract Active Specification.

**If no active specification:**
```
No active specification to execute.

Run `/sf:new "task description"` to create one.
```
Exit.

## Step 3: Load Specification

Read the active spec file: `.specflow/specs/SPEC-XXX.md`

## Step 4: Check Audit Status

**If status is "audited":**
Continue to execution.

**If status is NOT "audited":**
Show warning:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WARNING: Specification has not passed audit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Current Status:** {status}

{If audit exists and has issues:}
### Outstanding Issues

From last audit (v{N}):

**Critical:**
1. {Issue 1}
2. {Issue 2}

**Recommendations:**
3. {Recommendation 1}

---

Proceeding without audit approval may result in:
- Implementation that doesn't meet requirements
- Rework needed after review

Continue anyway?
```

Use AskUserQuestion with options:
- "Yes, proceed anyway" → continue, log warning
- "No, run audit first" → exit with `/sf:audit` suggestion

**If user proceeds anyway:**
Log in STATE.md Warnings table:
```
| {date} | SPEC-XXX | Executed without audit approval |
```

## Step 5: Pre-Execution Summary

Display what will be implemented:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXECUTING: SPEC-XXX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Title:** {spec title}
**Type:** {feature|refactor|bugfix}
**Complexity:** {small|medium|large}

### Scope

**Files to create:** {count}
**Files to modify:** {count}
**Files to delete:** {count}

### Acceptance Criteria

- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

---

Beginning implementation...
```

## Step 6: Update Status

Update STATE.md:
- Status → "running"
- Next Step → "(in progress)"

Update spec frontmatter:
- status → "running"

## Step 7: Spawn Executor Agent

Launch the spec-executor subagent:

```
Task(prompt="
<specification>
@.specflow/specs/SPEC-XXX.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

Execute this specification following the spec-executor agent instructions.
Implement all requirements with atomic commits.
", subagent_type="sf-spec-executor", description="Execute specification")
```

## Step 8: Handle Agent Response

The agent will:
1. Implement all requirements
2. Create atomic commits
3. Handle deviations
4. Add Execution Summary to spec
5. Update STATE.md to "review"

## Step 9: Display Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXECUTION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** SPEC-XXX
**Status:** Ready for review

### Summary

- **Files created:** {count}
- **Files modified:** {count}
- **Files deleted:** {count}
- **Commits:** {count}

### Acceptance Criteria

- [x] {Criterion 1}
- [x] {Criterion 2}
- [x] {Criterion 3}

{If deviations occurred:}
### Deviations

1. [Rule {N}] {description}

---

## Next Step

`/sf:review` — audit the implementation
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Execution

### Load Requirements

Parse specification for:
- Files to create/modify/delete
- Interfaces
- Acceptance criteria
- Constraints

### Implement

For each requirement:
1. Create/modify file
2. Follow project patterns
3. Meet acceptance criteria

### Commit

After each logical unit:
```bash
git add <files>
git commit -m "feat(sf-XXX): <description>"
```

### Handle Deletions

After replacements work:
1. Check no remaining references
2. Delete old files
3. Commit removal

### Update Specification

Append Execution Summary to spec.

### Update STATE.md

- Status → "review"
- Next Step → "/sf:review"

</fallback>

<success_criteria>
- [ ] Active specification identified
- [ ] Audit status checked (warning if not audited)
- [ ] All files created as specified
- [ ] All files modified as specified
- [ ] All files deleted as specified
- [ ] Atomic commits created
- [ ] Execution Summary added to spec
- [ ] STATE.md updated to "review"
- [ ] Clear next step shown
</success_criteria>
