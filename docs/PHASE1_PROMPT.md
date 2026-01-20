Task: SpecFlow Implementation — Phase 1 (Core)  
Context  
Project: SpecFlow — spec-driven development system for Claude Code  
Directory: ~/Projects/specflow-cc  
Specification: docs/DESIGN.md  
Repository: https://github.com/ivkan/specflow-cc  
Reference  
GSD (for pattern borrowing): `/Users/koristuvac/Projects/dev/get-shit-done`  
What to study:  
`bin/install.js` — installation mechanism (already adapted)  
`commands/*.md` — slash command format for Claude Code  
`agents/*.md` — agent format (subagent prompts)  
`hooks/statusline.js` — statusline integration  
Important: DO NOT copy GSD, but adapt to SpecFlow philosophy:  
Audit-driven (not verification-driven)  
Lean process (fewer phases)  
Human gate (warnings, not hard blocks)  

Phase 1: Core Commands  
Goal  
Implement a minimal working workflow:  
- Project initialization  
- Specification creation  
- Specification audit  
- Status viewing  

Commands to implement  
1. `/sf init`  
File: `commands/sf/init.md`  
Functionality:  
- Create `.specflow/` directory  
- Analyze codebase (tech stack, patterns, structure)  
- Create `PROJECT.md` with project overview  
- Create `STATE.md` with initial state  
- Create `config.json` with default settings  
Templates needed:  
- `templates/project.md`  
- `templates/state.md`  

2. `/sf new [description]`  
File: `commands/sf/new.md`  
Functionality:  
- Accept task description  
- Ask critical questions (if needed)  
- Create `SPEC-XXX.md` in `.specflow/specs/`  
- Estimate complexity (small/medium/large)  
- Update `STATE.md`  
Agent needed:  
- `agents/spec-creator.md`  
Template needed:  
- `templates/spec.md`  

3. `/sf audit`  
File: `commands/sf/audit.md`  
Functionality:  
- Read active specification  
- Launch subagent for audit (fresh context)  
- Record result in specification (Audit History)  
- Update status in `STATE.md`  
- Output result with next step  
Agent needed:  
- `agents/spec-auditor.md`  

4. `/sf status`  
File: `commands/sf/status.md`  
Functionality:  
- Read `STATE.md`  
- Show current position  
- Show recommended next step  
- Show specification queue  

Implementation Requirements  
Command format (study GSD)  
# Command: /sf init  

<purpose>  
[Command description]  
</purpose>  

<workflow>  
[Execution steps]  
</workflow>  

<context>  
@.specflow/STATE.md (if exists)  
</context>  

...  

Agent format (study GSD)  
# Agent: spec-creator  

<role>  
[Agent role]  
</role>  

<instructions>  
[Detailed instructions]  
</instructions>  

<output>  
[Output format]  
</output>  

Atomic commits  
One commit per completed unit of work  
Format: `feat(sf): add /sf init command`  

Testing  
After implementing each command — test manually  
Ensure the command works in Claude Code  

Implementation Order  
Templates (`templates/`)  
- `project.md`  
- `state.md`  
- `spec.md`  

Agents (`agents/`)  
- `spec-creator.md`  
- `spec-auditor.md`  

Commands (`commands/sf/`)  
- `init.md`  
- `new.md`  
- `audit.md`  
- `status.md`  

Testing  
- Initialize a test project  
- Create a specification  
- Perform an audit  
- Check status  

Phase 1 Completion Criteria  
[ ] `/sf init` creates `.specflow/` with PROJECT.md, STATE.md, config.json  
[ ] `/sf new "description"` creates SPEC-XXX.md  
[ ] `/sf audit` performs audit and records result  
[ ] `/sf status` displays current state  
[ ] All commands work in Claude Code  
[ ] Code is committed and pushed  

After completion  
Report readiness for Phase 2:  
- `/sf revise`  
- `/sf run`  
- `/sf review`  
- `/sf fix`  
- `/sf done`  