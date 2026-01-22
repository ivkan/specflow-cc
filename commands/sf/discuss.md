---
name: sf:discuss
description: Interactive Q&A to clarify requirements or resolve specification ambiguities
argument-hint: "[SPEC-XXX | topic]"
---

<purpose>
Conduct an interactive discussion to clarify requirements, resolve ambiguities, or gather additional context. Results are saved and can be used when creating or revising specifications.

Use cases:
- Before `/sf:new`: Clarify requirements before creating a spec
- After `/sf:new`: Discuss assumptions made in the spec
- After `/sf:audit`: Resolve issues that need user decision
</purpose>

<context>
@.specflow/PROJECT.md
@.specflow/STATE.md
@~/.claude/specflow-cc/agents/discusser.md
</context>

<workflow>

## 1. Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf:init` first.
```
Exit.

## 2. Parse Arguments

Determine discussion mode from arguments:

**Case A: `SPEC-XXX` provided**
- Load the specification
- Discussion focuses on clarifying that spec
- Mode: `spec-clarification`

**Case B: Topic string provided (not SPEC-XXX)**
- Discussion about requirements before spec creation
- Mode: `requirements-gathering`

**Case C: No arguments**
- Check STATE.md for active spec
- If active spec exists: discuss that spec
- If no active spec: ask what to discuss

## 3. Load Context

**For spec-clarification mode:**
```bash
[ -f .specflow/specs/SPEC-XXX.md ] && echo "FOUND" || echo "NOT_FOUND"
```

Read the spec and any associated audit comments.

**For requirements-gathering mode:**
- Load PROJECT.md for context
- Check for related research in `.specflow/research/`

## 4. Spawn Discusser Agent

Launch the discusser agent:

```
Task(prompt="
<mode>{mode}</mode>

<topic_or_spec>
{spec content or topic description}
</topic_or_spec>

<project_context>
@.specflow/PROJECT.md
</project_context>

{If spec mode and audit exists:}
<audit_context>
@.specflow/audits/SPEC-XXX-audit.md
</audit_context>

Conduct an interactive discussion to clarify requirements.
Ask focused questions with clear options when possible.
", subagent_type="sf-discusser", description="Discuss requirements")
```

## 5. Handle Discussion Results

The agent will:
1. Ask 3-7 focused questions with options
2. Document decisions and clarifications
3. Save results to `.specflow/discussions/`

## 6. Save Discussion

**For spec-clarification:**
Append to spec file or create discussion record:
```
.specflow/discussions/SPEC-XXX-discuss.md
```

**For requirements-gathering:**
Create discussion record:
```
.specflow/discussions/DISC-XXX-{topic-slug}.md
```

## 7. Display Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DISCUSSION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Topic:** [topic or SPEC-XXX]
**Questions Asked:** [count]
**Decisions Made:** [count]

### Key Decisions

1. [Decision 1]
2. [Decision 2]
3. [Decision 3]

---

📄 **File:** `.specflow/discussions/{filename}.md`

---

## Next Step

{If requirements-gathering mode:}
`/sf:new --discuss DISC-XXX "task"` — create spec with discussion context

{If spec-clarification mode:}
`/sf:revise` — apply clarifications to specification

{If from audit:}
`/sf:revise` — revise spec with clarified requirements
```

</workflow>

<fallback>

**If agent spawning fails**, conduct discussion inline:

1. Read spec or topic context
2. Identify 3-5 key ambiguities or decisions needed
3. Use AskUserQuestion for each:
   - Provide clear options (2-4 choices)
   - Include "Other" for custom input
4. Document all decisions
5. Save to discussion file

</fallback>

<success_criteria>
- [ ] Discussion mode determined correctly
- [ ] Relevant context loaded (spec, audit, project)
- [ ] Focused questions asked with clear options
- [ ] Decisions documented
- [ ] Discussion file saved
- [ ] User knows next step
</success_criteria>
