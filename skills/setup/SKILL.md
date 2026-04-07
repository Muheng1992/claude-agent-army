---
name: setup
description: >
  Initialize the Agent Army in your project. Creates the docs/ directory structure,
  report directories, document index, CLAUDE.md template with Clean Architecture
  standards, configures environment settings, initializes memory architecture,
  detects MCP servers, and optionally installs git hooks, keybindings, and
  workspace configuration for multi-agent development.
  Run this once when setting up Agent Army in a new project.
disable-model-invocation: true
---

# Agent Army Setup

Initialize your project for Agent Army multi-agent development.

## Usage

```
/agent-army:setup [project-name]
```

## What This Does

This setup creates all the infrastructure needed for the Agent Army system to operate in your project.

## Step 1: Create Documentation Structure

Create the following directory tree in the project root:

```
docs/
├── INDEX.md                          # Master document index
├── architecture/                     # Architecture Decision Records
├── reports/                          # All reports (historically preserved)
│   ├── code-review/
│   ├── test/
│   ├── security/
│   ├── fix/
│   ├── integration/
│   ├── quality-gate/
│   └── plans/
├── guides/
├── api/
└── archive/
    └── ARCHIVE-INDEX.md
```

Use `mkdir -p` to create all directories. Then create the following files:

### docs/INDEX.md

```markdown
# Documentation Index

> **Last updated**: [today's date]
> **Total documents**: 0 | Active: 0 | Archived: 0

---

## System Documentation

| Document | Last Updated | Status | Description |
|----------|-------------|--------|-------------|
| (none yet) | — | — | — |

## Architecture Decision Records

| Document | Last Updated | Status |
|----------|-------------|--------|
| (none yet) | — | — |

## Reports

### Plans
| Date | Subject | Status | Author | Link |
|------|---------|--------|--------|------|

### Code Reviews
| Date | Feature | Verdict | Link |
|------|---------|---------|------|

### Test Reports
| Date | Feature | Pass Rate | Coverage | Link |
|------|---------|-----------|----------|------|

### Security Audits
| Date | Scope | Result | Link |
|------|-------|--------|------|

### Fix Reports
| Date | Issue | Root Cause | Link |
|------|-------|-----------|------|

### Integration Reports
| Date | Feature | Status | Link |
|------|---------|--------|------|

### Quality Gate Reports
| Date | Scope | Result | Link |
|------|-------|--------|------|

## Guides
| Document | Last Updated | Status |
|----------|-------------|--------|

## Archived
| Document | Archived Date | Reason | Link |
|----------|--------------|--------|------|

---

*This index is maintained by the `documenter` agent. Update after filing any new report.*
```

### docs/archive/ARCHIVE-INDEX.md

```markdown
# Archive Index

> Documents that have been superseded or are no longer active.
> These are preserved for historical reference — NEVER delete archived documents.

| Document | Archived Date | Reason | Original Location | Link |
|----------|--------------|--------|-------------------|------|
```

## Step 2: Create/Update CLAUDE.md

If `.claude/CLAUDE.md` does NOT exist, create it. If it exists, append the Agent Army section.

### Template for new projects:

```markdown
# [Project Name] — Project Standards

> Human-AI Collaborative Development | Clean Architecture | Agent Army

## Architecture Standards: Clean Architecture (Mandatory)

All code MUST follow Clean Architecture principles:

### Dependency Rule
Dependencies point INWARD only. Inner layers never import from outer layers.

```
Domain (innermost) → Application → Adapters → Infrastructure (outermost)
```

### Layer Rules
- **Domain**: Pure business logic. NO framework imports. NO external dependencies.
- **Application**: Use cases and port interfaces. Depends only on Domain.
- **Adapters**: Controllers, repository implementations. Implements ports from Application.
- **Infrastructure**: Framework setup, DI container, config. Wires everything together.

### File Structure
```
src/
├── domain/          # Entities, Value Objects, Domain Events
├── application/     # Use Cases, Ports (interfaces), DTOs
├── adapters/        # Controllers, Repository Implementations
└── infrastructure/  # Config, DI, Server Setup
```

## Coding Standards

### File Limits
- Max file length: 300 lines
- Max function length: 50 lines
- Max parameters: 4 (use object parameter for more)
- Max nesting: 3 levels

### Naming
- Files: `kebab-case.ts`
- Types/Classes: `PascalCase`
- Functions: `camelCase` (verb+noun: `createUser`)
- Constants: `UPPER_SNAKE_CASE`
- Booleans: `is/has/should/can` prefix

### Comments (Human-AI Collaboration)
- `// WHY:` — Non-obvious business reason
- `// CONTEXT:` — Domain knowledge for AI
- `// CONSTRAINT:` — External limitation
- `// AI-BOUNDARY:` — Integration point marker
- `// AI-INVARIANT:` — Must-hold condition
- `// AI-CAUTION:` — Modification impact warning

