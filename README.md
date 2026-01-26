<div align="center">

# SpecFlow

**Spec-driven development for Claude Code**

**Stop debugging AI-generated code. Start reviewing specifications.**

[![npm version](https://img.shields.io/npm/v/specflow-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/specflow-cc)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npx specflow-cc --global
```

<br>

https://github.com/user-attachments/assets/3f516907-8657-4ea4-bc0c-6319998a09db

<br>

*"The audit caught 4 issues before I wrote a single line of code."*

*"Fresh context review found a bug I would have shipped to production."*

*"Finally, a workflow where Claude explains what it will do before doing it."*

<br>

[Why This Exists](#why-this-exists) · [How It Works](#how-it-works) · [Commands](#commands) · [Configuration](#configuration)

</div>

---

## Why This Exists

Claude Code is powerful. But "just build it" leads to:

- Code that doesn't match what you imagined
- Assumptions you didn't know were made
- Bugs that only appear after 2000 lines are written
- Hours spent debugging instead of building

The fix isn't better prompting. It's **making Claude think before it codes.**

SpecFlow enforces a simple principle: **write the spec first, audit it, then implement.** Every specification gets reviewed in a fresh context — no bias from creation. Every implementation gets reviewed against the spec — no "it works on my machine."

The result: fewer surprises, cleaner code, and a paper trail of decisions.

---

## Why SpecFlow?

Most AI coding workflows suffer from **"Yes-Man Syndrome"** — you ask for a feature, the AI nods and writes code. 500 lines later, you discover hallucinated APIs, missing edge cases, or security holes.

SpecFlow fixes this with **Fresh Context Auditing**:

| Aspect | Standard AI Coding | SpecFlow |
|--------|-------------------|----------|
| **Context** | Single window (grows, degrades) | Fresh context per phase |
| **Quality Control** | Self-correction (biased) | Independent Auditor (unbiased) |
| **Verification** | "Looks good to me" | Verified against contract |
| **Execution** | Linear, single agent | Atomic waves, parallel agents |
| **Result** | Hidden bugs ship | Issues caught before code exists |

> The auditor has no memory of your conversation. It only sees the spec. If the spec says "use the flux capacitor API" — the auditor asks "what is that?"

---

## Who This Is For

Developers who want Claude Code to:

- **Explain before implementing** — See the plan before code exists
- **Catch issues early** — Audits find problems when they're cheap to fix
- **Stay consistent** — Same quality whether it's your first task or fiftieth
- **Document decisions** — Know why code was written the way it was

If you've ever said "that's not what I meant" after Claude finished coding, this is for you.

---

## Getting Started

```bash
npx specflow-cc --global
```

Then in any project:

```bash
/sf:init                    # Initialize (once per project)
/sf:new "add user auth"     # Create specification
```

Verify installation with `/sf:help`.

### Quick Mode

For trivial tasks that don't need full specification:

```bash
/sf:quick "fix typo in header"
```

Same quality principles, faster path.

---

## How It Works

### 1. Create Specification

```
/sf:new "add OAuth login"
```

The system asks clarifying questions, then creates a structured specification:

- **Goal Analysis** — What success looks like
- **Requirements** — What must be built
- **Acceptance Criteria** — How to verify it works
- **Constraints** — What to avoid

You review the spec. If something's wrong, you catch it now — not after 500 lines of code.

**Creates:** `.specflow/specs/SPEC-XXX.md`

---

### 2. Audit Specification

```
/sf:audit
```

**This is where SpecFlow is different.**

A fresh agent — with no memory of how the spec was created — reviews it for:

- Ambiguous requirements
- Missing edge cases
- Unrealistic scope
- Contradictions

The auditor doesn't know your assumptions. It only sees the spec. If something is unclear, it will ask.

**Why fresh context matters:** The agent that wrote the spec "knows what it meant." A fresh auditor only knows what's written. This catches gaps you'd otherwise miss.

If issues are found, `/sf:revise` applies the feedback. Loop until approved.

**Creates:** Audit record in spec, recommendations if needed

---

### 3. Implement

```
/sf:run
```

Now — and only now — code gets written.

The executor has:
- A clear, audited specification
- Defined acceptance criteria
- Explicit constraints

No guessing. No "I'll figure it out as I go." The spec is the source of truth.

For large specs, the system automatically:
- Splits work into parallel waves
- Spawns fresh executors per task
- Commits atomically per unit of work

**Creates:** Implementation + Execution Summary in spec

---

### 4. Review Implementation

```
/sf:review
```

Another fresh agent reviews what was built against what was specified:

- Does the code meet acceptance criteria?
- Were all files created/deleted as planned?
- Any security issues or code quality problems?

Same principle as audit: fresh eyes catch what familiar eyes miss.

If issues are found, `/sf:fix` addresses them. Loop until approved.

**Creates:** Review record in spec

---

### 5. Verify (Optional)

```
/sf:verify
```

Automated checks confirm code exists and tests pass. But does it actually *work*?

This step walks you through manual verification:

- "Can you log in with OAuth?"
- "Does the redirect work?"
- "Is the session persisted?"

You confirm each item. If something's broken, the system helps diagnose and creates fix plans.

**Creates:** Verification record

---

### 6. Complete

```
/sf:done
```

Archives the specification. Records decisions. Clears state for the next task.

Your spec becomes documentation: why the code exists, what decisions were made, how it was verified.

---

## The Full Workflow

```
                        /sf:quick (trivial tasks)
                              ↓
/sf:new  →  /sf:audit  →  /sf:run  →  /sf:review  →  /sf:verify  →  /sf:done
              ↓                          ↓              ↓
         /sf:revise                  /sf:fix      (optional UAT)
         (if needed)                 (if needed)
```

**Key principle:** Audits and reviews run in fresh context — no bias from creation.

---

## Why It Works

### Fresh Context Auditing

The agent that creates a spec "knows what it meant." That's dangerous — unclear writing seems clear to the writer.

SpecFlow audits in a **separate context**. The auditor only sees the specification text. If requirements are ambiguous, the auditor will flag them — because it genuinely doesn't know the intent.

This catches:
- Assumptions that weren't written down
- Edge cases the creator forgot
- Scope that's larger than it appears

### Spec as Contract

The specification isn't a suggestion. It's a contract:

| Section | What it defines |
|---------|-----------------|
| Goal Analysis | What success looks like |
| Requirements | What must exist |
| Acceptance Criteria | How to verify completion |
| Constraints | What to avoid |
| Files to Create/Modify | Exact scope |

The executor implements the contract. The reviewer verifies compliance. No drift.

### Atomic Execution

Large specifications automatically decompose into waves:

```
Wave 1: [task-1] [task-2] [task-3]  ← parallel
Wave 2: [task-4] [task-5]           ← parallel, depends on wave 1
Wave 3: [task-6]                    ← sequential
```

Each task runs in fresh context. Each task commits atomically. If something fails, you know exactly which task and can fix just that piece.

### Decision Trail

Every specification records:
- Audit feedback and responses
- Review findings and fixes
- Verification results

Six months later, you can read the spec and understand not just *what* was built, but *why* — and what was explicitly decided against.

---

## Commands

### Core Flow

| Command | Description |
|---------|-------------|
| `/sf:init` | Initialize project |
| `/sf:new "task"` | Create specification |
| `/sf:audit` | Audit spec (fresh context) |
| `/sf:revise` | Revise based on audit feedback |
| `/sf:run` | Implement specification |
| `/sf:review` | Review implementation (fresh context) |
| `/sf:fix` | Fix based on review feedback |
| `/sf:verify` | Interactive user acceptance testing |
| `/sf:done` | Complete and archive |

**Quick mode:**

```bash
/sf:quick "fix button color"    # Skip full workflow for trivial tasks
```

**Revise options:**

```bash
/sf:revise              # Interactive — choose what to fix
/sf:revise all          # Apply all feedback
/sf:revise 1,2          # Fix specific items
/sf:revise "custom..."  # Custom instructions
```

### Research & Clarification

| Command | Description |
|---------|-------------|
| `/sf:research "topic"` | Research and save findings |
| `/sf:discuss "topic"` | Multi-question clarification |
| `/sf:discuss "question?"` | Single question |
| `/sf:discuss --pre "topic"` | Pre-spec discussion with feature-type questions |
| `/sf:scan` | Analyze codebase for issues |

**Pre-spec discussion** identifies gray areas before creating a spec:

```bash
/sf:discuss --pre "add export feature"   # Asks feature-type-specific questions
/sf:new --discuss PRE-001 "add export"   # Creates spec with discussion context
```

### Navigation

| Command | Description |
|---------|-------------|
| `/sf:status` | Current state and next step |
| `/sf:list` | All specifications |
| `/sf:next` | Switch to highest priority task |
| `/sf:show` | View spec details |
| `/sf:history` | View archived specs |
| `/sf:metrics` | Project statistics |

### Backlog

| Command | Description |
|---------|-------------|
| `/sf:todo "idea"` | Capture idea for later |
| `/sf:todos` | List all todos |
| `/sf:plan` | Convert todo to spec |
| `/sf:priority` | Reprioritize queue |

### Utilities

| Command | Description |
|---------|-------------|
| `/sf:split` | Break large spec into parts |
| `/sf:deps` | Show spec dependencies |
| `/sf:pause` | Save session context |
| `/sf:resume` | Restore session |
| `/sf:help` | Command reference |

---

## Configuration

Settings live in `.specflow/config.json`.

### Model Profiles

Control cost vs quality:

```json
{
  "model_profile": "balanced"
}
```

| Profile | Spec Creation | Execution | Review |
|---------|---------------|-----------|--------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

Use `quality` for critical features, `budget` for routine tasks.

---

## Project Structure

```
.specflow/
├── PROJECT.md      # Project context (patterns, conventions)
├── STATE.md        # Current state and queue
├── config.json     # Settings
├── specs/          # Active specifications
├── research/       # Research documents
├── discussions/    # Clarification records
└── archive/        # Completed specifications
```

---

## Typical Session

```bash
# Check current state
/sf:status

# Trivial fix — use quick mode
/sf:quick "fix typo in README"

# Feature work — full workflow
/sf:discuss --pre "add OAuth"           # Clarify gray areas first
/sf:new --discuss PRE-001 "add OAuth"   # Create spec with context
/sf:audit                                # Fresh context audit
/sf:revise all                           # Apply feedback if needed
/sf:run                                  # Implement
/sf:review                               # Fresh context review
/sf:verify                               # Manual verification
/sf:done                                 # Archive
```

---

## Troubleshooting

**Commands not found?**
- Restart Claude Code to reload commands
- Verify files exist in `~/.claude/` (global) or `.claude/` (local)
- Re-run `npx specflow-cc --global`

**Audit/review seems to miss obvious issues?**
- Use `/clear` before `/sf:audit` or `/sf:review` to ensure fresh context
- Check that spec has clear acceptance criteria

**Large spec taking too long?**
- Use `/sf:split` to decompose into smaller specs
- Or let the system auto-decompose during `/sf:run`

---

## Philosophy

- **Spec-first** — Think before coding
- **Fresh audits** — Different context catches different issues
- **Soft blocking** — Warnings, not hard stops
- **Token-aware** — Specs sized for single sessions
- **Cost-conscious** — Model profiles for budget control
- **Decision trail** — Know why code exists

---

## License

MIT

---

<div align="center">

**Claude Code writes the code. SpecFlow makes sure it's the right code.**

</div>
