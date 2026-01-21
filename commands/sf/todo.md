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
</purpose>

<context>
@.specflow/todos/TODO.md
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

Check existing TODO.md for highest ID:

```bash
grep -oP 'TODO-\K\d+' .specflow/todos/TODO.md 2>/dev/null | sort -n | tail -1
```

If no existing todos, start with 001.
Next ID = last + 1, zero-padded to 3 digits.

## Step 5: Create or Update TODO.md

**If TODO.md doesn't exist:**
Create from template:

```markdown
# To-Do List

---

## TODO-{XXX} — {YYYY-MM-DD}
**Description:** {description}
**Priority:** —
**Notes:** —

---
*Last updated: {YYYY-MM-DD}*
```

**If TODO.md exists:**
Insert new todo after `# To-Do List` line:

```markdown
## TODO-{XXX} — {YYYY-MM-DD}
**Description:** {description}
**Priority:** —
**Notes:** —

---
```

Also update `*Last updated:` line at the bottom.

## Step 6: Display Confirmation

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
- [ ] Unique TODO-XXX ID generated
- [ ] TODO.md created or updated
- [ ] New todo added at top of list
- [ ] Last updated timestamp refreshed
- [ ] Clear confirmation and next actions shown
</success_criteria>
