# Task: SpecFlow Implementation — Phase 4 (Decomposition & Utilities)

## Context

**Project:** SpecFlow — spec-driven development system for Claude Code
**Directory:** ~/Projects/specflow-cc
**Full Specification:** docs/DESIGN.md
**Repository:** https://github.com/ivkan/specflow-cc

## Phases Completed

### Phase 1 (Core Creation)
- `/sf init`, `/sf new`, `/sf audit`, `/sf status`

### Phase 2 (Revision & Execution)
- `/sf revise`, `/sf run`, `/sf review`, `/sf fix`, `/sf done`

### Phase 3 (Navigation, To-Do & Sessions)
- `/sf list`, `/sf show`, `/sf next`
- `/sf todo`, `/sf todos`, `/sf plan`, `/sf priority`
- `/sf pause`, `/sf resume`

**Existing files to study:**
- All commands in `commands/sf/`
- All agents in `agents/`
- Templates in `templates/`

---

## Phase 4: Decomposition & Utilities

### Goal

Complete the SpecFlow command set:
- Decompose large specifications into manageable parts
- Visualize dependencies between specifications
- Provide help and documentation
- Track history and metrics

---

### Commands to Implement

#### 1. `/sf split [ID]`

**File:** `commands/sf/split.md`

**Functionality:**
- Analyze specification for complexity
- Propose logical split into sub-specifications
- Create child specs with dependency chain
- Update parent spec to reference children
- Update STATE.md queue with new specs

**Complexity thresholds (from DESIGN.md):**
| Size    | Tokens   | Action                     |
|---------|----------|----------------------------|
| Small   | ≤50k     | Execute directly           |
| Medium  | 50–150k  | Warning, proceed           |
| Large   | >150k    | Requires decomposition     |

**Behavior:**
```
/sf split SPEC-001   → Analyze and propose split for specific spec
/sf split            → Analyze active specification
```

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPLIT ANALYSIS: SPEC-001
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Current:** SPEC-001 — User Authentication System
**Complexity:** large (~180k tokens estimated)
**Status:** draft

---

## Analysis

This specification covers multiple distinct concerns:
1. User model and database schema
2. Authentication logic (JWT)
3. API endpoints
4. Frontend components

## Proposed Split

| ID        | Title                    | Est. Size | Dependencies |
|-----------|--------------------------|-----------|--------------|
| SPEC-001a | User model & schema      | ~40k      | —            |
| SPEC-001b | JWT authentication logic | ~50k      | SPEC-001a    |
| SPEC-001c | Auth API endpoints       | ~45k      | SPEC-001b    |
| SPEC-001d | Auth frontend components | ~40k      | SPEC-001c    |

## Dependency Graph

```
SPEC-001a (User model)
    ↓
SPEC-001b (JWT logic)
    ↓
SPEC-001c (API endpoints)
    ↓
SPEC-001d (Frontend)
```

---

**Options:**
1. Accept split as proposed
2. Modify split (combine/separate)
3. Cancel (keep as single spec)

Your choice [1]:
```

**After acceptance:**
```
✅ Split complete

Created:
- SPEC-001a: User model & schema (draft)
- SPEC-001b: JWT authentication logic (draft, depends on 001a)
- SPEC-001c: Auth API endpoints (draft, depends on 001b)
- SPEC-001d: Auth frontend components (draft, depends on 001c)

Original SPEC-001 archived with reference to children.

**Next:** `/sf audit SPEC-001a` — start with first sub-spec
```

**Child spec format:**
```markdown
---
id: SPEC-001a
parent: SPEC-001
type: feature
status: draft
priority: high
complexity: small
depends_on: []
created: 2024-01-20
---

# User Model & Schema

> Part 1 of 4 from SPEC-001 (User Authentication System)

## Context
[Extracted from parent]

## Task
[Scoped to this part only]

...
```

**Agent needed:** `agents/spec-splitter.md`

---

#### 2. `/sf deps [ID]`

**File:** `commands/sf/deps.md`

**Functionality:**
- Show dependency graph for specifications
- Without argument: show all dependencies
- With argument: show dependencies for specific spec
- Identify blocked specs (waiting on others)
- Identify ready specs (no pending dependencies)

**Behavior:**
```
/sf deps             → Show full dependency graph
/sf deps SPEC-003    → Show what SPEC-003 depends on and what depends on it
```

**Output format (full graph):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEPENDENCY GRAPH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Independent (can start now)

- SPEC-002: API rate limiting (draft)
- SPEC-005: Settings page (audited)

## Chains

```
SPEC-001a [done] → SPEC-001b [running] → SPEC-001c [blocked] → SPEC-001d [blocked]
                   ↑ you are here
```

```
SPEC-003 [audited] → SPEC-004 [draft]
```

## Summary

| Status    | Count |
|-----------|-------|
| Ready     | 2     |
| In Chain  | 6     |
| Blocked   | 2     |

---

**Next actionable:** SPEC-001b (running) or SPEC-005 (audited)
```

**Output format (specific spec):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEPENDENCIES: SPEC-001c
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Spec:** SPEC-001c — Auth API endpoints
**Status:** blocked

