---
name: sf:migrate-todos
description: One-time migration from monolithic TODO.md to per-file format
allowed-tools:
  - Read
  - Write
  - Bash
---

<purpose>
Migrate an existing monolithic `.specflow/todos/TODO.md` to the new per-file format where each TODO becomes an individual `.specflow/todos/TODO-XXX.md` file with YAML frontmatter.

This is a one-time migration command. After migration:
- `TODO.md` is renamed to `TODO.md.bak` (NOT deleted — safety net)
- Each TODO becomes its own `TODO-XXX.md` file
- `INDEX.md` is regenerated from the new files via the shared `todo reindex` helper
- All other commands will use the new per-file format automatically

Use `--dry-run` to preview the migration without writing any files.
</purpose>

<arguments>
- `[--dry-run]` — Preview migration without writing files. Shows what would be created.
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

## Step 2: Check for Legacy TODO.md

```bash
[ -f .specflow/todos/TODO.md ] && echo "EXISTS" || echo "NO_TODO_MD"
```

**If NO_TODO_MD:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MIGRATE TODOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No legacy TODO.md found at .specflow/todos/TODO.md.

Nothing to migrate. If you already have per-file TODOs, run `/sf:todos` to view them.
```
Exit.

## Step 3: Check for Existing Per-File TODOs

```bash
ls .specflow/todos/TODO-*.md 2>/dev/null | head -1
```

**If per-file TODOs already exist:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MIGRATE TODOS — WARNING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found existing per-file TODO files alongside TODO.md.
Migration may create duplicate IDs.

Review existing files before continuing:
  ls .specflow/todos/TODO-*.md

Proceed anyway? (Use --dry-run first to check for conflicts)
```

Continue (do not abort — user may want to merge).

## Step 4: Parse TODO.md

Read `.specflow/todos/TODO.md` and extract all TODO blocks.

Each block follows the pattern:
```
## TODO-XXX — YYYY-MM-DD
**Description:** Short description
**Priority:** high | medium | low | —
**Notes:** Optional notes

---
```

For each block, extract:
- `id` — TODO-XXX
- `created` — YYYY-MM-DD (from header)
- `description` — from `**Description:**` line
- `priority` — from `**Priority:**` line (normalize: strip whitespace, lowercase)
- `notes` — from `**Notes:**` line (may be "—" or empty)

**If no blocks found:**
```
TODO.md exists but contains no TODO blocks.

Nothing to migrate. Renaming TODO.md to TODO.md.bak for safety.
```
Go to Step 7 (rename only).

## Step 5: Preview Migration

Display what will be created:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MIGRATE TODOS{If --dry-run: " — DRY RUN (no files written)"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found {N} TODO items in TODO.md:

| ID       | Created    | Priority | Description (truncated) |
|----------|------------|----------|-------------------------|
| TODO-001 | 2024-01-10 | high     | Add caching for API...  |
| TODO-003 | 2024-01-12 | medium   | Refactor AuthService... |
| TODO-002 | 2024-01-11 | low      | Update documentation... |

Will create:
  .specflow/todos/TODO-001.md
  .specflow/todos/TODO-002.md
  .specflow/todos/TODO-003.md
  .specflow/todos/INDEX.md

Will rename:
  TODO.md → TODO.md.bak
```

**If `--dry-run` flag:**
```
DRY RUN complete. No files were written.

To run the actual migration: /sf:migrate-todos
```
Exit.

## Step 6: Create Per-File TODOs

For each parsed TODO block, create `.specflow/todos/TODO-{XXX}.md`:

Derive `title` from description: first sentence (up to first `.`, `?`, or `!`), truncated to ~80 characters.

```markdown
---
id: TODO-{XXX}
title: "{derived title}"
priority: {priority or —}
complexity: —
status: open
effort: —
depends_on: —
created: {YYYY-MM-DD}
---

## Description

{full description}

## Notes

{notes or "—"}
```

## Step 7: Generate INDEX.md

Invoke the shared regen helper to build `.specflow/todos/INDEX.md` from the migrated files:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex
```

Do NOT write INDEX.md inline — the helper is the single source of truth for its layout (see `templates/todo-index.md`).

## Step 8: Rename Legacy TODO.md

```bash
mv .specflow/todos/TODO.md .specflow/todos/TODO.md.bak
```

**CRITICAL:** Do NOT delete TODO.md — rename to `.bak` for safety. The original data is preserved in case of migration issues.

Verify:
```bash
[ -f .specflow/todos/TODO.md.bak ] && echo "RENAMED" || echo "RENAME_FAILED"
```

**If RENAME_FAILED:** Report error but continue (per-file TODOs are already created).

## Step 9: Display Migration Summary

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MIGRATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Migrated {N} TODOs from TODO.md to per-file format.

**Created:**
  {list of TODO-XXX.md files created}
  .specflow/todos/INDEX.md

**Renamed:**
  TODO.md → TODO.md.bak (original preserved for safety)

---

**Actions:**
- `/sf:todos` — view all to-do items
- `/sf:priority` — set priorities
- `/sf:plan TODO-XXX` — convert to specification

**Cleanup:** Once you've verified the migration, you may delete TODO.md.bak:
  rm .specflow/todos/TODO.md.bak
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] Legacy TODO.md existence checked
- [ ] All TODO blocks parsed from TODO.md
- [ ] `--dry-run` previews without writing files
- [ ] Individual TODO-XXX.md files created for each block
- [ ] Each file has valid YAML frontmatter (id, title, priority, status, created)
- [ ] Title derived from description (first sentence, ~80 chars)
- [ ] INDEX.md regenerated via `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex`
- [ ] TODO.md renamed to TODO.md.bak (NOT deleted)
- [ ] Clear migration summary shown
- [ ] Cleanup instructions provided
</success_criteria>
