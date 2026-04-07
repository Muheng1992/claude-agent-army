---
name: onboard
description: >
  Project analysis and memory bootstrapping. Scans project structure, detects
  tech stack and architecture patterns, reads key configuration files, and
  generates structured memory for fast context loading in future sessions.
  Run once when starting work on a new or unfamiliar project.
---

# Project Onboarding

You are conducting a comprehensive project analysis to bootstrap agent memory. Your goal is to understand the project deeply enough to generate structured memory that accelerates all future sessions.

## Usage

```
/agent-army:onboard
/agent-army:onboard [project-name]
```

## Phase 1: Discovery

Scan the project root directory to identify the project type and technology stack.

### 1.1 Language & Framework Detection

Check for the following project type indicators at the project root:

| File | Indicates |
|------|-----------|
| `package.json` | Node.js / TypeScript (check for `typescript` dep) |
| `go.mod` | Go |
| `requirements.txt` / `pyproject.toml` / `setup.py` / `Pipfile` | Python |
| `Cargo.toml` | Rust |
| `pom.xml` / `build.gradle` / `build.gradle.kts` | Java / Kotlin |
| `Gemfile` | Ruby |
| `*.sln` / `*.csproj` | .NET |
| `mix.exs` | Elixir |
| `composer.json` | PHP |
| `deno.json` / `deno.jsonc` | Deno |

### 1.2 Project Shape

Glob for common source patterns to understand the project shape:

- `src/**`, `lib/**`, `app/**`, `cmd/**`, `internal/**`, `pkg/**`
- `test*/**`, `spec/**`, `__tests__/**`
- `docs/**`, `scripts/**`, `tools/**`

### 1.3 Monorepo Detection

Check for monorepo indicators:

- `packages/`, `apps/`, `services/`, `modules/`
- `lerna.json`, `pnpm-workspace.yaml`, `nx.json`, `turbo.json`
- Multiple `package.json` files at different levels

### 1.4 File Census

Count files by extension to identify the primary language:

```bash
find . -type f -not -path './.git/*' -not -path './node_modules/*' -not -path './vendor/*' -not -path './.venv/*' | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -20
```

### 1.5 Tooling & Configuration

Check for the presence of:

- `.claude/CLAUDE.md` — existing Claude Code conventions
- `.claude/agents/` — existing agent definitions
- `.claude/skills/` — existing skill definitions
- `.github/` — GitHub workflows and templates
- `.gitlab-ci.yml` — GitLab CI
- `Dockerfile` / `docker-compose.yml` — containerization
- `.env.example` / `.env.template` — environment variables
- `Makefile` / `Justfile` / `Taskfile.yml` — task runners

## Phase 2: Deep Analysis

Read key files to understand the project's purpose, architecture, and conventions.

### 2.1 Project Description

Read these files if they exist (in priority order):

1. `README.md` — project description, setup instructions, usage
2. `CLAUDE.md` or `.claude/CLAUDE.md` — existing conventions and standards
3. `CONTRIBUTING.md` — contribution guidelines
4. `docs/INDEX.md` — documentation index

### 2.2 Package Manifest Analysis

