SpecFlow — Spec-Driven Development for Claude Code  
Project Name: SpecFlow  
Date: 2026-01-20  
Status: Final Design Document  

1. Comparative Analysis of Approaches  
1.1 Your Current Process (Spec-Driven Workflow)  
Philosophy: Specifications as contracts between sessions. Cross-audit for quality.  
Strengths:  
| Aspect               | Description                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| Quality Focus        | Explicit audit cycle: specification → implementation                        |
| Compact Specs        | Clear format: Context → Task → Requirements → Acceptance Criteria           |
| Cross-Audit          | Separate "clean" sessions for review (no bias)                              |
| Human-in-the-Loop    | You control when to transition between phases                                |
| Minimal Overhead     | No complex infrastructure—just files and discipline                         |

Weaknesses:  
| Aspect            | Description                                      |
|-------------------|--------------------------------------------------|
| Manual Context    | Copying between sessions manually                |
| No State          | No unified STATE.md with decisions               |
| No Parallelization| Sequential execution                             |
| No Claude Code Integration | Separate sessions without CLI automation |

1.2 GSD (Get Shit Done)  
Philosophy: Meta-prompting + Context Engineering. Subagent orchestration for fresh context.  
Strengths:  
| Aspect                 | Description                                               |
|------------------------|-----------------------------------------------------------|
| Native Integration     | Slash commands, hooks, statusline                         |
| Context Preservation   | STATE.md, subagent isolation                              |
| Parallelization        | Wave-based execution                                      |
| Atomic Commits         | One commit = one task                                     |
| Goal-Backward Verification | must_haves in plans                                   |
| Session Persistence    | pause-work / resume-work                                  |

Weaknesses:  
| Aspect              | Problem                                                   |
|---------------------|-----------------------------------------------------------|
| Overhead            | 25 commands, 11 agents, 40+ templates — complexity tax     |
| Long Planning       | discuss → research → plan → check → execute               |
| Token Inflation     | Many "administrative" messages between agents              |
| No Explicit Quality Audit | Verification ≠ Audit. Checks "code exists", not "code is good" |
| Incomplete Implementation | Example: refactoring adds +20% code instead of replacing |
| Blind Trust in Plans| If plan is incomplete, executor won’t understand          |

1.3 Key Differences  
| Your Approach         | GSD                              |
|-----------------------|----------------------------------|
| Audit-driven — separate sessions verify quality | Verification-driven — automated checks for "exists/missing" |
| Human gate — you decide when to proceed | Checkpoint gate — system decides when to ask |
| Simplicity — files + discipline | Complexity — 25 commands, 11 agents |

2. Root Causes of GSD Problems  
2.1 Why Refactoring Added +20% Code  
Diagnosis: GSD verifies "artifacts exist", but not "old code is removed".  
# Typical must_haves in GSD  
must_haves:  
  artifacts:  
    - path: "src/refactored/NewClass.ts"  
      provides: "Refactored implementation"  
  truths:  
    - "NewClass works correctly"  

What’s Missing:  
"OldClass.ts deleted or deprecated"  
"No imports reference OldClass"  
"Total LOC decreased by X%"  

Solution: Add deletion verification and LOC delta checks.  

2.2 Why Long Planning ≠ Quality  
Diagnosis: GSD optimizes for "completeness of plan", not "minimal viable plan".  
discuss-phase (asks 10+ questions)  
    ↓  
research-phase (explores everything)  
    ↓  
plan-phase (creates 3–5 plans)  
    ↓  
plan-checker (validates)  
    ↓  
execute...  

Problem: Each step consumes tokens, but plan quality isn’t proportional to cost.  

Your Process:  
1 specification → 1 audit → fixes → 1 implementation  

Solution: Lean planning — fewer phases, higher quality per phase.  

2.3 Absence of Quality Audit  
GSD Verification:  
truths:  
  - "User can login"  # Checks "works"  

Your Audit:  
Check:  
- Code and architectural quality  
- Compliance with specification  
- Integration with existing code  
- Best practices  
- No duplication  
- Minimized cognitive load  

Solution: Integrate quality audit as a distinct phase.  

