---
name: sf:todos
description: List all to-do items sorted by priority
allowed-tools:
  - Read
  - Bash
---

<purpose>
Display all to-do items from the backlog, sorted by priority. Shows ID, description, priority, and creation date. Provides quick access to convert items to specifications.
</purpose>

<context>
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

Run `/sf:init` to start.
```
Exit.

## Step 2: Check for TODO.md

```bash
[ -f .specflow/todos/TODO.md ] && echo "EXISTS" || echo "NO_TODOS"
```

**If NO_TODOS:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TO-DO LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No to-do items found.

Add your first idea:
`/sf:todo "your idea here"`
```
Exit.

## Step 3: Parse TODO.md

Read `.specflow/todos/TODO.md` and extract each todo block:
- ID (TODO-XXX)
- Date (from header)
- Description
- Priority (high | medium | low | —)
- Notes (optional)

Look for pattern:
```
## TODO-XXX — YYYY-MM-DD
**Description:** ...
**Priority:** ...
**Notes:** ...
```

## Step 4: Sort by Priority

Sort todos:
1. high
2. medium
3. low
4. — (unset)

Within same priority, sort by date (oldest first).

## Step 5: Count Statistics

- Total todos
- By priority (high, medium, low, unset)

## Step 6: Display List

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TO-DO LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| #  | ID       | Description              | Priority | Created    |
|----|----------|--------------------------|----------|------------|
| 1  | TODO-001 | Add caching for API      | high     | 2024-01-10 |
| 2  | TODO-003 | Refactor AuthService     | medium   | 2024-01-12 |
| 3  | TODO-002 | Update documentation     | low      | 2024-01-11 |
| 4  | TODO-004 | Research WebSocket       | —        | 2024-01-13 |

**Total:** {N} items ({high} high, {medium} medium, {low} low, {unset} unset)

---

**Actions:**
- `/sf:plan 1` — convert first item to specification
- `/sf:plan TODO-001` — convert by ID
- `/sf:priority` — change priorities
- `/sf:todo "new idea"` — add new item
```

## Step 7: Show Notes (if any have notes)

If any todo has non-empty notes:

```
---

**Notes:**

**TODO-001:** Consider Redis or in-memory
**TODO-003:** Split into smaller services first
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] TODO.md parsed if exists
- [ ] All todos extracted with ID, description, priority, date
- [ ] Sorted by priority then date
- [ ] Numbered list displayed (# column for easy reference)
- [ ] Statistics shown
- [ ] Clear actions provided
- [ ] Notes shown if present
</success_criteria>
