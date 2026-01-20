# SpecFlow

**Spec-driven development system for Claude Code**

SpecFlow is a lean, audit-driven development workflow that integrates with Claude Code. It combines the best practices of specification-first development with explicit quality audits.

## Philosophy

- **Spec-first** — Write specifications before code
- **Explicit audit** — Dedicated audit phase, not just verification
- **Fresh context** — Auditors don't see the creation process (no bias)
- **Lean process** — Minimal commands, maximum value
- **Human gate** — You control when to proceed
- **Token awareness** — Specs sized for single sessions

## Installation

```bash
npx specflow-cc
```

## Core Workflow

```
/sf init    → Initialize project
/sf new     → Create specification
/sf audit   → Audit specification
/sf revise  → Revise based on audit
/sf run     → Execute specification
/sf review  → Review implementation
/sf fix     → Fix based on review
/sf done    → Complete and commit
```

## Quick Start

```bash
# 1. Initialize project (once)
/sf init

# 2. Create a spec
/sf new "Add user authentication with JWT"

# 3. Audit the spec
/sf audit

# 4. Run when approved
/sf run

# 5. Review implementation
/sf review

# 6. Complete
/sf done
```

## Commands

### Core
| Command | Description |
|---------|-------------|
| `/sf init` | Initialize project |
| `/sf new` | Create specification |
| `/sf audit` | Audit specification |
| `/sf revise` | Revise specification |
| `/sf run` | Execute specification |
| `/sf review` | Review implementation |
| `/sf fix` | Fix implementation |
| `/sf done` | Complete |

### Navigation
| Command | Description |
|---------|-------------|
| `/sf status` | Current state |
| `/sf list` | All specifications |
| `/sf show` | Show one spec |
| `/sf next` | Next priority task |

### To-Do
| Command | Description |
|---------|-------------|
| `/sf todo` | Add idea |
| `/sf todos` | List todos |
| `/sf plan` | Convert to spec |
| `/sf priority` | Prioritize |

### Session
| Command | Description |
|---------|-------------|
| `/sf pause` | Save context |
| `/sf resume` | Restore context |

## Documentation

See [docs/DESIGN.md](docs/DESIGN.md) for full design specification.

## License

MIT
