---
name: sf:split
description: Split a large specification into smaller sub-specifications
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<purpose>
Analyze a specification's complexity and split it into smaller, manageable sub-specifications with proper dependency chains. Large specifications (>150k tokens estimated) should be decomposed before implementation.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/specs/SPEC-*.md
@~/.claude/specflow-cc/agents/spec-splitter.md
</context>

<arguments>
- `[ID]` — Specification ID to split (e.g., SPEC-001). Optional — defaults to active specification.
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

## Step 2: Determine Target Specification

**If ID provided:**
```bash
[ -f ".specflow/specs/{ID}.md" ] && echo "FOUND" || echo "NOT_FOUND"
```

**If NOT_FOUND:**
```
Specification {ID} not found.

Use `/sf:list` to see available specifications.
```
Exit.

**If no ID provided:**
Read active specification from `.specflow/STATE.md`:
- Parse "Active Specification" field
- Use that ID

**If no active specification:**
```
No specification specified and no active specification.

Usage: `/sf:split SPEC-001`
   or: Set active spec with `/sf:show SPEC-001`
```
Exit.

## Step 3: Check Complexity

Read the specification and assess complexity:
- Count sections and requirements
- Estimate based on scope described
- Check frontmatter `complexity` field

**If complexity is small:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPLIT NOT NEEDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** {ID}
**Complexity:** small (~{estimate}k tokens)

This specification is small enough to implement directly.

**Next Step:** `/sf:audit {ID}` — audit before implementation
```
Exit.

**If complexity is medium:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPLIT OPTIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Specification:** {ID}
**Complexity:** medium (~{estimate}k tokens)

This specification can be implemented as-is or split for easier management.

Continue with split analysis? [y/N]
```

**If user declines:** Exit.

## Step 4: Spawn Spec Splitter Agent

Launch the spec-splitter subagent:

```
Task(prompt="
<specification>
@.specflow/specs/{ID}.md
</specification>

<project_context>
@.specflow/PROJECT.md
</project_context>

<current_state>
@.specflow/STATE.md
</current_state>

Analyze this specification and propose a split into smaller sub-specifications.
Follow the spec-splitter agent instructions.
", subagent_type="sf-spec-splitter", description="Split specification")
```

## Step 5: Present Proposal

Display agent's split proposal:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPLIT ANALYSIS: {ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Current:** {ID} — {title}
**Complexity:** {complexity} (~{estimate}k tokens)
**Status:** {status}

---

## Analysis

{Agent's analysis of structure and boundaries}

## Proposed Split

| ID        | Title                    | Est. Size | Dependencies |
|-----------|--------------------------|-----------|--------------|
| {ID}a     | {title}                  | small     | —            |
| {ID}b     | {title}                  | medium    | {ID}a        |
| {ID}c     | {title}                  | small     | {ID}b        |

## Dependency Graph

```
{ID}a ({short description})
    ↓
{ID}b ({short description})
    ↓
{ID}c ({short description})
```

---

**Options:**
1. Accept split as proposed
2. Modify split (describe changes)
3. Cancel (keep as single spec)

Your choice [1]:
```

## Step 6: Handle User Choice

**If 1 (Accept):**
- Agent creates child specifications
- Agent archives parent
- Agent updates STATE.md
- Continue to Step 7

**If 2 (Modify):**
- Use AskUserQuestion to get modifications
- Re-run agent with modifications
- Return to Step 5

**If 3 (Cancel):**
```
Split cancelled.

Specification {ID} unchanged.
```
Exit.

## Step 7: Display Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPLIT COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Parent:** {ID} (archived)
**Children:** {N} specifications created

### Created Specifications

| ID        | Title                    | Size   | Depends On   |
|-----------|--------------------------|--------|--------------|
| {ID}a     | {title}                  | small  | —            |
| {ID}b     | {title}                  | medium | {ID}a        |
| {ID}c     | {title}                  | small  | {ID}b        |

### Dependency Graph

```
{ID}a
    ↓
{ID}b
    ↓
{ID}c
```

### Files

**Created:**
- .specflow/specs/{ID}a.md
- .specflow/specs/{ID}b.md
- .specflow/specs/{ID}c.md

**Archived:**
- .specflow/archive/{ID}.md

---

## Next Step

`/sf:audit {ID}a` — start with first sub-specification (no dependencies)

**Tip:** Use `/sf:deps` to see the full dependency graph.
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Split Analysis

### Read Specification

```bash
cat .specflow/specs/{ID}.md
```

### Identify Boundaries

Based on specification content, identify:
1. Data/model layer tasks
2. Logic/service layer tasks
3. Integration/API layer tasks
4. UI/presentation layer tasks

### Generate Sub-Spec IDs

Parent: SPEC-001 → Children: SPEC-001a, SPEC-001b, SPEC-001c, etc.

### Create Child Specifications

For each child, create `.specflow/specs/{ID}{letter}.md`:

```markdown
---
id: {ID}{letter}
parent: {ID}
type: {inherited from parent}
status: draft
priority: {inherited from parent}
complexity: {estimated}
depends_on: [{previous child or empty}]
created: {today}
---

# {Scoped Title}

> Part {N} of {total} from {ID} ({parent title})

## Context
{Extracted from parent, scoped to this part}

## Task
{Scoped to this sub-spec only}

## Requirements
{Relevant subset from parent}

## Acceptance Criteria
{Relevant criteria from parent}

## Constraints
{Inherited from parent}

## Assumptions
{Inherited from parent}
```

### Archive Parent

```bash
mkdir -p .specflow/archive
mv .specflow/specs/{ID}.md .specflow/archive/
```

Add split reference to archived parent.

### Update STATE.md

- Remove parent from Queue
- Add children to Queue
- Set first child as Active Specification

</fallback>

<success_criteria>
- [ ] Initialization verified
- [ ] Target specification identified
- [ ] Complexity assessed
- [ ] Split proposal generated with dependencies
- [ ] User approved (or cancelled)
- [ ] Child specifications created with proper frontmatter
- [ ] Parent archived with split reference
- [ ] STATE.md updated
- [ ] Clear next step provided
</success_criteria>
