# SPEC: Goal-Backward Methodology

---
id: SPEC-GSD-A
parent: SPEC-GSD-IMPROVEMENTS
type: feature
status: done
priority: medium
complexity: medium
depends_on: []
created: 2026-01-24
---

> Add goal-backward analysis to specification creation and auditing, inspired by GSD's goal-backward methodology.

## Context

### Problem

Current spec creation jumps directly from task description to requirements without ensuring requirements actually achieve the goal. This leads to:
- Missing critical functionality
- Over-engineering non-essential parts
- Disconnected artifacts that don't work together

### GSD Approach

GSD uses **goal-backward derivation**:

```
Goal (outcome, not task)
    ↓
Observable Truths (3-7 user-visible behaviors)
    ↓
Required Artifacts (files that enable truths)
    ↓
Required Wiring (connections between artifacts)
    ↓
Key Links (critical/fragile connections)
```

## Requirements

### 1. Update Spec Template

Add Goal Analysis section to `templates/spec.md`:

```markdown
## Goal Analysis

### Goal Statement
{One sentence describing the outcome, not the task}

### Observable Truths
When this spec is complete, a user will observe:

1. {User-visible behavior 1}
2. {User-visible behavior 2}
3. {User-visible behavior 3}

### Required Artifacts
Files that must exist to enable observable truths:

| Artifact | Enables Truth # | Purpose |
|----------|-----------------|---------|
| src/auth/login.ts | 1, 2 | Login flow implementation |
| src/components/LoginForm.tsx | 1 | UI for login |

### Required Wiring
How artifacts connect:

| From | To | Connection Type |
|------|-----|-----------------|
| LoginForm.tsx | login.ts | Calls loginUser() |
| login.ts | /api/auth | HTTP POST |

### Key Links
Critical connections that must work correctly:

1. **{Link name}**: {Why it's critical}
   - Risk: {What could go wrong}
   - Verification: {How to verify it works}
```

### 2. Update Spec Creator Agent

Modify `agents/spec-creator.md` to:

1. **Prompt for goal statement first** (before requirements)
2. **Derive observable truths** from goal
3. **Map artifacts to truths** (ensure coverage)
4. **Identify wiring** between artifacts
5. **Flag key links** for careful implementation

Process addition (insert between existing Step 2: Analyze Task and Step 3: Critical Questions):

```markdown
## Step 2.5: Goal-Backward Analysis

After analyzing the task, before asking clarifying questions:

1. Ask: "What outcome does this achieve?" → Goal Statement
2. Ask: "What will a user observe when done?" → Observable Truths (3-7)
3. For each truth: "What files make this possible?" → Required Artifacts
4. For each artifact pair: "How do they connect?" → Required Wiring
5. Which connections are fragile/critical? → Key Links

Then derive requirements that ensure ALL truths are achievable.

**Note:** This analysis happens BEFORE Step 3 (Critical Questions) because goal clarity may reduce the need for clarifying questions.
```

### 3. Update Auditor Agent

Modify `agents/spec-auditor.md` to validate goal-backward analysis:

**New validation step (Step 3.7, after existing Step 3.5: Execution Scope Check):**

```markdown
## Step 3.7: Goal-Backward Validation

**Detection:** Check if Goal Analysis section exists in the spec.

**Handling missing section:**
- If complexity is "small": Skip validation, no warning
- If complexity is "medium" or "large" AND section is missing: Add warning "Goal Analysis section recommended for medium/large specs"
- If Goal Analysis section is present: Proceed with validation

**Handling partial section:**
- If Goal Analysis exists but is missing subsections: Add warning for each missing subsection
- Required subsections: Goal Statement, Observable Truths, Required Artifacts, Required Wiring, Key Links
- Format: "Goal Analysis incomplete: missing {subsection name}"

**Validation (if section exists):**

1. **Truth Coverage**: Every observable truth has ≥1 artifact
2. **Artifact Purpose**: Every artifact maps to ≥1 truth
3. **Wiring Completeness**: Artifacts that interact are wired
4. **Key Links Identified**: Critical paths are flagged

| Check | Status | Issue |
|-------|--------|-------|
| Truth 1 has artifacts | ✓/✗ | {missing artifact} |
| Artifact X has purpose | ✓/✗ | {orphan artifact} |
| A→B wiring defined | ✓/✗ | {missing connection} |
```

**Scoring:**
- Missing truth coverage → Critical issue
- Orphan artifact → Warning (may be over-engineering)
- Missing wiring → Critical issue (integration will fail)
- No key links identified → Warning (risks not assessed)
- Missing Goal Analysis on medium/large spec → Warning
- Partial Goal Analysis → Warning per missing subsection

### 4. Link to Implementation Tasks

When generating Implementation Tasks, use goal-backward analysis:

```markdown
## Implementation Tasks

| Group | Wave | Tasks | Enables Truths | Dependencies | Est. Context |
|-------|------|-------|----------------|--------------|--------------|
| G1 | 1 | Create login.ts | 1, 2 | — | ~15% |
| G2 | 2 | Create LoginForm.tsx | 1 | G1 | ~10% |
| G3 | 2 | Wire API endpoint | 1, 2 | G1 | ~10% |
| G4 | 3 | Verify key links | 1, 2 | G2, G3 | ~5% |
```

**Task grouping rules:**
- Group artifacts that enable same truths
- Order by dependency (wiring direction)
- **Key links get dedicated verification task groups** (see G4 above)

**Key link verification tasks:**
- Each key link identified in Goal Analysis generates a verification task
- Verification tasks appear in the final wave (after all artifacts created)
- Task description: "Verify {link name}: {verification method from Key Links section}"

## Files to Create

None

## Files to Modify

| File | Changes |
|------|---------|
| `templates/spec.md` | Add Goal Analysis section |
| `agents/spec-creator.md` | Add goal-backward derivation process (Step 2.5, between Analyze Task and Critical Questions) |
| `agents/spec-auditor.md` | Add goal-backward validation step (Step 3.7, after Execution Scope Check) |

## Acceptance Criteria

1. **Spec template has Goal Analysis section** with all 5 subsections
2. **Spec creator prompts for goal** before requirements (in Step 2.5, after task analysis but before clarifying questions)
3. **Spec creator derives truths** from stated goal
4. **Auditor validates truth coverage** (every truth has artifacts)
5. **Auditor validates wiring** (connected artifacts are wired)
6. **Auditor flags orphan artifacts** as potential over-engineering
7. **Key links generate verification task groups** in Implementation Tasks table with format: Group in final wave, "Verify {link name}" task description, depends on artifact groups

## Constraints

- Goal Analysis is OPTIONAL for small specs (complexity: small)
- Existing specs without Goal Analysis should still pass audit (with warning for medium/large specs)
- Goal statement must be user-outcome focused, not implementation-focused
- Specs with partial Goal Analysis receive warnings for each missing subsection

## Examples

### Good Goal Statement
"Users can log in with email/password and stay authenticated across sessions"

### Bad Goal Statement
"Implement JWT authentication with refresh tokens" (implementation detail, not outcome)

### Observable Truths Example
1. User sees login form on /login page
2. User enters credentials and clicks "Log in"
3. On success, user is redirected to dashboard
4. User remains logged in after page refresh
5. User can log out from any page

---

## Audit History

### Audit v1 (2026-01-24)
**Status:** NEEDS_REVISION

**Context Estimate:** ~40% total

**Critical:**
1. **Acceptance criterion 7 is vague.** "Key links map to verification tasks in Implementation Tasks" does not specify WHERE this mapping appears (in the spec? auditor output? executor?), WHAT format it takes, or HOW to verify it. The Implementation Tasks table in Requirement 4 shows an "Enables Truths" column but no "Verification" column for key links. Either add explicit acceptance criteria for the Implementation Tasks table format, or clarify what "map to verification tasks" means.

2. **Auditor step numbering conflict.** The spec proposes "Step 3.6: Goal-Backward Validation" but the existing auditor has "Step 3.5: Execution Scope Check". Either use Step 3.7 for Goal-Backward Validation, or explicitly state that Execution Scope Check should be renumbered to Step 3.6 and Goal-Backward becomes Step 3.5 (before scope check).

**Recommendations:**
3. Clarify behavior for partial Goal Analysis. What happens if a spec has only 2 of 5 subsections? Consider: "Specs with partial Goal Analysis receive warnings for each missing subsection."

4. Add explicit detection logic to auditor for presence/absence of Goal Analysis section. The constraint says it is "OPTIONAL for small specs" but the auditor validation step does not describe how to handle missing sections.

5. Confirm Step 2.5 placement in creator process is between existing Step 2 (Analyze Task) and Step 3 (Critical Questions) -- this affects whether goal analysis happens before or after clarifying questions with user.

### Response v1 (2026-01-24 09:45)
**Applied:** All 5 items (2 critical + 3 recommendations)

**Changes:**
1. [x] Acceptance criterion 7 clarified — Rewrote to specify: key links generate verification task groups in Implementation Tasks table, appearing in final wave with "Verify {link name}" format. Added G4 example row to Requirement 4 table showing verification task.

2. [x] Auditor step numbering fixed — Changed from "Step 3.6" to "Step 3.7: Goal-Backward Validation" to follow existing Step 3.5: Execution Scope Check.

3. [x] Partial Goal Analysis behavior clarified — Added to Requirement 3 auditor section: "If Goal Analysis exists but is missing subsections: Add warning for each missing subsection." Also added to Constraints: "Specs with partial Goal Analysis receive warnings for each missing subsection."

4. [x] Detection logic added to auditor — Added explicit "Detection" and "Handling missing section" subsections to Step 3.7 describing: check if section exists, skip for small specs, warn for medium/large specs.