## Depends On (upstream)

| ID        | Title                    | Status  |
|-----------|--------------------------|---------|
| SPEC-001a | User model & schema      | done    | ✓
| SPEC-001b | JWT authentication logic | running | ← blocking

## Depended By (downstream)

| ID        | Title                    | Status  |
|-----------|--------------------------|---------|
| SPEC-001d | Auth frontend components | blocked |

---

**Blocked by:** SPEC-001b must complete first

When SPEC-001b is done, run: `/sf run SPEC-001c`
```

**No agent needed** — file parsing and graph construction.

---

#### 3. `/sf help [command]`

**File:** `commands/sf/help.md`

**Functionality:**
- Without argument: show all commands overview
- With argument: show detailed help for specific command
- Group commands by category
- Show examples for each command

**Behavior:**
```
/sf help           → Overview of all commands
/sf help new       → Detailed help for /sf new
/sf help audit     → Detailed help for /sf audit
```

**Output format (overview):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECFLOW HELP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SpecFlow — Spec-driven development for Claude Code

## Core Workflow

| Command      | Description                        |
|--------------|------------------------------------|
| /sf init     | Initialize project                 |
| /sf new      | Create specification               |
| /sf audit    | Audit specification                |
| /sf revise   | Revise based on audit              |
| /sf run      | Execute specification              |
| /sf review   | Review implementation              |
| /sf fix      | Fix based on review                |
| /sf done     | Complete and archive               |

## Navigation

| Command      | Description                        |
|--------------|------------------------------------|
| /sf status   | Current state and next step        |
| /sf list     | List all specifications            |
| /sf show     | Show specification details         |
| /sf next     | Work on highest priority task      |

## To-Do

| Command      | Description                        |
|--------------|------------------------------------|
| /sf todo     | Add idea to backlog                |
| /sf todos    | List all to-dos                    |
| /sf plan     | Convert to-do to specification     |
| /sf priority | Change priorities                  |

## Decomposition

| Command      | Description                        |
|--------------|------------------------------------|
| /sf split    | Split large spec into parts        |
| /sf deps     | Show dependency graph              |

## Sessions

| Command      | Description                        |
|--------------|------------------------------------|
| /sf pause    | Save session context               |
| /sf resume   | Restore session context            |

## Utilities

| Command      | Description                        |
|--------------|------------------------------------|
| /sf help     | This help                          |
| /sf history  | Completed specifications           |
| /sf metrics  | Project statistics                 |

---

**Tip:** `/sf help <command>` for detailed usage

**Quick start:**
1. `/sf init` — initialize project
2. `/sf new "task"` — create first spec
3. `/sf audit` — audit the spec
4. `/sf run` — implement
5. `/sf done` — complete
```

**Output format (specific command):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 /sf new
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a new specification from task description.

## Usage

```
/sf new "task description"
/sf new                      # Interactive mode
```

## Description

Creates a specification file in `.specflow/specs/SPEC-XXX.md`.
The spec-creator agent will:
- Ask critical clarifying questions (if needed)
- Analyze codebase for context
- Estimate complexity (small/medium/large)
- Generate structured specification

## Examples

```
/sf new "Add user authentication with JWT"
/sf new "Fix bug in payment processing"
/sf new "Refactor UserService to use repository pattern"
```

## Options

| Option       | Description                        |
|--------------|------------------------------------|
| --template   | Use specific template (future)     |

## Related Commands

- `/sf audit` — audit the created spec
- `/sf revise` — revise based on feedback
- `/sf plan` — create spec from to-do

## See Also

- DESIGN.md section 3.10 (Clarifying Questions)
- templates/spec.md (Specification format)
```

**No agent needed** — static content with dynamic command lookup.

---

#### 4. `/sf history`

**File:** `commands/sf/history.md`

**Functionality:**
- List completed specifications from `.specflow/archive/`
- Show completion date, audit count, review count
- Show decisions made during each spec
- Allow viewing archived spec details

**Behavior:**
```
/sf history          → List all completed specs
/sf history SPEC-001 → Show details of archived spec
```

**Output format (list):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COMPLETED SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| ID       | Title                | Completed  | Audits | Reviews |
|----------|----------------------|------------|--------|---------|
| SPEC-001 | User authentication  | 2024-01-15 | 2      | 1       |
| SPEC-002 | API rate limiting    | 2024-01-18 | 1      | 2       |
| SPEC-003 | Settings page        | 2024-01-19 | 1      | 1       |

Total: 3 completed | Avg audits: 1.3 | Avg reviews: 1.3

---

**View details:** `/sf history SPEC-001`
```

**Output format (details):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPEC-001: User Authentication (Archived)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Created:** 2024-01-10
**Completed:** 2024-01-15
**Duration:** 5 days
**Type:** feature
**Complexity:** medium

---

## Summary

Implemented JWT-based authentication with refresh tokens,
including login/logout endpoints and middleware.

## Audit History

| Version | Date       | Result     |
|---------|------------|------------|
| v1      | 2024-01-11 | Revision   |
| v2      | 2024-01-12 | Approved   |