3. SpecFlow Architecture  
3.1 Philosophy: "Spec-Driven + Claude Code Native"  
┌─────────────────────────────────────────────────────────────┐  
│                    SPECFLOW WORKFLOW                        │  
├─────────────────────────────────────────────────────────────┤  
│                                                             │  
│  /sf init              → Project initialization             │  
│       ↓                                                     │  
│  /sf new               → Create specification               │  
│       ↓                                                     │  
│  /sf audit             → Specification audit (fresh context)│  
│       ↓                                                     │  
│  /sf run               → Implementation per spec            │  
│       ↓                                                     │  
│  /sf review            → Implementation audit (fresh context)│  
│       ↓                                                     │  
│  /sf done              → Finalize + commit                  │  
│                                                             │  
└─────────────────────────────────────────────────────────────┘  

3.2 Core Principles  
| # | Principle          | Implementation                                 |
|---|--------------------|-----------------------------------------------|
| 1 | Spec-first         | Specification created before implementation   |
| 2 | Explicit audit     | Audit is a separate phase, not verification   |
| 3 | Fresh context      | Auditor doesn’t see creation process          |
| 4 | Lean process       | Minimum commands, maximum utility             |
| 5 | Human gate         | Human decides when to proceed                 |
| 6 | State persistence  | STATE.md for inter-session decisions          |
| 7 | Token awareness    | Specs ≤ one session (~150k tokens)            |

3.3 Command System  
Naming Principles  
- Short — 2–6 characters for main command  
- Action verbs — what it does, not what it is  
- No redundancy — `/sf` instead of `/specflow`, `new` instead of `create-spec`  
- Consistency — similar actions = similar names  

Core Commands  
| Command     | Description                          | When to Use                     |
|-------------|--------------------------------------|---------------------------------|
| /sf init    | Initialize project + analyze codebase| Once at project start           |
| /sf new     | Create new specification             | Start of new task               |
| /sf audit   | Audit specification                  | After spec creation/refinement  |
| /sf revise  | Revise spec based on feedback        | After audit with comments       |
| /sf run     | Execute specification                | After approved audit            |
| /sf review  | Audit implementation                 | After execution                 |
| /sf fix     | Fix implementation per feedback      | After review with comments      |
| /sf done    | Finalize + commit                    | After approved review           |

Navigation & State  
| Command      | Description                     |
|--------------|---------------------------------|
| /sf status   | Current state, next step        |
| /sf list     | List all specifications         |
| /sf show [ID]| Show specification              |
| /sf next     | Next highest-priority task      |

Task Management  
| Command        | Description                        |
|----------------|------------------------------------|
| /sf todo [text]| Add future idea/task               |
| /sf todos      | List todos with priorities         |
| /sf plan [ID]  | Convert todo into specification    |
| /sf priority   | Interactive prioritization         |

Decomposition  
| Command       | Description                      |
|---------------|----------------------------------|
| /sf split [ID]| Split large spec into parts      |
| /sf deps      | Show dependency graph            |

Sessions  
| Command     | Description                |
|-------------|----------------------------|
| /sf pause   | Save context for pause     |
| /sf resume  | Restore context            |

Utilities  
| Command      | Description                   |
|--------------|-------------------------------|
| /sf help     | Command reference             |
| /sf history  | History of completed specs    |
| /sf metrics  | Statistics (time, revisions, etc.) |

