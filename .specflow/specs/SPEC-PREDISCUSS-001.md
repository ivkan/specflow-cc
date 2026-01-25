# SPEC: Pre-Specification Discussion Mode

---
id: SPEC-PREDISCUSS-001
type: feature
status: draft
priority: medium
complexity: medium
created: 2026-01-25
---

> Extend `/sf:discuss` with a pre-specification mode that identifies "gray areas" based on feature type before spec creation.

## Context

### Problem Statement

Currently, `/sf:discuss` operates in three modes:
1. **spec-clarification** — discuss an existing SPEC-XXX
2. **requirements-gathering** — generic topic discussion
3. **direct-question** — single question/answer

Missing: **Structured pre-specification discussion** that systematically identifies gray areas based on feature type (visual, API, CLI, data, etc.).

### GSD Pattern

GSD uses `/gsd:discuss-phase` BEFORE planning:
- Identifies "gray areas" specific to feature type
- Visual features: layout, density, interactions, empty states
- API/CLI features: response format, flags, error handling
- Results saved and used by planner

### The Gap

| Aspect | GSD | SpecFlow Current |
|--------|-----|------------------|
| Pre-spec structured discussion | Yes | No |
| Feature-type-specific questions | Yes | Generic |
| Discussion -> Spec integration | Automatic | Manual |
| Gray area checklists | Yes | No |

## Goal Analysis

### Goal Statement

User can conduct a structured, feature-type-aware discussion BEFORE creating a spec, with results automatically loaded when `/sf:new` runs.

### Observable Truths

When this spec is complete, a user will observe:

1. Running `/sf:discuss --pre "add export feature"` starts a structured discussion with feature-type-specific questions
2. Discussion identifies feature type (visual/API/CLI/data) and asks relevant gray-area questions
3. Results saved to `.specflow/discussions/PRE-XXX.md` with structured decisions
4. Running `/sf:new --context PRE-XXX "add export feature"` loads the discussion context
5. Created spec includes "Prior Discussion" section referencing PRE-XXX
6. Spec creator uses discussion decisions to make fewer assumptions

### Required Artifacts

| Artifact | Enables Truth # | Purpose |
|----------|-----------------|---------|
| `commands/sf/discuss.md` (modify) | 1, 2, 3 | Add `--pre` mode |
| `agents/discusser.md` (modify) | 2 | Add feature-type question banks |
| `commands/sf/new.md` (modify) | 4, 5, 6 | Add `--context PRE-XXX` flag |
| `agents/spec-creator.md` (modify) | 6 | Use discussion context |

### Required Wiring

| From | To | Connection Type |
|------|-----|-----------------|
| discuss.md | PRE-XXX.md | Creates file |
| new.md | PRE-XXX.md | Reads file (via --context) |
| spec-creator.md | PRE-XXX.md | Incorporates decisions |

### Key Links

1. **Feature Type Detection**: Determining the correct feature type from topic description
   - Risk: Misclassification leads to wrong questions
   - Mitigation: Allow user to override detected type

2. **PRE-XXX to SPEC-XXX Linking**: Discussion context flows to spec
   - Risk: Context not loaded or ignored
   - Verification: Spec shows "Prior Discussion: PRE-XXX" in Context section

## Requirements

### New Discussion Mode: `pre-spec`

Add `--pre` flag to `/sf:discuss`:

```
/sf:discuss --pre "topic description"
```

Behavior:
1. Detect feature type from description
2. Load feature-type-specific question bank
3. Ask 5-10 targeted questions
4. Save results to `.specflow/discussions/PRE-XXX.md`

### Feature Type Detection

| Keyword Patterns | Feature Type | Question Focus |
|------------------|--------------|----------------|
| UI, component, page, form, modal, layout | visual | Layout, spacing, states, interactions |
| API, endpoint, route, REST, GraphQL | api | Response format, status codes, validation |
| command, CLI, flag, argument | cli | Flags, output format, error messages |
| migration, transform, process | data | Rollback, validation, idempotency |
| refactor, restructure, extract | refactor | Scope boundaries, backward compat |

### Feature-Type Question Banks

#### Visual Features

