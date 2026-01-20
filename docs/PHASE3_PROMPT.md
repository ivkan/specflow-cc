# Task: SpecFlow Implementation — Phase 3 (Navigation, To-Do & Sessions)

## Context

**Project:** SpecFlow — spec-driven development system for Claude Code
**Directory:** ~/Projects/specflow-cc
**Full Specification:** docs/DESIGN.md
**Repository:** https://github.com/ivkan/specflow-cc

## Phases Completed

### Phase 1 (Core Creation)
- `/sf init` — project initialization
- `/sf new` — specification creation
- `/sf audit` — specification audit
- `/sf status` — status display

### Phase 2 (Revision & Execution)
- `/sf revise` — revise specification based on audit
- `/sf run` — execute specification
- `/sf review` — review implementation
- `/sf fix` — fix implementation based on review
- `/sf done` — archive and complete

**Existing files to study:**
- All commands in `commands/sf/`
- All agents in `agents/`
- Templates in `templates/`

## Reference

GSD (for pattern borrowing): `/Users/koristuvac/Projects/dev/get-shit-done`

**Relevant GSD files:**
- `commands/gsd/progress.md` — status and navigation pattern
- `commands/gsd/check-todos.md` — todo management
- `commands/gsd/pause-work.md` — session pause
- `commands/gsd/resume-work.md` — session resume

---

## Phase 3: Navigation, To-Do & Sessions

### Goal

Complete the auxiliary workflow:
- Navigate between specifications
- Manage ideas and future tasks (to-dos)
- Pause and resume work sessions

---

### Commands to Implement

#### 1. `/sf list`

**File:** `commands/sf/list.md`

**Functionality:**
- List all specifications from `.specflow/specs/`
- Show basic info: ID, title, status, priority, complexity
- Sort by priority (high → medium → low) then by creation date
- Indicate active specification with marker

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| ID       | Title              | Status   | Priority | Size   |
|----------|--------------------| ---------|----------|--------|
| SPEC-003 | Auth middleware    | running  | high     | medium | ← active
| SPEC-004 | User profile       | audited  | medium   | small  |
| SPEC-005 | Settings page      | draft    | low      | small  |

Total: 3 specs | 0 complete | 1 in progress

/sf show SPEC-003  — view details
/sf next           — work on highest priority
```

**No agent needed** — direct file operations.

---

#### 2. `/sf show [ID]`

**File:** `commands/sf/show.md`

**Functionality:**
- Without argument: show active specification
- With argument: show specified SPEC-XXX
- Display full specification content
- Show audit history summary
- Show review history summary (if exists)
- Indicate recommended next action

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SPEC-003: Auth Middleware
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status: running | Priority: high | Complexity: medium

---

## Context
[Context from spec]

## Task
[Task from spec]

## Requirements
[Requirements from spec]

## Acceptance Criteria
[Criteria from spec]

---

## History

**Audit:** v2 — APPROVED (2024-01-15)
**Implementation:** In progress

---

**Next Step:** Continue implementation or `/sf review`
```

**No agent needed** — direct file read.

---

#### 3. `/sf next`

**File:** `commands/sf/next.md`

**Functionality:**
- Find highest priority actionable specification
- Priority order: high → medium → low
- Within same priority: by creation date (oldest first)
- Skip specs that are blocked or done
- Set found spec as active in STATE.md
- Show spec summary and recommended action

**Actionable status priority:**
1. `review` — needs review (highest urgency)
2. `running` — in progress
3. `audited` — ready to run
4. `revision_requested` — needs revision
5. `auditing` — needs audit completion
6. `draft` — needs audit

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXT TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**SPEC-004:** User profile page
**Priority:** medium | **Status:** audited

## Summary
Add user profile page with avatar upload and settings.

## Acceptance Criteria
- [ ] Profile page renders user data
- [ ] Avatar upload works
- [ ] Settings can be saved

---

**Ready to implement:** `/sf run`
```

**If no actionable specs:**
```
No specifications ready for work.

Options:
- `/sf new "description"` — create new specification
- `/sf todos` — view idea backlog
```

**No agent needed** — state management and file operations.

---

#### 4. `/sf todo [text]`

**File:** `commands/sf/todo.md`

**Functionality:**
- Add a new to-do item to `.specflow/todos/TODO.md`
- Auto-generate ID: TODO-XXX (sequential)
- Set initial priority: unset (—)
- Record creation date
- Optionally extract from current conversation context

**Behavior:**
```
/sf todo Add caching for API       → Create TODO with text
/sf todo                           → Interactive: ask for description
```

**Output format:**
```
✅ TODO-005 created