Read the primary package manifest (`package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, etc.) to extract:

- Project name and version
- Key dependencies and their purposes
- Available scripts/commands (build, test, start, lint, format)
- Dev dependencies that indicate tooling (ESLint, Prettier, Jest, etc.)

### 2.3 Architecture Pattern Detection

Scan the directory structure (2 levels deep from project root) and classify:

| Pattern | Indicators |
|---------|-----------|
| **Clean Architecture** | `domain/`, `application/`, `adapters/`, `infrastructure/` or `entities/`, `use-cases/`, `ports/` |
| **MVC** | `models/`, `views/`, `controllers/` |
| **Feature-based / Modular** | `features/`, `modules/` with self-contained subdirectories |
| **Hexagonal** | `ports/`, `adapters/`, `core/` |
| **Layered** | `dal/`, `bll/`, `api/` or `data/`, `business/`, `presentation/` |
| **Flat** | All source files in a single directory |
| **Convention-based** | Framework-dictated structure (Rails, Next.js, Django, etc.) |

### 2.4 Entry Points

Identify key entry points by language: `main.ts`/`index.ts`/`app.ts` (Node.js), `main.go`/`cmd/*/main.go` (Go), `app.py`/`main.py`/`manage.py` (Python), `main.rs`/`lib.rs` (Rust), `Main.java`/`Application.java` (Java), `Program.cs` (.NET).

### 2.5 Testing & CI/CD

Detect testing infrastructure:
- **Config**: `jest.config.*`, `vitest.config.*`, `pytest.ini`, `.mocharc.*`
- **Directories**: `test/`, `tests/`, `__tests__/`, `spec/`, `*_test.go`
- **E2E**: `cypress/`, `playwright.config.*`, `e2e/`

Detect CI/CD: `.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/config.yml`, `azure-pipelines.yml`.

### 2.6 External Service Integrations

Look for: database (`prisma/`, `migrations/`, `alembic/`), message queues (Redis, RabbitMQ, Kafka references), cloud (`serverless.yml`, `terraform/`, `cdk.json`), API specs (`openapi.*`, `swagger.*`, `graphql/schema.*`).

## Phase 3: Memory Generation

Generate structured memory files based on the analysis.

### 3.1 Primary Memory File

Write to `~/.claude/projects/{project-path-encoded}/memory/MEMORY.md`:

**Important**: If the file already exists, READ it first and MERGE new findings with existing content. Do NOT overwrite user-written notes.

```markdown
# [Project Name] - Project Memory

## Project Overview
- Type: [language/framework]
- Architecture: [detected pattern]
- Location: [absolute path]
- Description: [from README, 1-2 sentences]

## Tech Stack
- Language: [primary language and version if detectable]
- Framework: [detected framework]
- Build Tool: [detected build tool]
- Package Manager: [npm/yarn/pnpm/pip/cargo/etc.]
- Test Framework: [detected test framework]
- CI/CD: [detected CI system]

## Architecture
- Pattern: [Clean Architecture / MVC / Feature-based / Hexagonal / Flat]
- Entry points: [list key entry points]
- Key directories:
  - `src/domain/` — [purpose]
  - `src/application/` — [purpose]
  - [etc.]

## Key Files
- Config: [list important config files]
- Entry: [list entry point files]
- Tests: [test directory and naming pattern]

## Dependencies (notable)
- [dep-name]: [purpose, e.g., "express: HTTP server framework"]
- [dep-name]: [purpose]

## Conventions
- [detected naming conventions]
- [detected code style rules]
- [from CLAUDE.md if exists]

## Development Commands
- Install: [detected install command]
- Build: [detected build command]
- Test: [detected test command]
- Start: [detected start command]
- Lint: [detected lint command]
- Format: [detected format command]
```

### 3.2 Topic Files (create only if sufficient information exists)

If the architecture analysis yielded rich detail, create these in the same memory directory:

**`architecture.md`** — Layer map (directory-to-layer mapping), data flow, key abstractions (interfaces, base classes, patterns), and dependency graph between modules.

**`conventions.md`** — Code style (formatting/linting rules), file organization, design patterns in use, and testing conventions (naming, placement, mock strategy).

## Phase 4: Verification

Validate the generated memory is useful and complete.

### 4.1 Completeness Check

Verify each section of MEMORY.md has real content (not just placeholders):

- [ ] Project Overview has type and architecture filled
- [ ] Tech Stack has at least language and one tool
- [ ] Architecture pattern is identified (even if "Flat" or "Unknown")
- [ ] At least 3 key files are listed
- [ ] At least 1 development command is detected

### 4.2 Accuracy Spot-Check

- Verify the detected primary language matches the file census
- Confirm entry points actually exist on disk
- Confirm listed commands appear in the package manifest

### 4.3 Manual Review Items

List items that could not be automatically determined and need human input:

- Architecture decisions that require domain knowledge
- Business logic context that is not in code
- Deployment targets and environments
- Team conventions not captured in config files

## Output

```markdown
# Project Onboarding Report

**Project**: [name]
**Date**: YYYY-MM-DD
**Location**: [absolute path]

## Detected Profile

| Attribute | Value |
|-----------|-------|
| Primary Language | [language] |
| Framework | [framework or "None detected"] |
| Architecture | [pattern] |
| Monorepo | Yes / No |
| Test Framework | [framework] |
| CI/CD | [system or "Not configured"] |

## File Census
| Extension | Count |
|-----------|-------|
| [ext] | [count] |
| ... | ... |

## Memory Generated
- `~/.claude/projects/{path}/memory/MEMORY.md` — [created / updated]
- `~/.claude/projects/{path}/memory/architecture.md` — [created / skipped]
- `~/.claude/projects/{path}/memory/conventions.md` — [created / skipped]

## Auto-Detected (high confidence)
- [list items detected with high confidence]

## Needs Manual Review
- [list items that require human verification or input]

## Suggested Next Steps
1. Review the generated MEMORY.md and correct any inaccuracies
2. Add business context that cannot be detected from code
3. Run `/agent-army:setup` if docs/ structure is not yet initialized
4. Run `/agent-army:assemble [feature]` to start development
```
