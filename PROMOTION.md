# SpecFlow Promotion Content

Ready-to-use texts for launching SpecFlow. Adjust tone to match your voice.

---

## 1. Hacker News

### Title Options (pick one):

- `Show HN: SpecFlow – I added a "Bad Cop" auditor to Claude Code`
- `Show HN: SpecFlow – Fresh context audits for Claude Code specs`
- `Show HN: Stop debugging AI code, start reviewing specifications`

### First Comment:

```
Hey HN,

I've been using Claude Code heavily, but kept running into two problems:

1. "Context rot" — quality degrades as the context window fills
2. "Yes-man syndrome" — the AI agrees to everything and writes buggy code

I built SpecFlow to fix this by enforcing a strict workflow: Spec → Audit → Implement → Review.

The key mechanism is Fresh Context Auditing. Instead of letting the same agent critique its own plan, SpecFlow spawns a fresh agent that knows nothing about the conversation. It only sees the spec text.

If the spec says "use the PaymentService.charge() method" but that method doesn't exist — the auditor flags it. It has zero bias because it genuinely doesn't know what you "meant."

Workflow:
1. /sf:new "add OAuth" — Creates structured specification
2. /sf:audit — Fresh agent audits for ambiguity, missing edge cases
3. /sf:run — Implementation (auto-splits into parallel waves for large specs)
4. /sf:review — Fresh agent verifies code matches spec

In my testing, the audit step catches ~30-40% of issues before any code is written.

It's open source, written for Claude Code.

Repo: https://github.com/ivkan/specflow-cc
Install: npx specflow-cc --global

Would love feedback on the workflow approach. Is this overkill, or do others hit the same "yes-man" problem?
```

---

## 2. Reddit (r/ClaudeAI, r/LocalLLaMA)

### Title:

`I built a "Bad Cop" auditor for Claude Code because I was tired of fixing AI bugs`

### Body:

```
Hi everyone,

Like many of you, I've been using Claude Code for development. It's amazing, but it has a fatal flaw: **Over-compliance**.

If I ask for a feature, the agent says "Sure!" and writes code. 500 lines later, I realize it hallucinated a library method or forgot an error case.

I built **SpecFlow** to solve this.

**How it works:**

It forces a "Fresh Context Audit" before any code is written.

1. You describe the task
2. The Planner creates a structured Spec
3. **The Auditor (Fresh Context)** reads the spec *without knowing what you asked*
   - If the spec says "Use the flux capacitor API", the Auditor asks "What is that? I don't see it in the codebase."
   - If the spec is vague, the Auditor rejects it
4. Only after audit approval does implementation begin
5. A fresh Reviewer checks the code against the spec

It catches about 30-40% of logical errors before a single line of code is written.

**Why fresh context matters:**

The agent that wrote the spec "knows what it meant." A fresh auditor only knows what's written. This catches gaps you'd otherwise miss.

**Other features:**
- Atomic Waves: Breaking huge tasks into parallel sub-tasks
- Model Profiles: quality/balanced/budget for cost control
- Decision Trail: Know why code was written months later

Install: `npx specflow-cc --global`
Repo: https://github.com/ivkan/specflow-cc

Happy to answer questions about the prompt engineering behind the Auditor!
```

---

## 3. Twitter/X Thread

### Tweet 1 (Hook):
```
Stop debugging AI-generated code.

Start reviewing specifications.

This is why I built SpecFlow. 🧵
```

### Tweet 2 (Problem):
```
The problem with Claude Code isn't intelligence.

It's "Yes-Man" syndrome.

You ask for a complex feature. It nods and writes 5 buggy files. By the time you find the bug, you've wasted 30 minutes reading AI spaghetti.
```

### Tweet 3 (Solution):
```
SpecFlow fixes this with Fresh Context Auditing.

Before coding, a separate AI agent — with NO memory of your chat — audits the plan.

Zero bias. Catches hallucinations, missed edge cases, vague requirements.

It genuinely doesn't know what you "meant." Only what you wrote.
```

### Tweet 4 (How):
```
The workflow:

1. /sf:new — Create spec
2. /sf:audit — Fresh context audit
3. /sf:run — Implement (atomic waves)
4. /sf:review — Fresh context review

Catches ~40% of bugs before they exist.
```

### Tweet 5 (CTA):
```
Open source and ready to use:

npx specflow-cc --global

Think of it as an Engineering Manager in your CLI.

One that actually says "No" when the plan is bad.

https://github.com/ivkan/specflow-cc
```

---

## 4. Short Pitch (Discord/Slack/Newsletters)

```
I released SpecFlow — a CLI tool for Claude Code that adds verification layers to AI coding.

The key feature: Fresh Context Audits. A separate agent (with no memory of your conversation) audits your spec before any code is written. It catches hallucinations, missing edge cases, and vague requirements because it genuinely doesn't know your assumptions.

Think "code review" but for AI-generated plans.

npx specflow-cc --global
https://github.com/ivkan/specflow-cc
```

---

## 5. One-Liner (for bios, comments)

```
SpecFlow: The "Bad Cop" auditor for Claude Code that catches bugs before they're written.
```

---

## Timing Recommendations

| Platform | Best Time (UTC) | Best Day |
|----------|-----------------|----------|
| Hacker News | 14:00-16:00 | Tuesday-Thursday |
| Reddit | 14:00-18:00 | Tuesday-Wednesday |
| Twitter | 15:00-17:00 | Any weekday |

Avoid: Friday evening, weekends (low engagement).

---

## Hashtags (Twitter)

```
#ClaudeCode #AI #DevTools #OpenSource #AIBuilds
```

---

## Notes

- Tag @AnthropicAI or @alexalbert__ (Anthropic DevRel) on Twitter — they engage with Claude tooling
- Cross-post Reddit thread to r/programming after initial traction
- Respond to every HN comment in first 2 hours (algorithm boost)