| Category | Questions |
|----------|-----------|
| Layout | How should content be arranged? (list/grid/tabs) |
| Density | How many items visible without scrolling? |
| Empty States | What shows when no data? |
| Loading | Skeleton, spinner, or progressive? |
| Interactions | Hover effects, click feedback? |
| Responsive | Mobile behavior? |

#### API Features

| Category | Questions |
|----------|-----------|
| Response Format | JSON structure? Pagination style? |
| Status Codes | Which codes for which scenarios? |
| Validation | Client-side, server-side, or both? |
| Error Format | Error response structure? |
| Auth | Token type, refresh strategy? |
| Rate Limiting | Limits and response when exceeded? |

#### CLI Features

| Category | Questions |
|----------|-----------|
| Flags | Required vs optional? Short forms? |
| Output Format | Human-readable, JSON, or both? |
| Progress | Progress bars for long operations? |
| Errors | stderr format, exit codes? |
| Confirmation | Destructive ops need confirmation? |
| Config | File-based config support? |

#### Data/Refactor Features

| Category | Questions |
|----------|-----------|
| Rollback | How to undo if something fails? |
| Validation | How to verify data integrity? |
| Idempotency | Safe to run multiple times? |
| Scope | What's explicitly out of scope? |
| Dependencies | What other systems affected? |

### PRE-XXX File Format

```markdown
---
id: PRE-XXX
topic: [topic description]
feature_type: [visual | api | cli | data | refactor | general]
created: YYYY-MM-DD
used_by: null  # Updated when /sf:new uses this
---

# Pre-Spec Discussion: [Topic]

## Feature Type

**Detected:** [type]
**Confirmed:** [yes/no — user can override]

## Decisions

### Layout & Display
- **Arrangement:** Grid layout with 3 columns
- **Density:** 12 items per page

### Interactions
- **Click behavior:** Opens detail modal
- **Hover:** Shows quick-action buttons

### Edge Cases
- **Empty state:** "No items yet" with add button
- **Error state:** Inline error with retry button

## Summary

[2-3 sentences summarizing key decisions]

## Next Step

`/sf:new --context PRE-XXX "topic"` — create spec with this context
```

### Integration with /sf:new

Add `--context PRE-XXX` flag:

```
/sf:new --context PRE-001 "add export feature"
```

Behavior:
1. Load `.specflow/discussions/PRE-001.md`
2. Pass to spec-creator as `<prior_discussion>` context
3. Spec includes "Prior Discussion: PRE-001" reference
4. Update PRE-XXX.md `used_by` field with SPEC-XXX

### Spec Creator Integration

When `<prior_discussion>` provided:

1. Do NOT re-ask questions already decided in discussion
2. Include decisions as facts (not assumptions)
3. Add to Context section:
   ```markdown
   ### Prior Discussion

   This spec incorporates decisions from [PRE-XXX](../discussions/PRE-XXX.md):
   - Layout: Grid with 3 columns
   - Empty state: "No items" message
   - [etc.]
   ```

## Acceptance Criteria

1. `/sf:discuss --pre "topic"` enters pre-spec discussion mode
2. Feature type auto-detected from topic (with user override option)
3. Questions drawn from feature-type-specific bank (5-10 questions)
4. Results saved to `.specflow/discussions/PRE-XXX.md` with correct format
5. `/sf:new --context PRE-XXX "topic"` loads discussion context
6. Created spec shows "Prior Discussion" section with link
7. Spec creator skips questions already answered in PRE-XXX
8. PRE-XXX.md updated with `used_by: SPEC-XXX` after spec creation

## Constraints

- DO NOT modify existing `requirements-gathering` mode behavior
- DO NOT make --pre or --context mandatory (both are optional)
- DO NOT break backward compatibility with existing /sf:discuss or /sf:new
- Question banks are extensible (agent can add project-specific questions)
- Keep discussion to 5-10 questions max (not exhaustive)

## Assumptions

- Users will provide topic descriptions descriptive enough for type detection
- Feature type detection errors are recoverable via user override
- Discussion files will be small enough for spec-creator context
- Single language (English) for question banks (can extend later)

---

## Audit History

<!-- Filled by /sf:audit -->
