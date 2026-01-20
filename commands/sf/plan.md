---
name: sf:plan
description: Convert a to-do item into a full specification
allowed-tools:
  - Read
  - Write
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
@.specflow/todos/TODO.md
@.specflow/PROJECT.md
@.specflow/STATE.md
@~/.claude/specflow-cc/agents/spec-creator.md
</context>

<arguments>
- `[ID or #]` — Optional. Either TODO-XXX ID or list number from `/sf todos`. If omitted, shows todos and prompts for selection.
</arguments>

<workflow>

## Step 1: Verify Initialization

```bash
[ -d .specflow ] && echo "OK" || echo "NOT_INITIALIZED"
```

**If NOT_INITIALIZED:**
```
SpecFlow not initialized.

Run `/sf init` to start.
```
Exit.

## Step 2: Check for Todos

```bash
[ -f .specflow/todos/TODO.md ] && echo "EXISTS" || echo "NO_TODOS"
```

**If NO_TODOS:**
```
No to-do items found.

Add ideas first with `/sf todo "your idea"`.
```
Exit.

## Step 3: Determine Target Todo

**If argument is a number (e.g., "1", "2"):**
Parse TODO.md, sort by priority, and select the Nth item.

**If argument is TODO-XXX format:**
Find todo with matching ID.

**If no argument:**
Display todos and prompt:

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

Read the selected todo:
- ID
- Description
- Priority
- Notes (if any)

**If todo not found:**
```
Todo "{arg}" not found.

Use `/sf todos` to see available items.
```
Exit.

## Step 5: Spawn Spec Creator Agent

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
", subagent_type="sf-spec-creator", description="Create specification from todo")
```

## Step 6: Remove Todo from List

After spec is successfully created, remove the todo entry from TODO.md.

Update `*Last updated:` timestamp.

**Important:** Only remove after confirmed spec creation.

## Step 7: Display Result

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

`/sf audit` — audit specification before implementation

{If complexity is large:}

### Warning

Specification is large (>150k tokens estimated).
Consider `/sf split SPEC-{YYY}` to decompose.
```

</workflow>

<fallback>

**If agent spawning fails**, execute inline:

## Inline Conversion

### Get Todo Details

Read from TODO.md.

### Create Spec (same as /sf new)

Use `/sf new "{todo description}"` logic:
1. Generate SPEC-XXX ID
2. Create spec with todo context
3. Set priority from todo
4. Update STATE.md

### Remove Todo

Delete todo block from TODO.md.

</fallback>

<success_criteria>
- [ ] Initialization verified
- [ ] TODO.md exists and has items
- [ ] Target todo identified (by ID or number)
- [ ] Todo details extracted
- [ ] Spec-creator agent spawned with context
- [ ] SPEC-XXX.md created
- [ ] Priority inherited from todo
- [ ] Todo removed from TODO.md
- [ ] Clear result with next step
</success_criteria>