3.4 Full Workflow  
┌─────────────────────────────────────────────────────────────────────────┐  
│                         SPECFLOW COMPLETE WORKFLOW                       │  
├────────────────────────── ───────────────────────────────────────────────┤  
│                                                                          │  
│  ┌────────────────────────────────────────────────── ───────────────┐    │  
│  │ INITIALIZATION (once)                                            │    │  
│  │                                                                  │    │  
│  │   /sf init  ──→  Codebase analysis                               │    │  
│  │                 Create .specflow/PROJECT.md                      │    │  
│  │                 Create .specflow/STATE.md                        │    │  
│  └─────────────────────────────────────────────────────────────────┘    │  
│       ↓                                                                   │  
│  ┌─────────────────────────────────────────────────────────────────┐    │  
│  │ SPEC CREATION                                                    │    │  
│  │                                                                   │    │  
│  │  /sf new  "task description"                                      │    │  
│  │       ↓                                                          │    │  
│  │  Agent asks critical questions (if needed)                        │    │  
│  │       ↓                                                          │    │  
│  │  Creates SPEC-XXX.md with complexity estimate                    │    │  
│  │        ↓                                                          │    │  
│  │  [Large?] ──yes──→ /sf split (decomposition)                     │    │  
│  │       │                                                           │    │  
│  │       no                                                         │    │  
│  └───────┼───────────────────────────────────────────────── ────────┘    │  
│          ↓                                                               │  
│  ┌─────────────────────────────────────────────────────────────────┐    │  
│  │ SPEC AUDIT LOOP                                                  │    │  
│  │                                                                  │    │  
│  │  /sf audit ──→ APPROVED? ──yes──→  EXIT LOOP                     │    │  
│  │       │                                                          │    │  
│  │       no (comments)                                              │    │  
│  │       ↓                                                          │    │  
│  │  /sf revise [instructions]                                       │    │  
│  │       │                                                           │    │  
│  │       └──────────→ loop back                                     │    │  
│  └───────────────────────────────────── ────────────────────────────┘    │  
│          ↓                                                               │  
│  ┌──────────────────────────────────────────────────────────────── ─┐    │  
│  │ EXECUTION                                                        │    │  
│  │                                                                  │    │  
│  │  /sf run ──→  Implementation with atomic commits                 │    │  
│  │                                                                  │    │  
│  └───────────────────────────────────────── ────────────────────────┘    │  
│          ↓                                                               │  
│  ┌─────────────────────────────────────────────────────────────────┐     │  
│  │ IMPL REVIEW LOOP                                                 │    │  
│  │                                                                  │    │  
│  │  /sf review ──→ APPROVED? ──yes──→ EXIT LOOP                     │    │  
│  │       │                                                          │    │  
│  │       no (comments)                                              │    │  
│  │       ↓                                                          │    │  
│  │  /sf fix [instructions]                                          │    │  
│  │       │                                                          │    │  
│  │       └──────────→ loop back                                     │    │  
│  └───────────────────── ────────────────────────────────────────────┘    │  
│          ↓                                                               │  
│  ┌──────────────────────────────────────────────── ─────────────────┐    │  
│  │ COMPLETION                                                       │    │  
│  │                                                                  │    │  
│   │  /sf done ──→ Final commit                                      │    │  
│  │              Update STATE.md                                     │    │  
│  │              Archive specification                               │    │  
│  └─────────────────────────────────────────────────────────────────┘    │  
│                                                                           │  
└─────────────────────────────────────────────────────────────────────────┘  

3.5 Audit Cycles  
Specification Audit  
/sf audit  

┌─────────────────────────────────────────────────────────┐  
│ Audit SPEC-001 v2                                        │  
│                                                          │  
│ Status: NEEDS_REVISION                                   │  
│                                                          │  
│ Critical:                                                │  
│ 1. Deletion of OldClass.ts not specified                 │  
│ 2. Criterion "works correctly" is not measurable          │  
│                                                          │  
│ Recommendations:                                         │  
│ 3. Add example of expected API response                  │  
│                                                          │  
│ Next Step: /sf revise                                    │  
└─────────────────────────────────────────────────────────┘  

Audit Without Comments  
/sf audit  

✅ SPEC-001 passed audit  

Status: APPROVED  
Comment: Requirements complete, criteria measurable.  

Next Step: /sf run  

Implementation Review  
/sf review  

┌─────────────────────────────────────────────────────────┐  
│ Review SPEC-001                                          │  
│                                                          │  
│ Status: NEEDS_FIXES                                      │  
│                                                          │  
│ Issues:                                                  │  
│ 1. OldClass.ts not deleted (2 imports remain)            │  
│ 2. Missing error handling in UserService.ts:45           │  
│                                                          │  
│ Recommendations:                                         │  
│ 3. Add JSDoc to public methods                           │  
│                                                          │  
│ Next Step: /sf fix                                       │  
└─────────────────────────────────────────────────────────┘  

3.6 The `/sf revise` Command  
Without Arguments — Interactive Mode:  
/sf revise  

Audit v2 found:  

Critical:  
1. Deletion of OldClass.ts not specified  
2. Criterion "works correctly" not measurable  

Recommendations:  
3. Add example of expected API response  

What to fix?  
- "all" — apply all comments  
- "1,2" — only critical items  
- "1,3" — selectively  
- or describe your own changes  

With Arguments:  
/sf revise all                    # Apply all comments  
/sf revise 1,2                    # Only items 1 and 2  
/sf revise add deletion of OldClass.ts, ignore item 3  

