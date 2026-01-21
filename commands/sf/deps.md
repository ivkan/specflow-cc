---
name: sf:deps
description: Show dependency graph between specifications
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<purpose>
Display the dependency graph between specifications. Shows which specs can be worked on immediately (no dependencies), which are blocked, and the chains of dependent work. Helps plan execution order.
</purpose>

<context>
@.specflow/STATE.md
@.specflow/specs/SPEC-*.md
</context>

<arguments>
- `[ID]` — Specification ID to show dependencies for. Optional — shows full graph if omitted.
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

## Step 2: Scan All Specifications

```bash
ls .specflow/specs/SPEC-*.md 2>/dev/null
```

**If no specs:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEPENDENCY GRAPH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No specifications found.

Create your first spec: `/sf:new "task description"`
```
Exit.

## Step 3: Parse Dependencies

For each specification, read frontmatter and extract:
- `id` — Specification ID
- `status` — Current status
- `depends_on` — Array of dependency IDs (may be empty)
- `title` — From first heading

Build dependency map:
```
{
  "SPEC-001a": { status: "done", depends_on: [], title: "..." },
  "SPEC-001b": { status: "running", depends_on: ["SPEC-001a"], title: "..." },
  "SPEC-001c": { status: "draft", depends_on: ["SPEC-001b"], title: "..." }
}
```

## Step 4: Branch Based on Arguments

**If specific ID provided:** Go to Step 5a (Specific View)
**If no ID provided:** Go to Step 5b (Full Graph View)

## Step 5a: Specific Spec Dependencies

**Check spec exists:**
```bash
[ -f ".specflow/specs/{ID}.md" ] && echo "FOUND" || echo "NOT_FOUND"
```

**If NOT_FOUND:**
```
Specification {ID} not found.

Use `/sf:list` to see available specifications.
```
Exit.

**Display specific dependencies:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEPENDENCIES: {ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Spec:** {ID} — {title}
**Status:** {status}

## Depends On (upstream)

{If no dependencies:}
None — this specification can be worked on immediately.

{If has dependencies:}
| ID        | Title                    | Status  |     |
|-----------|--------------------------|---------|-----|
| SPEC-XXX  | {title}                  | done    | ✓   |
| SPEC-YYY  | {title}                  | running | ← blocking |

## Depended By (downstream)

{If nothing depends on this:}
None — no other specifications depend on this.

{If has dependents:}
| ID        | Title                    | Status  |
|-----------|--------------------------|---------|
| SPEC-ZZZ  | {title}                  | blocked |

---

{If blocked:}
**Blocked by:** {blocking spec ID} must complete first.

When {blocking ID} is done, run: `/sf:run {ID}`

{If ready:}
**Ready:** All dependencies satisfied.

Next: `/sf:audit {ID}` or `/sf:run {ID}`

{If done:}
**Complete:** This specification is done.

{If has dependents that are now ready:}
**Unblocked:** The following can now proceed:
- {dependent ID}
```
Exit.

## Step 5b: Full Graph View

### Categorize Specs

**Independent (no depends_on):**
- Can be started immediately
- Status: draft, audited, etc.

**In Chains (has depends_on or is depended upon):**
- Part of dependency sequences
- Show chains visually

**Blocked (depends on incomplete spec):**
- Cannot proceed until dependency completes

### Build Chain Visualization

For each chain, create visual:
```
SPEC-001a [done] → SPEC-001b [running] → SPEC-001c [blocked]
                   ↑ you are here
```

### Display Full Graph

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEPENDENCY GRAPH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Independent (can start now)

{If any:}
| ID       | Title                    | Status  |
|----------|--------------------------|---------|
| SPEC-002 | API rate limiting        | draft   |
| SPEC-005 | Settings page            | audited |

{If none:}
None — all specifications are in dependency chains.

## Chains

{For each chain:}
```
SPEC-001a [done] → SPEC-001b [running] → SPEC-001c [blocked] → SPEC-001d [blocked]
                   ↑ current
```

{If parallel chains:}
```
SPEC-003 [audited] → SPEC-004 [draft]
```

## Summary

| Category    | Count |
|-------------|-------|
| Ready       | {N}   |
| In Progress | {N}   |
| Blocked     | {N}   |
| Done        | {N}   |

---

**Next actionable:**
{List specs that are ready to work on, sorted by priority}

- `/sf:run SPEC-001b` (running)
- `/sf:audit SPEC-005` (audited)
- `/sf:audit SPEC-002` (draft)

**Tip:** `/sf:deps SPEC-XXX` for details on a specific spec.
```

</workflow>

<success_criteria>
- [ ] Initialization verified
- [ ] All specs scanned and parsed
- [ ] Dependencies extracted from frontmatter
- [ ] Graph built correctly (no circular deps assumed)
- [ ] Independent specs identified
- [ ] Chains visualized clearly
- [ ] Blocked specs identified with blocker
- [ ] Summary statistics provided
- [ ] Next actionable specs suggested
</success_criteria>
