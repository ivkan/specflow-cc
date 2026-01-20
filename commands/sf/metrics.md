---
name: sf:metrics
description: Show project statistics and quality metrics
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<purpose>
Calculate and display project statistics including completion rates, quality metrics (audit/review cycles), complexity distribution, and actionable insights. Helps understand project health and identify areas for improvement.
</purpose>

<context>
@.specflow/PROJECT.md
@.specflow/STATE.md
@.specflow/specs/SPEC-*.md
@.specflow/archive/SPEC-*.md
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

Run `/sf init` first.
```
Exit.

## Step 2: Gather Data

### Count Specifications

```bash
# Active specs
ACTIVE=$(ls .specflow/specs/SPEC-*.md 2>/dev/null | wc -l)

# Archived specs
ARCHIVED=$(ls .specflow/archive/SPEC-*.md 2>/dev/null | wc -l)

# Total
TOTAL=$((ACTIVE + ARCHIVED))
```

### Parse Active Specs

For each `.specflow/specs/SPEC-*.md`:
- Extract status from frontmatter
- Extract complexity from frontmatter
- Extract type from frontmatter
- Count audit entries

Group by status:
- draft
- audited
- running
- review
- (done specs are in archive)

### Parse Archived Specs

For each `.specflow/archive/SPEC-*.md`:
- Extract complexity
- Extract type
- Count audit cycles (Audit v1, v2, etc.)
- Count review cycles
- Check if first-pass audit (only 1 audit = first-pass)
- Check if first-pass review (only 1 review = first-pass)

### Parse To-Dos

```bash
# Count todos
TODO_COUNT=$(grep -c "^## TODO-" .specflow/todos/TODO.md 2>/dev/null || echo 0)

# Count converted (todos that became specs - check STATE.md decisions)
# This is approximated by todos with "converted" or spec reference
```

### Get Project Start Date

Read `.specflow/PROJECT.md` for initialized date, or use earliest spec creation date.

## Step 3: Calculate Metrics

### Completion Metrics

```
Total created: TOTAL
Completed: ARCHIVED
In progress: ACTIVE (non-draft)
Draft: count where status = draft
Completion rate: (ARCHIVED / TOTAL) × 100%
```

### Quality Metrics

```
Avg audit cycles: sum(audits) / ARCHIVED
Avg review cycles: sum(reviews) / ARCHIVED
First-pass audit rate: (specs with 1 audit / ARCHIVED) × 100%
First-pass review rate: (specs with 1 review / ARCHIVED) × 100%
```

### Complexity Distribution

```
Small: count where complexity = small
Medium: count where complexity = medium
Large: count where complexity = large
```

### Type Distribution

```
Feature: count where type = feature
Refactor: count where type = refactor
Bugfix: count where type = bugfix
```

### To-Do Metrics

```
Total items: TODO_COUNT
Pending: count without conversion
Converted: count with conversion
Conversion rate: (converted / total) × 100%
```

## Step 4: Generate Insights

Based on calculated metrics, generate 2-4 actionable insights:

**If first-pass audit rate < 50%:**
- "Consider more thorough initial specifications"

**If avg audit cycles > 2:**
- "Specs may benefit from better scoping upfront"

**If large specs > 20% of total:**
- "Consider splitting large specs earlier (/sf split)"

**If first-pass review rate > 70%:**
- "Good implementation quality — specs are well-defined"

**If completion rate < 50% and TOTAL > 5:**
- "Many specs in progress — consider completing before starting new"

**If TODO_COUNT > 5 and conversion rate < 30%:**
- "Backlog growing — consider /sf priority or /sf plan"

**If all metrics good:**
- "Project health is excellent — keep up the discipline!"

## Step 5: Display Metrics

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROJECT METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Project:** {project name from PROJECT.md}
**Initialized:** {date}
**Period:** {days} days

---

## Specifications

| Metric              | Value    |
|---------------------|----------|
| Total created       | {N}      |
| Completed           | {N}      |
| In progress         | {N}      |
| Draft               | {N}      |
| Completion rate     | {N}%     |

## Status Breakdown

| Status    | Count |
|-----------|-------|
| done      | {N}   |
| review    | {N}   |
| running   | {N}   |
| audited   | {N}   |
| draft     | {N}   |

## Complexity Distribution

| Size   | Count | % of Total |
|--------|-------|------------|
| Small  | {N}   | {N}%       |
| Medium | {N}   | {N}%       |
| Large  | {N}   | {N}%       |

## Type Distribution

| Type     | Count | % of Total |
|----------|-------|------------|
| feature  | {N}   | {N}%       |
| refactor | {N}   | {N}%       |
| bugfix   | {N}   | {N}%       |

## Quality Metrics

{If ARCHIVED > 0:}
| Metric                   | Value |
|--------------------------|-------|
| Avg audit cycles         | {N.N} |
| Avg review cycles        | {N.N} |
| First-pass audit rate    | {N}%  |
| First-pass review rate   | {N}%  |

### Audit Results

| Result             | Count | %     |
|--------------------|-------|-------|
| Approved (1st try) | {N}   | {N}%  |
| Approved (2+ tries)| {N}   | {N}%  |

### Review Results

| Result             | Count | %     |
|--------------------|-------|-------|
| Approved (1st try) | {N}   | {N}%  |
| Approved (2+ tries)| {N}   | {N}%  |

{If ARCHIVED = 0:}
*No completed specifications yet — quality metrics will appear after first completion.*

## To-Do Backlog

{If TODO.md exists and has items:}
| Metric         | Value |
|----------------|-------|
| Total items    | {N}   |
| Pending        | {N}   |
| Converted      | {N}   |
| Conversion rate| {N}%  |

{If no todos:}
No to-do items.

Add ideas: `/sf todo "idea"`

---

## Insights

{List 2-4 insights based on analysis}

- {Insight 1}
- {Insight 2}
- {Insight 3}

---

*Metrics calculated from project data*
*Period: {start date} — {today}*
```

## Step 6: Handle Insufficient Data

**If TOTAL = 0:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROJECT METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Project:** {project name}
**Initialized:** {date}

---

## Insufficient Data

No specifications created yet.

Create your first specification to start tracking metrics:

`/sf new "task description"`

---

## What Metrics Will Track

Once you have specifications:
- Completion rates
- Audit/review cycle efficiency
- Complexity distribution
- Quality trends

**Tip:** The more specs you complete, the more valuable these insights become.
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] All specs (active + archived) counted
- [ ] Status breakdown calculated
- [ ] Complexity distribution calculated
- [ ] Type distribution calculated
- [ ] Audit cycles averaged (if archived exists)
- [ ] Review cycles averaged (if archived exists)
- [ ] First-pass rates calculated
- [ ] To-do metrics included
- [ ] Actionable insights generated
- [ ] Insufficient data handled gracefully
</success_criteria>