## Review History

| Version | Date       | Result     |
|---------|------------|------------|
| v1      | 2024-01-15 | Approved   |

## Decisions Made

| Decision                          | Rationale                    |
|-----------------------------------|------------------------------|
| Use jose instead of jsonwebtoken  | Better TypeScript support    |
| httpOnly cookies for tokens       | XSS protection               |

## Files Created/Modified

- src/middleware/auth.ts (created)
- src/services/auth.ts (created)
- src/types/auth.ts (created)
- src/app/api/auth/route.ts (created)

---

**Note:** Archived specs are read-only.
```

**No agent needed** — file reading and formatting.

---

#### 5. `/sf metrics`

**File:** `commands/sf/metrics.md`

**Functionality:**
- Calculate project statistics
- Show completion rates
- Show average audit/review cycles
- Show time metrics (if tracking enabled)
- Show complexity distribution

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROJECT METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Project:** My App
**Initialized:** 2024-01-05
**Period:** 15 days

---

## Specifications

| Metric              | Value    |
|---------------------|----------|
| Total created       | 8        |
| Completed           | 5        |
| In progress         | 2        |
| Draft               | 1        |
| Completion rate     | 62.5%    |

## Complexity Distribution

| Size   | Count | % of Total |
|--------|-------|------------|
| Small  | 4     | 50%        |
| Medium | 3     | 37.5%      |
| Large  | 1     | 12.5%      |

## Quality Metrics

| Metric                   | Value |
|--------------------------|-------|
| Avg audit cycles         | 1.4   |
| Avg review cycles        | 1.2   |
| First-pass audit rate    | 40%   |
| First-pass review rate   | 60%   |

## Audit Results

| Result             | Count | %     |
|--------------------|-------|-------|
| Approved (1st try) | 2     | 40%   |
| Approved (2+ try)  | 3     | 60%   |

## To-Do Backlog

| Metric         | Value |
|----------------|-------|
| Total items    | 6     |
| Converted      | 3     |
| Pending        | 3     |
| Conversion rate| 50%   |

---

## Insights

- 🎯 Good first-pass review rate (60%)
- 📈 Consider splitting large specs earlier (1 large spec took 3 audit cycles)
- 💡 3 to-dos pending — consider `/sf plan` or `/sf priority`

---

*Metrics since: 2024-01-05*
```

**No agent needed** — calculation from STATE.md and archive files.

---

## Implementation Requirements

### New Agent

Create `agents/spec-splitter.md` for `/sf split`:
- Analyzes specification structure
- Identifies logical boundaries
- Estimates sub-spec complexity
- Proposes dependency chain
- Creates child specifications

### Atomic Commits

One commit per completed unit of work:
- `feat(sf): add spec-splitter agent`
- `feat(sf): add /sf split command`
- `feat(sf): add /sf deps command`
- `feat(sf): add /sf help command`
- `feat(sf): add /sf history command`
- `feat(sf): add /sf metrics command`

### Testing

After implementing each command:
1. Test with existing specs
2. Test edge cases (empty archive, no deps, etc.)
3. Verify output formatting

### Consistency

- Follow patterns from Phase 1-3 commands
- Use same XML structure
- Maintain consistency with DESIGN.md

---

## Implementation Order

1. **Agent:** `agents/spec-splitter.md`
2. **Command:** `commands/sf/split.md`
3. **Command:** `commands/sf/deps.md`
4. **Command:** `commands/sf/help.md`
5. **Command:** `commands/sf/history.md`
6. **Command:** `commands/sf/metrics.md`

---

## Phase 4 Completion Criteria

- [ ] `agents/spec-splitter.md` created
- [ ] `/sf split` analyzes and proposes splits
- [ ] `/sf split` creates child specs with dependencies
- [ ] `/sf deps` shows dependency graph
- [ ] `/sf deps SPEC-XXX` shows specific dependencies
- [ ] `/sf help` shows command overview
- [ ] `/sf help <cmd>` shows detailed help
- [ ] `/sf history` lists archived specs
- [ ] `/sf history SPEC-XXX` shows archive details
- [ ] `/sf metrics` calculates project statistics
- [ ] All commands work in Claude Code
- [ ] Code is committed and pushed

---

## After Completion

**SpecFlow is feature-complete!**

Final tasks:
1. Update README.md with full command reference
2. Update CHANGELOG.md
3. Test full workflow end-to-end
4. Publish to npm: `npm publish`
5. Announce release

---

## Notes

- `/sf split` is the only command in Phase 4 requiring an agent
- `/sf deps` builds graph from `depends_on` field in spec frontmatter
- `/sf help` content should match actual command implementations
- `/sf metrics` may show "insufficient data" for new projects
- Consider caching metrics calculation for large projects

## Design Decisions

- **One agent for Phase 4** — only `/sf split` needs intelligence
- **No time tracking** — duration calculated from created/completed dates only
- **Insights in metrics** — brief actionable suggestions based on data
- **Read-only archive** — archived specs cannot be modified
