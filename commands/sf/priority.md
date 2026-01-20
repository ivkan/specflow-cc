---
name: sf:priority
description: Interactive prioritization of specifications and to-dos
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<purpose>
Interactively prioritize specifications and to-do items. Allows reordering, setting priority levels, and optionally suggests technically optimal order based on dependencies.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/todos/TODO.md
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

## Step 2: Load All Items

### Load Specifications

```bash
ls -1 .specflow/specs/SPEC-*.md 2>/dev/null
```

For each spec, extract:
- ID
- Title
- Priority
- Status

### Load Todos

Read `.specflow/todos/TODO.md` and extract:
- ID
- Description
- Priority

## Step 3: Display Current Prioritization

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRIORITIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Specifications

| # | ID       | Title              | Priority | Status   |
|---|----------|--------------------|----------|----------|
| 1 | SPEC-003 | Auth middleware    | high     | running  |
| 2 | SPEC-004 | User profile       | medium   | audited  |
| 3 | SPEC-005 | Settings page      | low      | draft    |

## To-Dos

| # | ID       | Description        | Priority |
|---|----------|--------------------|----------|
| 4 | TODO-001 | Add caching        | high     |
| 5 | TODO-002 | Refactor auth      | medium   |
| 6 | TODO-003 | Update docs        | —        |

---

**Options:**
```

## Step 4: Prompt for Action

Use AskUserQuestion with options:

1. **Set priority** — Change priority for specific item
   - Format: `SPEC-004=high` or `TODO-001=low`

2. **Reorder specs** — Enter new order for specifications
   - Format: `2,1,3` (by current # position)

3. **Technical order** — Auto-suggest based on dependencies
   - Analyzes specs for dependency hints

4. **Done** — Exit prioritization

```
**Commands:**
- Set priority: `SPEC-004=high` or `TODO-001=low`
- Reorder specs: `2,1,3` (by # position)
- Technical order: `tech`
- Cancel: `q` or `done`

Your choice:
```

## Step 5: Handle Actions

### Set Priority

If input matches pattern `{ID}={priority}`:

1. Validate priority (high | medium | low)
2. Update frontmatter in spec file OR priority line in TODO.md
3. Display confirmation
4. Return to Step 3

### Reorder Specifications

If input matches pattern `N,N,N`:

1. Validate all numbers exist
2. Recalculate priorities based on position:
   - Position 1-2: high
   - Position 3-4: medium
   - Position 5+: low
3. Update each spec's frontmatter
4. Update STATE.md Queue table
5. Display confirmation
6. Return to Step 3

### Technical Order

If input is `tech`:

1. Analyze specs for dependency hints:
   - Look for "depends on", "requires", "after" in Context
   - Look for file references that overlap
2. Suggest order based on:
   - Dependencies (prerequisites first)
   - Complexity (smaller first if no deps)
   - Type (bugfix > refactor > feature)

```
**Suggested Technical Order:**

| # | ID       | Title              | Reason              |
|---|----------|--------------------|---------------------|
| 1 | SPEC-005 | Settings page      | Smallest, no deps   |
| 2 | SPEC-003 | Auth middleware    | Required by SPEC-004|
| 3 | SPEC-004 | User profile       | Depends on auth     |

Apply this order? [Y/n]
```

If confirmed, apply reordering.

### Done/Cancel

If input is `q`, `done`, or `cancel`:
Exit prioritization.

## Step 6: Display Final State

After changes:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRIORITIZATION UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Changes made:**
- SPEC-004: medium → high
- SPEC-005: low → medium

---

Use `/sf next` to work on highest priority task.
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] All specs loaded with current priorities
- [ ] All todos loaded with current priorities
- [ ] Combined numbered list displayed
- [ ] Set priority command works
- [ ] Reorder command works
- [ ] Technical order suggestion available
- [ ] Changes persisted to files
- [ ] STATE.md Queue updated after spec reorder
- [ ] Clear feedback on changes
</success_criteria>
