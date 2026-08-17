---
name: sf:todo
description: Add a new to-do item for future work
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<purpose>
Add a new to-do item to the backlog. To-dos are ideas or tasks that don't need immediate specification but should be captured for later. They can later be converted to specifications with `/sf:plan`.

Each TODO is stored as an individual file `.specflow/todos/TODO-XXX.md` with YAML frontmatter.

**Id format.** `TODO-` + digits, optionally followed by lowercase letters when an
oversized TODO is split in place: `TODO-093` → `TODO-093a`, `TODO-093b`. The
suffix is part of the id — the `id:` frontmatter field must match the filename
exactly, and the suffix does not consume a new number (`next-id` still moves on
to `TODO-094`). Any other filename shape under `.specflow/todos/TODO-*.md` is
rejected by `todo reindex` and `todo check-stale` with a non-zero exit code, and
never reaches INDEX.md.
</purpose>

<context>
@.specflow/todos/
</context>

<arguments>
- `[text]` — Optional. Description of the to-do item. If omitted, will prompt interactively.
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

## Step 2: Ensure Todos Directory Exists

```bash
mkdir -p .specflow/todos
```

## Step 3: Get Description

**If argument provided:**
Use provided text as description.

**If no argument:**
Use AskUserQuestion:
- header: "Todo"
- question: "What idea or task do you want to capture?"
- options: (freeform text input)

## Step 4: Generate TODO ID

Run the CLI tool to get the next available ID:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo next-id --raw
```

This handles both per-file format (TODO-XXX.md) and legacy TODO.md automatically.

## Step 5: Derive Title

Extract the first sentence of the description (up to the first period, `?`, or `!`, or truncate at ~80 characters). This becomes the `title` field in frontmatter.

## Step 6: Create TODO File

Create `.specflow/todos/TODO-{XXX}.md` using the Write tool:

```markdown
---
id: TODO-{XXX}
title: "{derived title}"
priority: —
complexity: —
status: open
effort: —
depends_on: —
created: {YYYY-MM-DD}
---

## Description

{description}

## Notes

—
```

Do NOT create or modify TODO.md. Do NOT update any "Last updated" lines.

## Step 6.5: Reindex

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex
```

## Step 7: Display Confirmation

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TODO CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ID:** TODO-{XXX}
**Description:** {description}
**Priority:** — (not set)

---

**Actions:**
- `/sf:todos` — view all to-do items
- `/sf:plan TODO-{XXX}` — convert to specification
- `/sf:priority` — set priorities
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] Todos directory exists
- [ ] Description obtained (from arg or prompt)
- [ ] Unique TODO-XXX ID generated via CLI tool
- [ ] Title derived from first sentence of description (~80 chars max)
- [ ] TODO-XXX.md created with valid YAML frontmatter
- [ ] All required frontmatter fields present (id, title, priority, complexity, status, effort, depends_on, created)
- [ ] Clear confirmation and next actions shown
</success_criteria>
