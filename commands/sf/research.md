---
name: sf:research
description: Research a topic and save findings for future specification context
argument-hint: "[topic]"
---

<purpose>
Research a topic, technology, or implementation approach. Saves structured findings to `.specflow/research/RES-XXX.md` for use as context when creating specifications.
</purpose>

<context>
@.specflow/PROJECT.md
@.specflow/STATE.md
@~/.claude/specflow-cc/templates/research.md
@~/.claude/specflow-cc/agents/researcher.md
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

## 2. Ensure Research Directory

```bash
mkdir -p .specflow/research
```

## 3. Parse Arguments

Extract research topic from command arguments.

**If no topic provided:**
Use AskUserQuestion:
- header: "Topic"
- question: "What do you want to research?"
- options: (freeform text input)

## 4. Determine Model Profile

Check `.specflow/config.json` for model profile setting:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "balanced"
```

**Profile Table:**

| Profile | spec-creator | spec-auditor | spec-splitter | discusser | spec-executor | spec-executor-orchestrator | spec-executor-worker | impl-reviewer | spec-reviser | researcher | codebase-scanner |
|---------|--------------|--------------|---------------|-----------|---------------|---------------------------|---------------------|---------------|--------------|------------|-----------------|
| quality | opus | opus | opus | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet |
| balanced | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | haiku | sonnet | haiku | haiku |

Use model for `researcher` from selected profile (default: balanced = sonnet).

## 5. Spawn Researcher Agent

Launch the researcher subagent:

```
Task(prompt="
<research_topic>
{user's topic}
</research_topic>

<project_context>
@.specflow/PROJECT.md
</project_context>

Research this topic and create a structured findings document.
", subagent_type="sf-researcher", model="{profile_model}", description="Research topic")
```

## 6. Handle Agent Response

The agent will:
1. Research the topic (codebase exploration, web search if needed)
2. Create RES-XXX.md with findings
3. Return structured result with ID and summary

## 7. Display Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RESEARCH COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ID:** RES-XXX
**Topic:** [topic]
**Created:** [date]

### Summary

[Brief 2-3 sentence summary of findings]

### Key Findings

- [Finding 1]
- [Finding 2]
- [Finding 3]

---

📄 **File:** `.specflow/research/RES-XXX.md`

---

## Use in Specification

To use this research when creating a specification:

```
/sf:new --research RES-XXX "your task description"
```

Or reference directly:
```
/sf:new "implement OAuth (see RES-XXX)"
```
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Research

### Get Next Research Number

```bash
LAST=$(ls .specflow/research/RES-*.md 2>/dev/null | sort -V | tail -1 | grep -oP 'RES-\K\d+')
NEXT=$(printf "%03d" $((${LAST:-0} + 1)))
echo "RES-$NEXT"
```

### Research Topic

1. Search codebase for related code
2. Check existing patterns
3. Use WebSearch for external context if needed
4. Identify options, trade-offs, and recommendations

### Write Research Document

Create `.specflow/research/RES-XXX.md` with:
- Frontmatter (id, topic, created)
- Summary
- Background (why this matters)
- Options explored
- Trade-offs analysis
- Codebase findings
- Recommendations
- References

</fallback>

<success_criteria>
- [ ] SpecFlow initialization verified
- [ ] Research topic obtained
- [ ] RES-XXX.md created with structured findings
- [ ] User knows how to use research in /sf:new
</success_criteria>