"Add caching for API"
Priority: —

Use `/sf todos` to view all or `/sf plan TODO-005` to convert to spec.
```

**TODO.md format:**
```markdown
# To-Do List

## TODO-001 — 2024-01-10
**Description:** Add caching for API
**Priority:** high
**Notes:** Consider Redis or in-memory

---

## TODO-002 — 2024-01-12
**Description:** Refactor AuthService
**Priority:** medium
**Notes:** —

---
```

**Template needed:** `templates/todo.md`

**No agent needed** — direct file append.

---

#### 5. `/sf todos`

**File:** `commands/sf/todos.md`

**Functionality:**
- List all to-do items from `.specflow/todos/TODO.md`
- Sort by priority (high → medium → low → unset)
- Show ID, description, priority, creation date
- Indicate which can be converted to specs

**Output format:**
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

Total: 4 items

---

**Actions:**
- `/sf plan TODO-001` — convert to specification
- `/sf priority` — change priorities
- `/sf todo "new idea"` — add new item
```

**No agent needed** — direct file read.

---

#### 6. `/sf plan [ID]`

**File:** `commands/sf/plan.md`

**Functionality:**
- Convert to-do item into full specification
- Read TODO item details
- Launch spec-creator agent with TODO context
- Remove TODO from list after spec created
- Update STATE.md with new spec

**Behavior:**
```
/sf plan TODO-001    → Convert specific TODO to spec
/sf plan             → Interactive: show todos, ask which to convert
```

**Output:** Same as `/sf new` but with TODO context pre-filled.

**Agent reuse:** Uses `agents/spec-creator.md` with additional context.

---

#### 7. `/sf priority`

**File:** `commands/sf/priority.md`

**Functionality:**
- Interactive prioritization of specs and todos
- Show current order
- Allow reordering by entering new sequence
- Allow setting priority levels (high/medium/low)
- Option: "tech" — suggest technically optimal order

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PRIORITIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Current Specifications

| # | ID       | Title              | Priority | Status   |
|---|----------|--------------------|----------|----------|
| 1 | SPEC-003 | Auth middleware    | high     | running  |
| 2 | SPEC-004 | User profile       | medium   | audited  |
| 3 | SPEC-005 | Settings page      | low      | draft    |

## Current To-Dos

| # | ID       | Description        | Priority |
|---|----------|--------------------|----------|
| 4 | TODO-001 | Add caching        | high     |
| 5 | TODO-002 | Refactor auth      | medium   |

---

**Options:**
- Enter new order: `2,1,3` (specs only)
- Set priority: `SPEC-004=high`
- Technical order: `tech` (based on dependencies)
- Cancel: `q`

Your choice:
```

**No agent needed** — interactive state management.

---

#### 8. `/sf pause`

**File:** `commands/sf/pause.md`

**Functionality:**
- Save current work context for later resumption
- Create `.specflow/sessions/PAUSE-{timestamp}.md`
- Record:
  - Active specification and status
  - Current position in workflow
  - Recent changes (git diff summary)
  - Notes from user (optional)
  - Conversation context summary
- Update STATE.md with pause reference

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SESSION PAUSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Saved:** PAUSE-20240115-143022

**Context:**
- Spec: SPEC-003 (Auth middleware)
- Status: running
- Progress: 3/5 files implemented

**Recent changes:**
- src/middleware/auth.ts (new)
- src/types/auth.ts (new)
- src/utils/jwt.ts (modified)

Add notes for next session? (Enter to skip):
> Need to finish token refresh logic

✅ Session saved.

Resume with: `/sf resume`
```

**Pause file format:**
```markdown
# Session Pause — 2024-01-15 14:30:22

## Context
- **Specification:** SPEC-003 (Auth middleware)
- **Status:** running
- **Workflow Position:** Implementation in progress

## Progress
- Files created: 2
- Files modified: 1
- Commits: 1

## Recent Changes
```diff
+ src/middleware/auth.ts
+ src/types/auth.ts
M src/utils/jwt.ts
```

## Notes
Need to finish token refresh logic

## Conversation Summary
Working on JWT authentication middleware. Created auth.ts with basic
token validation. Next: implement refresh token rotation.

---
*Paused at: 2024-01-15 14:30:22*
```

**No agent needed** — context capture and file operations.

---

#### 9. `/sf resume`

