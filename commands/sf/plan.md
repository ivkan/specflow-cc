---
name: sf:plan
description: Convert a to-do item into a full specification
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<purpose>
Convert a to-do item from the backlog into a full specification. Reuses the spec-creator agent with the todo's context pre-filled. After creating the spec, removes the todo from the list.
</purpose>

<context>
@.specflow/todos/
@.specflow/PROJECT.md
@.specflow/STATE.md
@~/.claude/specflow-cc/agents/spec-creator.md
</context>

<arguments>
- `[ID or #]` — Optional. Either TODO-XXX ID or list number from `/sf:todos`. If omitted, shows todos and prompts for selection.
</arguments>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf:init` to start.
```
Exit.

## Step 2: Check for Todos

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo list --raw
```

**If empty output (no todos):**
```
No to-do items found.

Add ideas first with `/sf:todo "your idea"`.
```
Exit.

## Step 3: Determine Target Todo

Format detection is handled automatically by the CLI tool.

**If argument is a number (e.g., "1", "2"):**
Run `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo list` to get sorted array, pick the Nth item (1-indexed).

**If argument is TODO-XXX format:**
The target ID is known directly.

**If no argument:**
Run `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo list` and display todos, then prompt:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SELECT TODO TO CONVERT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| #  | ID       | Description              | Priority |
|----|----------|--------------------------|----------|
| 1  | TODO-001 | Add caching for API      | high     |
| 2  | TODO-003 | Refactor AuthService     | medium   |
| 3  | TODO-002 | Update documentation     | low      |

Enter number or ID to convert:
```

Use AskUserQuestion with options as todo items.

## Step 4: Extract Todo Details

Read `.specflow/todos/TODO-{XXX}.md` and parse frontmatter:
- ID (from frontmatter `id:`)
- Title (from frontmatter `title:`)
- Description (from `## Description` body section)
- Priority (from frontmatter `priority:`)
- Notes (from `## Notes` body section, if any)

**If todo file not found:**
```
Todo "{arg}" not found.

Use `/sf:todos` to see available items.
```
Exit.

## Step 5: Determine Model Profile

Check `.specflow/config.json` for model profile setting:

```bash
[ -f .specflow/config.json ] && cat .specflow/config.json | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "balanced"
```

**Profile Table:**

| Profile | spec-creator | spec-auditor | spec-splitter | discusser | spec-executor | spec-executor-orchestrator | spec-executor-worker | impl-reviewer | spec-reviser | researcher | codebase-scanner |
|---------|--------------|--------------|---------------|-----------|---------------|---------------------------|---------------------|---------------|--------------|------------|-----------------|
| max | opus | opus | opus | opus | opus | opus | opus | opus | opus | opus | opus |
| quality | opus | opus | opus | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet |
| balanced | opus | opus | opus | opus | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | sonnet | haiku | sonnet | haiku | haiku |

Use model for `spec-creator` from selected profile (default: balanced = opus).

## Step 6: Spawn Spec Creator Agent

Launch the spec-creator subagent with todo context:

```
Task(prompt="
<task_description>
{todo description}
</task_description>

<todo_context>
**From:** TODO-{XXX}
**Priority:** {priority}
**Notes:** {notes or 'None'}
</todo_context>

<project_context>
@.specflow/PROJECT.md
</project_context>

<current_state>
@.specflow/STATE.md
</current_state>

Create a specification following the spec-creator agent instructions.
Use the priority from the todo as the spec's initial priority.
", subagent_type="sf-spec-creator", model="{profile_model}", description="Create specification from todo")
```

## Step 7: Remove Todo File — CRITICAL

**This step is MANDATORY. Do NOT skip it after the agent returns.**

1. Delete the file `.specflow/todos/TODO-{XXX}.md`:

```bash
rm .specflow/todos/TODO-{XXX}.md
```

2. **Verify** the file no longer exists:

```bash
[ ! -f .specflow/todos/TODO-{XXX}.md ] && echo "DELETED" || echo "STILL_EXISTS"
```

**If STILL_EXISTS:** try deletion again and verify.

**Important:** Only remove after confirmed spec creation. No "Last updated" lines to update.

3. **Refresh INDEX.md** via the shared regen helper so the cache no longer references the removed file:

```bash
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex
```

This is mandatory — skipping it leaves INDEX.md listing a TODO that no longer exists on disk, which trips the `/sf:status` freshness check and breaks downstream consumers.

## Step 8: Display Result

**IMPORTANT:** Output the following directly as formatted text, NOT wrapped in a markdown code block:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 TODO CONVERTED TO SPECIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**From:** TODO-{XXX} — "{description}"
**To:** SPEC-{YYY} — "{title}"

**Type:** {feature|refactor|bugfix}
**Complexity:** {small|medium|large}
**Priority:** {priority} (inherited from todo)

### Assumptions Made

- {assumption 1}
- {assumption 2}

---

**Todo removed from backlog.**

## Next Step

`/sf:audit` — audit specification before implementation

Tip: `/clear` recommended — auditor needs fresh context

{If complexity is large:}

### Warning

Specification is large (>150k tokens estimated).
Consider `/sf:split SPEC-{YYY}` to decompose.
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Conversion

### Get Todo Details

Read `.specflow/todos/TODO-{XXX}.md` and parse frontmatter and body.

### Create Spec (same as /sf:new)

Use `/sf:new "{todo description}"` logic:
1. Generate SPEC-XXX ID
2. Create spec with todo context
3. Set priority from todo
4. Update STATE.md

### Remove Todo

Delete the file `.specflow/todos/TODO-{XXX}.md`, then refresh INDEX.md:

```bash
rm .specflow/todos/TODO-{XXX}.md
node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex
```

</fallback>

<success_criteria>
- [ ] Initialization verified
- [ ] TODOs checked via CLI tool (format-agnostic)
- [ ] Target todo identified (by ID or number)
- [ ] Todo file read and details extracted (frontmatter + body)
- [ ] Spec-creator agent spawned with context
- [ ] SPEC-XXX.md created
- [ ] Priority inherited from todo
- [ ] TODO-XXX.md file deleted (not edited — whole file removed)
- [ ] Deletion verified (file no longer exists)
- [ ] INDEX.md refreshed via `node ~/.claude/specflow-cc/bin/sf-tools.cjs todo reindex`
- [ ] Clear result with next step
</success_criteria>