3.7 Blocking `/sf run`  
Warning + Confirmation (not hard block):  
/sf run  

⚠️  SPEC-001 hasn’t passed audit (status: revision_requested)  

Last audit identified 2 critical issues:  
1. Deletion of OldClass.ts not specified  
2. Criterion "works correctly" not measurable  

Proceed? [y/N]  

If confirmed — recorded in STATE.md for tracking.  

3.8 Decomposing Large Tasks  
Automatic Complexity Estimation  
When creating a spec, the agent estimates:  

| Size    | Tokens   | Action                     |  
|---------|----------|----------------------------|  
| Small   | ≤50k     | Execute directly           |  
| Medium  | 50–150k  | Warning, proceed           |  
| Large   | >150k    | Requires decomposition     |  

The `/sf split` Command  
/sf split SPEC-001  

Specification SPEC-001 is too large (~200k tokens).  

Proposed split:  
1. SPEC-001a: Create UserService (50k)  
2. SPEC-001b: Migrate existing code (60k)  
3. SPEC-001c: Remove OldUserService (30k)  

Dependencies: 001a → 001b → 001c  

Create? [Y/n]  

3.9 To-Do System  
Creation  
/sf todo Add caching for API  

✅ TODO-005 created  
Priority: not set  

Viewing  
/sf todos  

┌─────────────────────────────────────────────────────────┐  
│ To-Do List                                               │  
├────┬─────────────────────────────────────┬──────────────┤  
│ #  │ Description                         │ Priority     │  
├────┼─────────────────────────────────────┼──────────────┤  
│ 1  │ Add caching for API                 │ high         │  
│ 2  │ Refactor AuthService                │ medium       │  
│ 3  │ Update documentation                │ low          │  
│ 4  │ Research WebSocket                  │ —            │  
└────┴─────────────────────────────────────┴──────────────┘  

/sf plan 1    — convert to specification  
/sf priority  — change priorities  

Prioritization  
/sf priority  

Current order:  
1. [high] Add caching for API  
2. [medium] Refactor AuthService  
3. [low] Update documentation  
4. [—] Research WebSocket  

Change order? Enter new sequence (e.g., 2,1,4,3)  
or "tech" for technically optimal order:  

3.10 Clarifying Questions  
Agent asks only critical questions; rest are assumptions:  
/sf new "Add authentication"  

To create specification, please clarify:  

1. Authentication method?  
   a) JWT (recommended)  
   b) Session-based  
   c) OAuth 2.0  

Rest will be assumed (can be changed during /sf revise):  
- Database: PostgreSQL (from PROJECT.md)  
- Framework: Next.js (from PROJECT.md)  

Assumptions are recorded in the specification:  
## Assumptions (made by agent)  
- Using PostgreSQL (from PROJECT.md)  
- API will be REST (not explicitly stated)  

> If assumptions are incorrect, specify during /sf revise  

3.11 Hybrid Audit Storage  
File Structure  
.specflow/  
├── PROJECT.md           # Project overview (from /sf init)  
├── STATE.md             # Current state  
├── config.json          # Configuration  
├── specs/  
│   ├── SPEC-001.md      # Specification + brief history  
│   ├── SPEC-002.md  
│   └── ...  
├── audits/  
│   ├── SPEC-001-AUDIT-v1.md  # Detailed (if >3 comments)  
│   └── ...  
├── todos/  
│   └── TODO.md          # Idea list  
└── archive/  
    └── SPEC-000.md      # Completed specs  

Audit Placement Rule  
| Condition        | Storage Location        |  
|------------------|-------------------------|  
| ≤3 comments      | Inside specification    |  
| >3 comments      | Separate file + summary in spec |  

3.12 Specification Format  
---  
id: SPEC-001  
type: feature | refactor | bugfix  
status: draft | audited | running | review | done  
priority: high | medium | low  
complexity: small | medium | large  
created: 2026-01-20  
---  

# [Task Title]  

## Context  
[Why this is needed]  

## Task  
[What needs to be done]  

## Requirements  
### Interfaces (if applicable)  
### Files to create/modify  
### Files to delete (!)  

## Acceptance Criteria  
- [ ] [Criterion 1]  
- [ ] [Criterion 2]  

## Constraints  
- [What NOT to do]  

