---
name: sf:todos
description: List all to-do items sorted by priority
allowed-tools:
  - Read
  - Write
  - Bash
---

<purpose>
Display all to-do items from the backlog, sorted by priority. Reads individual TODO-XXX.md files (or legacy TODO.md for backward compatibility). Refreshes the INDEX.md cache via the shared regen helper after display. Provides quick access to convert items to specifications.
</purpose>

<context>
@.specflow/todos/
</context>

<arguments>
- `[--all]` — Include TODOs with `status: eliminated` in the output (shown as visually distinct).
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

## Step 2: List TODOs via CLI Tool

Call the CLI tool, which handles format detection automatically:

**If `--all` flag was passed:**
```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo list --all
```

**Otherwise:**
```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo list
```

The tool returns a JSON array of `{ id, title, priority, status, complexity, created }` objects, sorted by priority (high > medium > low > unset), then by created date (oldest first).

Format detection is handled by `cmdTodoList` in `bin/lib/todo.cjs`:
1. If `TODO-*.md` files exist in `.specflow/todos/` — uses per-file format
2. If no per-file TODOs but `TODO.md` exists — uses legacy format
3. If neither — returns empty list

## Step 3: Handle Empty Result

**If the list is empty:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TO-DO LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No to-do items found.

Add your first idea:
`/sf:todo "your idea here"`
```
Exit (skip INDEX.md regeneration).

## Step 4: Count Statistics

From the list:
- Total count
- Count by priority (high, medium, low, unset/—)
- If `--all`: note how many are `status: eliminated`

## Step 5: Display List

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TO-DO LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| #  | ID       | Title                    | Priority | Status  | Created    |
|----|----------|--------------------------|----------|---------|------------|
| 1  | TODO-001 | Add caching for API      | high     | open    | 2024-01-10 |
| 2  | TODO-003 | Refactor AuthService     | medium   | open    | 2024-01-12 |
| 3  | TODO-002 | Update documentation     | low      | open    | 2024-01-11 |
| 4  | TODO-004 | Research WebSocket       | —        | open    | 2024-01-13 |
{If --all: show eliminated items with [eliminated] marker in Status column}

**Total:** {N} items ({high} high, {medium} medium, {low} low, {unset} unset)
{If --all and eliminated exist: (+ {M} eliminated shown)}

---

**Actions:**
- `/sf:plan 1` — convert first item to specification
- `/sf:plan TODO-001` — convert by ID
- `/sf:priority` — change priorities
- `/sf:todo "new idea"` — add new item
```

## Step 6: Regenerate INDEX.md

After displaying the list, regenerate `.specflow/todos/INDEX.md` by invoking the shared helper:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex
```

The helper scans `.specflow/todos/TODO-*.md`, sorts the rows the same way Step 2 does, and writes INDEX.md in the format defined by `templates/todo-index.md`. It is the single source of truth for INDEX layout — do NOT write INDEX.md manually here.

**Important:** INDEX.md is a cache. Other commands that mutate `todos/` (`/sf:todo`, `/sf:plan`, `/sf:done`, `/sf:triage`, `/sf:revise`, `/sf:priority`, `/sf:migrate-todos`, and the `sf-spec-reviser` agent) must call the same helper after their mutation so the cache stays consistent between `/sf:todos` invocations. `/sf:status` runs `todo check-stale` and warns if drift is detected.

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] TODOs listed via `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo list` (format-agnostic)
- [ ] Empty state handled with helpful message
- [ ] Sorted by priority then date (oldest first within same priority)
- [ ] Numbered list displayed with Status column
- [ ] `--all` flag shows eliminated items visually distinct
- [ ] Statistics shown (total, by priority)
- [ ] Clear actions provided
- [ ] INDEX.md regenerated via `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex` after display
- [ ] INDEX.md header describes it as a cache refreshed by `/sf:todos` or the regen helper
</success_criteria>
