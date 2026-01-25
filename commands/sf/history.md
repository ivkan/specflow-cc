---
name: sf:history
description: View completed specifications from archive
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<purpose>
Display completed specifications from the archive. Shows completion dates, audit/review cycle counts, and decisions made. Allows viewing full details of archived specifications to learn from past work.
</purpose>

<context>
@.specflow/archive/SPEC-*.md
@.specflow/STATE.md
</context>

<arguments>
- `[ID]` — Specification ID to show details for (e.g., SPEC-001). Optional — shows list if omitted.
- `--decisions` — Display archived decisions from DECISIONS_ARCHIVE.md. Cannot be combined with [ID].
</arguments>

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

## Step 2: Check Archive

```bash
ls .specflow/archive/SPEC-*.md 2>/dev/null | wc -l
```

**If 0 (empty archive):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COMPLETED SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No completed specifications yet.

Complete your first spec to see it here.

**Workflow:**
1. `/sf:new "task"` — Create specification
2. `/sf:audit` → `/sf:run` → `/sf:review`
3. `/sf:done` — Archives the specification
```
Exit.

## Step 3: Parse Arguments

Check if `--decisions` flag is present in the arguments.

**If both [ID] and --decisions provided:**
```
Cannot combine [ID] with --decisions flag.

Use `/sf:history --decisions` to view all archived decisions
or `/sf:history [ID]` for spec history.
```
Exit.

## Step 4: Branch Based on Arguments

**If --decisions flag provided:** Go to Step 4c (Archived Decisions View)
**If specific ID provided:** Go to Step 4a (Detailed View)
**If no ID provided:** Go to Step 4b (List View)

## Step 4a: Detailed Archive View

### Check Spec Exists

```bash
[ -f ".specflow/archive/{ID}.md" ] && echo "FOUND" || echo "NOT_FOUND"
```

**If NOT_FOUND:**
```
Specification {ID} not found in archive.

It may be:
- Still in progress: `/sf:show {ID}`
- Never existed: `/sf:list` to see all specs

Use `/sf:history` to see archived specifications.
```
Exit.

### Parse Archived Specification

Read `.specflow/archive/{ID}.md` and extract:
- Frontmatter: id, type, status, priority, complexity, created
- Title from first heading
- Context section (summary)
- Audit History section
- Review History section (if exists)
- Files created/modified (from Requirements)

### Calculate Statistics

- Duration: created → archived (from last audit/review date)
- Audit cycles: count audit entries
- Review cycles: count review entries
- Decisions: from Audit History responses

### Extract Decisions from STATE.md

Read `.specflow/STATE.md` Decisions table and filter by spec ID.

### Display Detailed View

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 {ID}: {Title} (Archived)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Created:** {created date}
**Completed:** {completion date}
**Duration:** {days} days
**Type:** {type}
**Complexity:** {complexity}

---

## Summary

{Context section content, first paragraph}

## Audit History

| Version | Date       | Result         |
|---------|------------|----------------|
| v1      | 2024-01-11 | Needs Revision |
| v2      | 2024-01-12 | Approved       |

**Total audits:** {N} | **First-pass:** {Yes/No}

## Review History

| Version | Date       | Result         |
|---------|------------|----------------|
| v1      | 2024-01-15 | Approved       |

**Total reviews:** {N} | **First-pass:** {Yes/No}

## Decisions Made

{If decisions found:}
| Decision                          | Rationale                    |
|-----------------------------------|------------------------------|
| Use jose instead of jsonwebtoken  | Better TypeScript support    |
| httpOnly cookies for tokens       | XSS protection               |

{If no decisions:}
No major decisions recorded for this specification.

## Files Created/Modified

{If files listed in Requirements:}
**Created:**
- src/middleware/auth.ts
- src/services/auth.ts
- src/types/auth.ts

**Modified:**
- src/app/api/route.ts

{If files not explicitly listed:}
See specification for details.

---

**Note:** Archived specifications are read-only.

**View full spec:** Read `.specflow/archive/{ID}.md`
```
Exit.

## Step 4b: List All Archived

### Parse All Archived Specs

For each file in `.specflow/archive/SPEC-*.md`:
- Extract id, title, type, complexity, created
- Count audit entries (Audit v1, v2, etc.)
- Count review entries (if any)
- Get completion date (last audit/review date)

### Sort by Completion Date

Most recent first.

### Calculate Summary Statistics

- Total completed
- Average audit cycles
- Average review cycles
- First-pass audit rate
- First-pass review rate

### Display List

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COMPLETED SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| ID       | Title                     | Completed  | Type     | Audits | Reviews |
|----------|---------------------------|------------|----------|--------|---------|
| SPEC-005 | Settings page             | 2024-01-19 | feature  | 1      | 1       |
| SPEC-002 | API rate limiting         | 2024-01-18 | feature  | 1      | 2       |
| SPEC-001 | User authentication       | 2024-01-15 | feature  | 2      | 1       |

---

## Summary

**Total completed:** {N} specifications

| Metric                 | Value  |
|------------------------|--------|
| Average audit cycles   | {N.N}  |
| Average review cycles  | {N.N}  |
| First-pass audit rate  | {N}%   |
| First-pass review rate | {N}%   |

## By Type

| Type     | Count |
|----------|-------|
| feature  | {N}   |
| refactor | {N}   |
| bugfix   | {N}   |

## By Complexity

| Complexity | Count |
|------------|-------|
| small      | {N}   |
| medium     | {N}   |
| large      | {N}   |

---

**View details:** `/sf:history SPEC-001`

**Insights:**
{If first-pass audit rate < 50%:}
- Consider more thorough initial specs (low first-pass audit rate)

{If average audits > 2:}
- Specs may need better scoping upfront

{If all metrics good:}
- Great spec quality! Keep up the discipline.
```

## Step 4c: Archived Decisions View

### Check Archive Exists

```bash
[ -f ".specflow/DECISIONS_ARCHIVE.md" ] && echo "FOUND" || echo "NOT_FOUND"
```

**If NOT_FOUND:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ARCHIVED DECISIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No archived decisions yet.

Decisions are automatically rotated from STATE.md when it exceeds 100 lines.

**Current decisions:** Use `/sf:status` to see recent decisions in STATE.md
```
Exit.

### Parse and Display Archived Decisions

Read `.specflow/DECISIONS_ARCHIVE.md` and extract all decisions from the table.

Count total archived decisions.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ARCHIVED DECISIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Historical decisions rotated from STATE.md (oldest first).

| Date | Decision |
|------|----------|
{All decisions from archive}

---

**Total archived:** {count} decisions

**Recent decisions:** Use `/sf:status` to see the 5-7 most recent decisions in STATE.md

📄 File: .specflow/DECISIONS_ARCHIVE.md
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] Empty archive handled gracefully
- [ ] List view shows all archived specs with key metrics
- [ ] Detail view shows full history and decisions
- [ ] Audit/review cycles counted correctly
- [ ] Summary statistics calculated
- [ ] Sorted by completion date (most recent first)
- [ ] Insights provided based on data
</success_criteria>