### Error Handling
- Validate at system boundaries only
- Use typed errors (DomainError, ApplicationError, InfrastructureError)
- Never swallow errors silently

## Agent Army

This project uses the Agent Army plugin for multi-agent development.
See the plugin documentation for available agents and skills.

### Report Management
All reports are filed in `docs/reports/` with timestamps.
Reports are NEVER deleted — only archived to `docs/archive/`.

## Git Workflow
- Branch naming: `feature/[name]`, `fix/[name]`, `refactor/[name]`
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- Run `/agent-army:quality-gate` before merge
```

## Step 3: Configure Environment

Check if `.claude/settings.json` exists. If not, create it. If it exists, merge the following settings:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Bash(npm test *)",
      "Bash(npm run *)",
      "Bash(npx *)",
      "Bash(python -m pytest *)",
      "Bash(go test *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git branch *)",
      "Bash(gh pr *)",
      "Bash(gh issue *)"
    ]
  }
}
```

**Important**: Merge carefully — do NOT overwrite existing settings. Add to existing arrays.

## Step 4: Memory Architecture Initialization

Initialize the persistent memory system so all agents share project knowledge.

1. Determine the project memory path:
   - Encode the project's absolute path by replacing `/` with `-` (drop leading slash)
   - Target directory: `~/.claude/projects/{encoded-path}/memory/`
   - Example: project at `/Users/dev/my-app` becomes `~/.claude/projects/-Users-dev-my-app/memory/`

2. Create the memory directory:
   ```bash
   mkdir -p ~/.claude/projects/{encoded-path}/memory/
   ```

3. Copy memory templates from the plugin's `templates/memory/` directory. For **each** file, check if it already exists first — do NOT overwrite existing memory files:
   - `MEMORY.md` — Main memory file (project overview, tech stack, decisions)
   - `architecture.md` — Architecture notes and layer boundaries
   - `debugging.md` — Debugging lessons and environment fixes
   - `patterns.md` — Code patterns and idioms
   - `conventions.md` — Naming, style, and workflow conventions

4. In all copied files, replace these placeholders with actual values:
   - `{PROJECT_NAME}` — the project name provided by the user
   - `{PROJECT_PATH}` — the absolute path to the project root
   - `{PROJECT_ROOT}` — the project root directory name
   - Leave other placeholders (e.g., `{LANGUAGE}`, `{FRAMEWORK}`) as-is for the user to fill in later

5. Report which files were created vs which were skipped (already existed).

## Step 5: MCP Server Detection & Recommendation

Help the user optimize their MCP server configuration.

1. Check for existing MCP configurations:
   - Read `~/.claude/mcp.json` (global config) if it exists
   - Read `.claude/mcp.json` (project config) if it exists

2. List detected MCP servers from both configs, showing:
   - Server name
   - Source (global vs project)

3. Recommend useful MCP servers that are NOT yet configured:

| MCP Server | Purpose | Install Command |
|-----------|---------|----------------|
| Context7 | Real-time library docs lookup | `npx -y @anthropic/context7-mcp` |
| Sequential Thinking | Complex reasoning and planning | `npx -y @anthropic/sequential-thinking-mcp` |
| Puppeteer | Browser automation for E2E testing | `npx -y @anthropic/puppeteer-mcp` |

4. For each missing recommended MCP, provide a ready-to-copy JSON snippet:
   ```json
   {
     "mcpServers": {
       "context7": {
         "command": "npx",
         "args": ["-y", "@anthropic/context7-mcp"]
       }
     }
   }
   ```

5. Inform the user: add to `~/.claude/mcp.json` for global access or `.claude/mcp.json` for project-only.

## Step 6: Git Hooks Installation (Optional)

Ask the user: **"Would you like to install Agent Army git hooks?"**

If the user declines, skip to Step 7.

If the user accepts:

1. Verify `.git/hooks/` directory exists (the project must be a git repository)

2. For each hook, check if it already exists in `.git/hooks/`. If it does, warn the user and ask before overwriting:

| Hook | Source Template | What It Does |
|------|----------------|-------------|
| `pre-commit` | `templates/git-hooks/pre-commit` | Enforces 300-line file limit; detects secrets and .env files in staged changes |
| `commit-msg` | `templates/git-hooks/commit-msg` | Enforces Conventional Commits format; limits first line to 72 chars |
| `pre-push` | `templates/git-hooks/pre-push` | Reminds to run tests and quality gate before pushing (non-blocking) |