5. [x] Step 2.5 placement confirmed — Clarified in Requirement 2 that Step 2.5 is "between existing Step 2: Analyze Task and Step 3: Critical Questions" with note explaining goal analysis happens BEFORE clarifying questions. Updated acceptance criterion 2 to include "(in Step 2.5, after task analysis but before clarifying questions)".

### Audit v2 (2026-01-24)
**Status:** APPROVED

**Context Estimate:** ~23% total

| Metric | Est. Context | Target | Status |
|--------|--------------|--------|--------|
| Total spec context | ~23% | <=50% | OK |
| Largest task group | ~8% | <=30% | OK |
| Worker overhead | ~5% | <=10% | OK |

**Quality Projection:** PEAK range (0-30%)

**Comment:** Specification is well-structured and complete. All critical issues from v1 have been thoroughly addressed. Requirements are specific with concrete markdown examples. Acceptance criteria are measurable and verifiable. The 3-file modification scope with ~23% context estimate is well within target range. Ready for implementation.

---

## Execution Summary

**Executed:** 2026-01-24
**Commits:** 3

### Files Modified

- `templates/spec.md` — Added Goal Analysis section with all 5 subsections (Goal Statement, Observable Truths, Required Artifacts, Required Wiring, Key Links)
- `agents/spec-creator.md` — Added Step 2.5: Goal-Backward Analysis between Analyze Task and Critical Questions
- `agents/spec-auditor.md` — Added Step 3.7: Goal-Backward Validation after Execution Scope Check; Added Step 4.4: Link to Goal Analysis for Implementation Tasks

### Acceptance Criteria Status

- [x] **Criterion 1:** Spec template has Goal Analysis section with all 5 subsections
- [x] **Criterion 2:** Spec creator prompts for goal in Step 2.5 (after task analysis, before clarifying questions)
- [x] **Criterion 3:** Spec creator derives truths from stated goal (5-step process defined)
- [x] **Criterion 4:** Auditor validates truth coverage (every truth has artifacts)
- [x] **Criterion 5:** Auditor validates wiring (connected artifacts are wired)
- [x] **Criterion 6:** Auditor flags orphan artifacts as potential over-engineering
- [x] **Criterion 7:** Key links generate verification task groups in final wave with "Verify {link name}" format

### Deviations

None. Implementation followed specification exactly.

### Notes

- Added skip conditions to spec-creator for small complexity specs
- Added Step 4.4 to auditor for linking Implementation Tasks to Goal Analysis (enhances table format with "Enables Truths" column when Goal Analysis present)

---

## Review History

### Review v1 (2026-01-24)
**Result:** APPROVED
**Reviewer:** impl-reviewer (subagent)

**Findings:**

**Passed:**
- [x] **Criterion 1:** Spec template has Goal Analysis section with all 5 subsections (Goal Statement at line 24-25, Observable Truths at lines 27-32, Required Artifacts at lines 34-40, Required Wiring at lines 42-49, Key Links at lines 51-55)
- [x] **Criterion 2:** Spec creator Step 2.5 is correctly placed between Step 2 (Analyze Task) and Step 3 (Critical Questions) with explicit note about ordering
- [x] **Criterion 3:** Spec creator derives truths via 5-step process (lines 67-71): Goal Statement -> Observable Truths -> Required Artifacts -> Required Wiring -> Key Links
- [x] **Criterion 4:** Auditor validates truth coverage at line 284: "Every observable truth has >=1 artifact" with Critical issue scoring
- [x] **Criterion 5:** Auditor validates wiring at line 286: "Artifacts that interact are wired" with Critical issue scoring
- [x] **Criterion 6:** Auditor flags orphan artifacts at line 285/297: "Every artifact maps to >=1 truth" as Warning (may be over-engineering)
- [x] **Criterion 7:** Key link verification tasks implemented in Step 4.4 (lines 329-353) with: final wave placement, "Verify {link name}" format, artifact group dependencies

**Constraint Compliance:**
- [x] Goal Analysis optional for small specs (spec-creator lines 77-79, spec-auditor lines 272-273)
- [x] Missing Goal Analysis on medium/large specs generates warning (spec-auditor lines 274-275)
- [x] Partial Goal Analysis generates per-subsection warnings (spec-auditor lines 277-280)

**Code Quality:**
- [x] All additions follow existing step-numbering conventions
- [x] Clear documentation with concrete examples
- [x] Natural integration with existing agent processes
- [x] No security concerns (markdown template and agent instructions only)
- [x] No duplication of existing functionality

**Summary:** Implementation fully complies with all 7 acceptance criteria and all 4 constraints. The three modified files contain all required additions with correct step numbering, proper placement, and comprehensive validation logic. Code quality is high with clear documentation and natural integration into existing agent processes.

---

## Completion

**Completed:** 2026-01-24
**Total Commits:** 3
**Audit Cycles:** 2
**Review Cycles:** 1
