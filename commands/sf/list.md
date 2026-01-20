---
name: sf:list
description: List all specifications with status, priority, and complexity
allowed-tools:
  - Read
  - Bash
  - Glob
---

<purpose>
Display all specifications from `.specflow/specs/` with their basic info: ID, title, status, priority, complexity. Helps navigate between tasks and understand project state.
</purpose>

<context>
@.specflow/STATE.md
</context>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf init` to start.
```
Exit.

## Step 2: Get Active Specification

Read `.specflow/STATE.md` and extract Active Specification ID.

## Step 3: Find All Specifications

```bash
ls -1 .specflow/specs/SPEC-*.md 2>/dev/null
```

**If no specs found:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No specifications found.

Create your first specification:
`/sf new "task description"`
```
Exit.

## Step 4: Parse Each Specification

For each SPEC-XXX.md file, read the frontmatter and extract:
- id
- type
- status
- priority (default: medium)
- complexity

Also extract title from first `# [Title]` line.

## Step 5: Count Archived Specs

```bash
ls -1 .specflow/archive/SPEC-*.md 2>/dev/null | wc -l
```

## Step 6: Sort Specifications

Sort by:
1. Priority: high → medium → low
2. Then by creation date (oldest first, from ID number)

## Step 7: Display List

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| #  | ID       | Title              | Status   | Priority | Size   |
|----|----------|--------------------|----------|----------|--------|
| 1  | SPEC-003 | Auth middleware    | running  | high     | medium | ← active
| 2  | SPEC-004 | User profile       | audited  | medium   | small  |
| 3  | SPEC-005 | Settings page      | draft    | low      | small  |

Total: 3 specs | {archived} complete | {in_progress} in progress

---

**Actions:**
- `/sf show SPEC-XXX` — view details
- `/sf next` — work on highest priority
- `/sf new "task"` — create new specification
```

## Step 8: Show Status Legend (if helpful)

If there are multiple statuses, show legend:

```
**Status Legend:**
- draft: Needs audit
- audited: Ready to implement
- running: Implementation in progress
- review: Needs review
- done: Completed (in archive)
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] All specs from .specflow/specs/ listed
- [ ] Frontmatter parsed (id, status, priority, complexity)
- [ ] Titles extracted
- [ ] Sorted by priority, then date
- [ ] Active specification marked
- [ ] Statistics shown (total, complete, in progress)
- [ ] Clear next actions provided
</success_criteria>