3. Copy each hook template to `.git/hooks/`

4. Make all hooks executable:
   ```bash
   chmod +x .git/hooks/pre-commit .git/hooks/commit-msg .git/hooks/pre-push
   ```

5. Validate each hook with `sh -n .git/hooks/{hook-name}` to confirm valid syntax

## Step 7: Keybindings (Optional)

Ask the user: **"Would you like to install Agent Army keybindings for quick access?"**

If the user declines, skip to Step 8.

If the user accepts:

1. Read `~/.claude/keybindings.json` if it exists

2. Show the user the available keybindings from `templates/keybindings/keybindings.json`:

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Ctrl+Shift+A` | `/agent-army:assemble` | Launch Agent Army assembler |
| `Ctrl+Shift+Q` | `/agent-army:quality-gate` | Run quality gate checks |
| `Ctrl+Shift+R` | `/agent-army:code-review` | Start code review |
| `Ctrl+Shift+T` | `/agent-army:tdd` | Start TDD cycle |
| `Ctrl+Shift+F` | `/agent-army:fix` | Smart fix |
| `Ctrl+Shift+S` | `/agent-army:sprint` | Sprint planning |
| `Ctrl+Shift+C` | `/agent-army:context-sync` | Context sync |

3. If `~/.claude/keybindings.json` already exists, **merge** — do NOT overwrite existing user keybindings. Only add bindings whose `key` does not already exist.

4. If it does not exist, create it with the template content.

## Step 8: Workspace Configuration (Optional, for multi-project)

Ask the user: **"Do you work with multiple related projects that should share coordination?"**

If the user declines, skip to Step 9.

If the user accepts:

1. Check if `~/.claude/workspace.json` already exists
   - If it exists, show its contents and ask if they want to add this project to it
   - If not, create it from `templates/workspace/workspace.json`

2. Replace placeholders:
   - `{WORKSPACE_NAME}` — ask the user for a workspace name
   - `{PROJECT_1_NAME}` — use the current project name
   - `{PROJECT_1_PATH}` — use the current project path
   - `{PROJECT_1_DESCRIPTION}` — ask or use a default

3. Explain to the user:
   - Workspace config enables cross-project timesheet tracking via `/agent-army:timesheet`
   - Agents can reference shared conventions across projects
   - Additional projects can be added later by editing `~/.claude/workspace.json`

## Step 9: Verification

After setup, verify ALL configured items:

1. `docs/` directory structure exists
2. `docs/INDEX.md` created
3. `docs/archive/ARCHIVE-INDEX.md` created
4. `.claude/CLAUDE.md` contains Clean Architecture standards
5. `.claude/settings.json` has Agent Teams enabled
6. Memory templates initialized in `~/.claude/projects/` (list created vs skipped files)
7. MCP servers detected/recommended (show summary)
8. Git hooks installed (if chosen) — confirm with `sh -n` syntax check
9. Keybindings installed (if chosen)
10. Workspace config created (if chosen)

Print a pass/fail status for each item.

## Output

```markdown
## Agent Army Setup Complete

### Created
- docs/ directory structure with all report categories
- docs/INDEX.md — Master document index
- docs/archive/ARCHIVE-INDEX.md — Archive index
- .claude/CLAUDE.md — Project standards [created | updated]
- .claude/settings.json — Environment settings [created | merged]
- Memory templates — [N files created, M skipped] in ~/.claude/projects/.../memory/

### MCP Servers
- Detected: [list of detected servers]
- Recommended: [list of recommended servers with install snippets]

### Optional Features
- Git hooks: [installed | skipped]
- Keybindings: [installed | merged | skipped]
- Workspace config: [created | updated | skipped]

### Next Steps
1. Fill in memory template placeholders (language, framework, etc.)
2. Install recommended MCP servers for enhanced capabilities
3. Run `/agent-army:assemble [feature]` to launch your first agent army
4. Run `/agent-army:sprint [feature]` for sprint planning
5. Run `/agent-army:quality-gate all` to verify project setup

### Available Commands
| Command | Purpose |
|---------|---------|
| `/agent-army:assemble [feature]` | Launch full agent army |
| `/agent-army:sprint [feature]` | Sprint planning & execution |
| `/agent-army:quality-gate [scope]` | Quality checkpoint |
| `/agent-army:code-review [scope]` | Code review orchestration |
| `/agent-army:tdd [feature]` | TDD enforcement |
| `/agent-army:fix [error]` | Smart problem resolution |
| `/agent-army:timesheet [range]` | Work time analysis |
| `/agent-army:setup` | This setup (re-run safe) |
```
