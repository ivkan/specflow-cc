---
name: sf:triage
description: Convert scan findings into actionable TODO items
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---

<purpose>
Review findings from the last codebase scan and selectively convert them to TODO items. This bridges the gap between scanning and planning — you see what was found and decide what to act on.
</purpose>

<context>
@.specflow/SCAN.md
@.specflow/todos/
</context>

<arguments>
- `[--all]` — Convert all findings without prompting (batch mode)
- `[--priority=high|medium|low]` — Only show findings of specified priority
</arguments>

<workflow>

## Step 1: Verify Prerequisites

```bash
[ -d .specflow ] && echo "INITIALIZED" || echo "NOT_INITIALIZED"
[ -f .specflow/SCAN.md ] && echo "SCAN_EXISTS" || echo "NO_SCAN"
```

**If NOT_INITIALIZED:**
```
⚠️  Project not initialized

Run /sf:init first.
```
STOP.

**If NO_SCAN:**
```
⚠️  No scan results found

Run /sf:scan first to analyze the codebase.
```
STOP.

## Step 2: Parse SCAN.md

Read `.specflow/SCAN.md` and extract findings:

**Structure to parse:**
- `## Tech Debt` → `### High Priority`, `### Medium Priority`, `### Low Priority`
- `## Code Quality Issues`
- `## Security Considerations`
- `## Test Coverage Gaps`
- `## Suggested Specifications`

For each finding, extract:
- Title (from `**[Title]**`)
- Files affected
- Problem description
- Priority/Severity
- Suggested fix

## Step 3: Build Findings List

Create structured list:

```
findings = [
  {
    id: 1,
    category: "Tech Debt",
    priority: "high",
    title: "...",
    files: ["..."],
    problem: "...",
    fix: "..."
  },
  ...
]
```

**If --priority flag provided:**
Filter to only matching priority.

## Step 4: Display Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SCAN TRIAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scan date: {date from SCAN.md}

Found {N} actionable items:
  🔴 High:   {count}
  🟡 Medium: {count}
  🟢 Low:    {count}

---
```

## Step 5: Interactive Selection (unless --all)

**If --all flag:**
Skip to Step 6, converting all findings.

**Otherwise:**
For each priority level (high first, then medium, then low):

```
🔴 HIGH PRIORITY ({count} items)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. {title}
   Files: {files}
   Problem: {problem}

2. {title}
   Files: {files}
   Problem: {problem}

---
```

Use AskUserQuestion:
- header: "High Priority"
- question: "Which items do you want to add to TODO list?"
- multiSelect: true
- options:
  - "1. {title}" (for each item)
  - "All high priority"
  - "Skip high priority"

Repeat for medium and low priority.

## Step 6: Create TODO Items

For each selected finding:

### 6.1 Generate TODO ID

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo next-id --raw
```

This handles both per-file format and legacy TODO.md automatically (uses Node.js fs/regex — not grep -oP).

### 6.2 Create TODO File

Ensure `.specflow/todos/` directory exists:
```bash
mkdir -p .specflow/todos
```

Create `.specflow/todos/TODO-{XXX}.md` using the Write tool:

```markdown
---
id: TODO-{XXX}
title: "{category}: {title}"
priority: {high|medium|low}
complexity: —
status: open
effort: —
depends_on: —
created: {YYYY-MM-DD}
---

## Description

{category}: {title}

{problem description}

## Notes

- Source: SCAN.md ({scan date})
- Files: {files affected}
- Problem: {problem}
- Suggested fix: {fix}
```

Do NOT append to TODO.md. Do NOT update any "Last updated" lines. Each finding gets its own separate TODO-XXX.md file.

### 6.3 Refresh INDEX.md

After all selected TODO files have been written, regenerate the cache once:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex
```

This is mandatory whenever the triage loop creates at least one TODO. Skipping it leaves INDEX.md missing the just-created entries until the next `/sf:todos` run.

## Step 7: Display Results

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TRIAGE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created {N} TODO items:

  TODO-{XXX}: {title}
  TODO-{XXX}: {title}
  TODO-{XXX}: {title}

Skipped: {M} items

---

**Actions:**
- `/sf:todos` — view all to-do items
- `/sf:priority` — prioritize backlog
- `/sf:plan TODO-XXX` — convert to specification
```

</workflow>

<output_format>

**Success:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TRIAGE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created {N} TODO items from scan findings.

[List of created TODOs]

Next: /sf:priority or /sf:plan TODO-XXX
```

**No findings:**
```
✅ No actionable findings in SCAN.md

The scan found no issues to triage. Codebase is healthy!
```

**All skipped:**
```
ℹ️  Triage complete — no items selected

Run /sf:triage again to review findings.
```

</output_format>

<success_criteria>
- [ ] SCAN.md exists and is parsed
- [ ] Findings extracted with priority levels
- [ ] User shown summary of findings
- [ ] Interactive selection completed (or --all used)
- [ ] Individual TODO-XXX.md files created (one per finding)
- [ ] Each file has valid YAML frontmatter (id, title, priority, status, created)
- [ ] Priority preserved from scan
- [ ] Source reference included in notes (scan date, files, problem)
- [ ] INDEX.md refreshed via `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex` (skip only if zero TODOs created)
- [ ] Clear summary of created TODOs
</success_criteria>
