---
name: sf:scan
description: Deep codebase analysis — identifies concerns, tech debt, and improvement opportunities
argument-hint: "[--focus=concerns|quality|arch|all]"
---

<purpose>
Perform deep analysis of the codebase to identify technical debt, code quality issues, architectural problems, and improvement opportunities. Results are saved to `.specflow/SCAN.md` for use in creating specifications.
</purpose>

<context>
@.specflow/PROJECT.md
@.specflow/STATE.md
@~/.claude/specflow-cc/templates/scan.md
@~/.claude/specflow-cc/agents/codebase-scanner.md
</context>

<workflow>

## 1. Parse Arguments

```
FOCUS = $ARGUMENTS or "all"
```

Valid focus areas:
- `concerns` — Technical debt, bugs, security issues
- `quality` — Code quality, conventions, test coverage
- `arch` — Architecture, structure, patterns
- `all` — Full analysis (default)

## 2. Check Prerequisites

```bash
[ -d .specflow ] && echo "INITIALIZED" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
⚠️  Project not initialized

Run /sf:init first to set up SpecFlow.
```
STOP.

## 3. Check Existing Scan

```bash
[ -f .specflow/SCAN.md ] && echo "EXISTS" || echo "NEW"
```

**If EXISTS:**
Ask user:
```
📊 Previous scan found (.specflow/SCAN.md)

Options:
1) Refresh — Run new scan (overwrites existing)
2) View — Show existing scan results
3) Cancel

Choice?
```

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

Use model for `codebase-scanner` from selected profile (default: balanced = sonnet).

## 5. Launch Scanner Agent

Use the Task tool to spawn codebase-scanner agent:

```
Task(prompt="
Focus: {FOCUS}
Project: {from PROJECT.md}

Scan the codebase and write findings to .specflow/SCAN.md

Return only confirmation when done.
", subagent_type="sf-codebase-scanner", model="{profile_model}", description="Scan codebase")
```

## 6. Verify Results

After agent completes:

```bash
[ -f .specflow/SCAN.md ] && wc -l .specflow/SCAN.md
```

## 7. Display Summary

Read `.specflow/SCAN.md` and extract summary:

```
📊 Codebase Scan Complete

Focus: {FOCUS}
Lines analyzed: ~{estimate}

┌─────────────────────────────────────────────┐
│ Summary                                      │
├─────────────────────────────────────────────┤
│ Tech Debt:        {count} issues            │
│ Quality Issues:   {count} findings          │
│ Security:         {count} considerations    │
│ Test Gaps:        {count} areas             │
└─────────────────────────────────────────────┘

Top Priority Issues:
1. {issue 1}
2. {issue 2}
3. {issue 3}

📁 Full report: .specflow/SCAN.md

Next steps:
• /sf:triage — Review findings and create TODOs
• /sf:new "Fix: {top concern}" — Create spec for top issue
• /sf:todo {concern} — Add single item to backlog
```

</workflow>

<fallback>
If agent cannot be spawned, perform scan directly:

1. Explore codebase structure
2. Search for TODO/FIXME comments
3. Identify large/complex files
4. Check test coverage gaps
5. Look for code smells
6. Write findings to `.specflow/SCAN.md`
</fallback>

<output_format>
**Success:**
```
📊 Codebase Scan Complete

[Summary table]
[Top issues]
[Next steps]
```

**No issues found:**
```
✅ Codebase scan complete — no critical concerns found

Minor observations saved to .specflow/SCAN.md
```

**Error:**
```
❌ Scan failed: {reason}

Try running manually or check .specflow/ permissions.
```
</output_format>

<success_criteria>
- [ ] Focus area parsed correctly
- [ ] Scanner agent spawned (or fallback executed)
- [ ] .specflow/SCAN.md created with findings
- [ ] Summary displayed to user
- [ ] Next steps provided
</success_criteria>