## Assumptions (filled by agent)  
- [Assumption 1]  
- [Assumption 2]  

---  

## Audit History  

### Audit v1 (2026-01-20 14:30)  
**Status:** NEEDS_REVISION  
**Comments:**  
1. ...  

### Response v1 (2026-01-20 15:00)  
**Changes:**  
1. ✅ ...  

---  

3.13 State Management  
# .specflow/STATE.md  

## Current Position  
- **Active Specification:** SPEC-003  
- **Status:** running  
- **Next Step:** /sf review  

## Queue  
| # | ID | Title | Priority | Status |  
|---|----|-------|----------|--------|  
| 1 | SPEC-003 | Auth middleware | high | running |  
| 2 | SPEC-004 | User profile | medium | audited |  
| 3 | SPEC-005 | Settings page | low | draft |  

## Decisions  
| Date | Specification | Decision |  
|------|---------------|----------|  
| 2026-01-15 | SPEC-001 | jose instead of jsonwebtoken |  
| 2026-01-18 | SPEC-002 | PostgreSQL instead of MySQL |  

## Project Patterns  
- JWT auth via httpOnly cookies  
- API routes in /app/api/  
- Prisma for ORM  

## Warnings  
| Date | Specification | Reason |  
|------|---------------|--------|  
| — | — | — |  

3.14 Configuration  
// .specflow/config.json  
{  
   "auto_commit": true,  
   "commit_format": "feat(sf-{id}): {description}",  
   "ask_questions": "critical_only",  
   "complexity_threshold": {  
     "small": 50000,  
     "medium": 150000  
  },  
   "audit_storage": "hybrid"  
}  

4. Comparison with GSD  
| Aspect               | GSD          | SpecFlow     |  
|----------------------|--------------|--------------|  
| Commands             | 25           | 15           |  
| Agents               | 11           | 4            |  
| Phases per Task      | 5+           | 3–4          |  
| Quality Audit        | No           | Yes (explicit)|  
| Revision Loop        | No           | Yes (/sf revise, /sf fix) |  
| Code Deletion        | Not verified | Explicit checklist |  
| Blocking             | Hard         | Soft (warning)|  
| Decomposition        | Manual       | Auto-assessment + /sf split |  
| To-Do System         | Yes          | Yes + prioritization |  
| Atomic Commits       | Yes          | Yes          |  

5. Answers to Questions  
5.1 Fork GSD or New Project?  
Decision: New Project  
Reasons:  
- Different philosophy — audit-driven vs verification-driven  
- Fewer commands — no need to delete 20 commands  
- Easier maintenance — no upstream dependency  
- Cleaner architecture  

What to Borrow from GSD:  
- npx-based installation structure  
- Hooks system (statusline)  
- Subagent pattern  

5.2 Installation via npx  
// package.json  
{  
   "name": "specflow-cc",  
   "bin": {  
     "specflow-cc": "bin/install.js"  
  },  
   "files": [ "bin", "commands", "agents", "templates" ]  
}  

npx specflow-cc  

5.3 License  
MIT — fully original code.  

6. Implementation Plan  
Phase 1: Core (3–4 days)  
Commands:  
`/sf init`  
`/sf new`  
`/sf audit`  
`/sf revise`  
`/sf run`  
`/sf review`  
`/sf fix`  
`/sf done`  
`/sf status`  

Agents:  
spec-creator  
spec-auditor  
spec-executor  
impl-reviewer  

Phase 2: Navigation & State (2 days)  
Commands:  
`/sf list`  
`/sf show`  
`/sf next`  
`/sf pause`  
`/sf resume`  

Phase 3: To-Do & Decomposition (2 days)  
Commands:  
`/sf todo`  
`/sf todos`  
`/sf plan`  
`/sf priority`  
`/sf split`  
`/sf deps`  

Phase 4: Polish (1–2 days)  
Commands:  
`/sf help`  
`/sf history`  
`/sf metrics`  

Also:  
Statusline hook  
README.md  
npm publication  

