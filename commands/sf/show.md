---
name: sf:show
description: Display full specification details
allowed-tools:
  - Read
  - Bash
  - Glob
---

<purpose>
Display the full content of a specification including context, task, requirements, acceptance criteria, and audit/review history. Without arguments, shows the active specification.
</purpose>

<context>
@.specflow/STATE.md
</context>

<arguments>
- `[ID]` — Optional. Specification ID (e.g., SPEC-003). If omitted, shows active specification.
</arguments>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf:init` to start.
```
Exit.

## Step 2: Determine Specification ID

**If argument provided:**
Use provided ID (e.g., SPEC-003).

**If no argument:**
Read `.specflow/STATE.md` and get Active Specification.

**If no active specification and no argument:**
```
No specification specified and no active specification.

Use `/sf:show SPEC-XXX` to view a specific spec
or `/sf:list` to see all specifications.
```
Exit.

## Step 3: Find Specification File

```bash
# Check in specs directory
[ -f .specflow/specs/{ID}.md ] && echo "SPECS"

# Check in archive
[ -f .specflow/archive/{ID}.md ] && echo "ARCHIVE"
```

**If not found:**
```
Specification {ID} not found.

Use `/sf:list` to see available specifications.
```
Exit.

## Step 4: Read Specification

Read the spec file and parse:
- Frontmatter (id, type, status, priority, complexity, created)
- Title
- Context section
- Task section
- Requirements section
- Acceptance Criteria section
- Constraints section
- Assumptions section
- Audit History section
- Review History section (if exists)

## Step 5: Summarize History

### Audit History Summary
Count audit versions and get final status:
- "v{N} — APPROVED" or "v{N} — NEEDS_REVISION"

### Review History Summary
If review section exists:
- Count review versions
- Get final review status

## Step 6: Determine Recommended Action

Based on current status:

| Status | Recommended Action |
|--------|-------------------|
| draft | `/sf:audit` — audit specification |
| auditing | Complete audit or `/sf:revise` |
| revision_requested | `/sf:revise` — address comments |
| audited | `/sf:run` — implement specification |
| running | Continue implementation or `/sf:review` |
| review | `/sf:fix` or `/sf:done` |
| done | No action (archived) |

## Step 7: Display Specification

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 {ID}: {Title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Status:** {status} | **Priority:** {priority} | **Complexity:** {complexity}
**Type:** {type} | **Created:** {created}

{If archived:}
**Location:** Archive (completed)

---

## Context

{Context from spec}

## Task

{Task from spec}

## Requirements

{Requirements from spec - files to create/modify/delete}

## Acceptance Criteria

{Criteria from spec with checkboxes}

{If constraints exist:}
## Constraints

{Constraints from spec}

{If assumptions exist:}
## Assumptions

{Assumptions from spec}

---

## History

{If audit history exists:}
**Audit:** v{N} — {APPROVED|NEEDS_REVISION} ({date})

{If review history exists:}
**Review:** v{N} — {APPROVED|NEEDS_FIXES} ({date})

{If implementation started:}
**Implementation:** {In progress | Completed}

---

**Next Step:** `{recommended_command}` — {description}
```

## Step 8: Additional Context

**If spec is in archive:**
```
This specification is complete and archived.

To view active specs: `/sf:list`
To see completed history: `/sf:history`
```

**If spec has outstanding issues:**
```
**Outstanding Issues:**

From {audit/review} v{N}:
1. {issue}
2. {issue}

Address with `/sf:revise` or `/sf:fix`.
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] Spec ID determined (from argument or active)
- [ ] Spec file found (specs or archive)
- [ ] Full content displayed
- [ ] Frontmatter parsed and shown
- [ ] History summarized
- [ ] Recommended next action clear
- [ ] Archive status indicated if applicable
</success_criteria>