**File:** `commands/sf/resume.md`

**Functionality:**
- Restore context from last pause
- Read latest pause file from `.specflow/sessions/`
- Display full context summary
- Verify current state matches pause state
- If state changed: show diff and ask how to proceed
- Set active specification from pause
- Provide clear next steps

**Output format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SESSION RESUMED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Restoring:** PAUSE-20240115-143022 (2 hours ago)

---

## Context

**Specification:** SPEC-003 — Auth middleware
**Status:** running
**Priority:** high | **Complexity:** medium

## Where You Left Off

Working on JWT authentication middleware. Created auth.ts with basic
token validation.

**Your notes:**
> Need to finish token refresh logic

## Files in Progress

| File | Status |
|------|--------|
| src/middleware/auth.ts | Created (new) |
| src/types/auth.ts | Created (new) |
| src/utils/jwt.ts | Modified |

## Acceptance Criteria

- [x] JWT validation middleware
- [x] Token type definitions
- [ ] Token refresh rotation
- [ ] Error handling

---

**Next Step:** Continue implementation

Files to focus on:
- `src/middleware/auth.ts:45` — add refresh logic here
```

**If state changed since pause:**
```
⚠️  State changed since pause

**Pause state:** SPEC-003 — running
**Current state:** SPEC-003 — review

Changes detected:
- Implementation completed
- Review requested

**Options:**
1. Use current state (recommended)
2. Restore pause state
3. View diff

Your choice [1]:
```

**No agent needed** — context restoration and file operations.

---

## Implementation Requirements

### Atomic Commits

One commit per completed unit of work:
- `feat(sf): add /sf list command`
- `feat(sf): add /sf show command`
- `feat(sf): add /sf next command`
- `feat(sf): add /sf todo command`
- `feat(sf): add /sf todos command`
- `feat(sf): add /sf plan command`
- `feat(sf): add /sf priority command`
- `feat(sf): add /sf pause command`
- `feat(sf): add /sf resume command`

### Templates

Create `templates/todo.md`:
```markdown
# To-Do List

<!-- Add new items at the top -->

---
*Last updated: [date]*
```

### Directory Structure

Ensure these directories exist:
```
.specflow/
├── todos/
│   └── TODO.md
└── sessions/
    └── PAUSE-{timestamp}.md
```

### Testing

After implementing each command:
1. Test with existing specs from Phase 1-2
2. Verify STATE.md updates correctly
3. Test edge cases (empty lists, no active spec, etc.)

### Consistency

- Follow patterns established in Phase 1-2 commands
- Use same XML structure for commands
- Maintain consistency with DESIGN.md

---

## Implementation Order

1. **Template:** `templates/todo.md`
2. **Command:** `commands/sf/list.md`
3. **Command:** `commands/sf/show.md`
4. **Command:** `commands/sf/next.md`
5. **Command:** `commands/sf/todo.md`
6. **Command:** `commands/sf/todos.md`
7. **Command:** `commands/sf/plan.md`
8. **Command:** `commands/sf/priority.md`
9. **Command:** `commands/sf/pause.md`
10. **Command:** `commands/sf/resume.md`

---

## Phase 3 Completion Criteria

- [ ] `/sf list` shows all specifications with status
- [ ] `/sf show` displays specification details
- [ ] `/sf show SPEC-XXX` works with argument
- [ ] `/sf next` finds and activates highest priority task
- [ ] `/sf todo` creates new to-do item
- [ ] `/sf todos` lists all to-do items
- [ ] `/sf plan` converts to-do to specification
- [ ] `/sf priority` allows reordering
- [ ] `/sf pause` saves session context
- [ ] `/sf resume` restores session context
- [ ] All commands work in Claude Code
- [ ] Code is committed and pushed

---

## After Completion

Report readiness for Phase 4 (Decomposition & Utilities):
- `/sf split`
- `/sf deps`
- `/sf help`
- `/sf history`
- `/sf metrics`

---

## Notes

- `/sf list` and `/sf todos` are read-only — no state changes
- `/sf next` changes active spec in STATE.md
- `/sf pause`/`resume` create/read session files
- `/sf plan` reuses spec-creator agent
- Consider edge cases: empty project, no specs, no todos
- `/sf priority` should handle both specs and todos

## Design Decisions

- **No separate agents for Phase 3** — all commands are state/file management
- **TODO storage** — single TODO.md file (simpler than per-item files)
- **Session storage** — one file per pause (allows history)
- **Priority** — interactive mode only (no automation)