7. Repository Structure  
specflow-cc/  
├── package.json  
├── README.md  
├── LICENSE (MIT)  
├── CHANGELOG.md  
├── bin/  
│   └── install.js  
├── commands/  
│   └── sf/  
│       ├── init.md  
│       ├── new.md  
│       ├── audit.md  
│       ├── revise.md  
│       ├── run.md  
│       ├── review.md  
│       ├── fix.md  
│       ├── done.md  
│       ├── status.md  
│       ├── list.md  
│       ├── show.md  
│       ├── next.md  
│       ├── todo.md  
│       ├── todos.md  
│       ├── plan.md  
│       ├── priority.md  
│       ├── split.md  
│       ├── deps.md  
│       ├── pause.md  
│       ├── resume.md  
│       ├── help.md  
│       ├── history.md  
│       └── metrics.md  
├── agents/  
│   ├── spec-creator.md  
│   ├── spec-auditor.md  
│   ├── spec-executor.md  
│   └── impl-reviewer.md  
├── templates/  
│   ├── spec.md  
│   ├── audit.md  
│   ├── project.md  
│   ├── state.md  
│   └── todo.md  
└── hooks/  
    └── statusline.js  

8. New Ideas (Beyond GSD)  
A. Cross-Provider Audit  
/sf audit --provider=openai  

B. Spec Templates  
/sf new --template=refactor  
/sf new --template=api  
/sf new --template=bugfix  

C. Dependency Graph  
/sf deps              # Visualization  
/sf deps SPEC-005     # What depends on SPEC-005  

D. Metrics Dashboard  
/sf metrics           # Time, revisions, success rate  

9. Decisions Made During Discussion  
| Date       | Question                  | Decision                     | Justification                     |  
|------------|---------------------------|------------------------------|-----------------------------------|  
| 2026-01-20 | Name                      | SpecFlow                     | Short, reflects essence           |  
| 2026-01-20 | Audit Storage             | Hybrid                       | ≤3 inline, >3 separate            |  
| 2026-01-20 | Run Blocking              | Warning                      | Flexibility + trust               |  
| 2026-01-20 | /sf revise without text   | Interactive mode             | Auto-read audit                   |  
| 2026-01-20 | Implementation Audit      | Yes, cyclic                  | /sf review + /sf fix              |  
| 2026-01-20 | Result Without Comments   | Explicit APPROVED            | Clear feedback                    |  
| 2026-01-20 | To-Do System              | Yes, with prioritization     | /sf todo, /sf todos, /sf plan     |  
| 2026-01-20 | Init + map-codebase       | Yes, simplified              | /sf init                          |  
| 2026-01-20 | Auto Commits              | Yes, configurable            | config.json                       |  
| 2026-01-20 | Token Limit               | Yes, complexity estimation   | small/medium/large                |  
| 2026-01-20 | Search During Planning    | Yes                          | Agent searches related code       |  
| 2026-01-20 | Clarifying Questions      | Critical only                | Rest = assumptions                |  
| 2026-01-20 | Phase Prioritization      | Yes                          | /sf priority, /sf next            |  
| 2026-01-20 | Full CLI                  | Yes                          | From first version                |  

10. Command Summary  
Core Workflow  
| Command     | Action                     |  
|-------------|----------------------------|  
| /sf init    | Initialize project         |  
| /sf new     | Create specification       |  
| /sf audit   | Audit specification        |  
| /sf revise  | Revise specification       |  
| /sf run     | Execute                    |  
| /sf review  | Audit implementation       |  
| /sf fix     | Fix implementation         |  
| /sf done    | Finalize                   |  

Navigation  
| Command     | Action                     |  
|-------------|----------------------------|  
| /sf status  | Current state              |  
| /sf list    | All specifications         |  
| /sf show    | Show one                   |  
| /sf next    | Next task                  |  

To-Do  
| Command     | Action                     |  
|-------------|----------------------------|  
| /sf todo    | Add idea                   |  
| /sf todos   | List                       |  
| /sf plan    | Convert to spec            |  
| /sf priority| Prioritize                 |  

Decomposition  
| Command     | Action                     |  
|-------------|----------------------------|  
| /sf split   | Split into parts           |  
| /sf deps    | Dependency graph           |  

Session  
| Command     | Action                     |  
|-------------|----------------------------|  
| /sf pause   | Save context               |  
| /sf resume  | Restore                    |  

Utility  
| Command     | Action                     |  
|-------------|----------------------------|  
| /sf help    | Help                       |  
| /sf history | History                    |  
| /sf metrics | Statistics                 |  

Total: 22 commands (vs 25 in GSD, but with higher functionality per command)  
Ready for implementation.