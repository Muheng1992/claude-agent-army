# Agent Army — Role Catalog (v2.0)

> 5 specialized agents for efficient Human-AI collaborative development.

## Role Registry

### 1. tech-lead
- **Type**: Orchestration
- **Tools**: Agent, Read, Grep, Glob, Bash
- **Model**: inherit
- **Responsibility**: Task decomposition, agent coordination, quality oversight, decision-making
- **Does NOT**: Write code directly
- **When to Use**: Always present as the orchestrator in team mode

### 2. architect
- **Type**: Design
- **Tools**: Read, Grep, Glob, Bash
- **Model**: inherit
- **Permission**: plan mode (read-only)
- **Responsibility**: System design, API contracts, technology decisions, ADRs
- **Does NOT**: Implement code
- **When to Use**: New modules, architectural decisions, API design

### 3. implementer
- **Type**: Execution + Integration
- **Tools**: Read, Grep, Glob, Bash, Write, Edit
- **Model**: inherit
- **Isolation**: worktree
- **Responsibility**: Code implementation, merge coordination, E2E verification, dependency resolution
- **Merged From**: implementer + integrator
- **When to Use**: Writing code, refactoring, integrating multi-agent work

### 4. tester
- **Type**: Quality Assurance
- **Tools**: Read, Grep, Glob, Bash, Write, Edit
- **Model**: inherit
- **Responsibility**: Unit/integration/E2E testing, code review, security auditing (OWASP)
- **Merged From**: tester + reviewer + security-auditor
- **When to Use**: After implementation for testing, review, and security verification

### 5. documenter
- **Type**: Documentation & Reporting
- **Tools**: Read, Grep, Glob, Bash, Write, Edit
- **Model**: sonnet
- **Responsibility**: API docs, README, ADRs, report generation, filing, indexing, archiving
- **Merged From**: documenter + reporter + doc-manager
- **When to Use**: After implementation for documentation and report management

## Interaction Matrix

| From ↓ / To → | tech-lead | architect | implementer | tester | documenter |
|----------------|-----------|-----------|-------------|--------|------------|
| **tech-lead** | — | Design requests | Task assignment | Quality check | Doc requests |
| **architect** | Design proposals | — | Design handoff | — | — |
| **implementer** | Status updates | Design questions | Peer coordination | — | — |
| **tester** | Quality reports | Design feedback | Fix requests | Peer coordination | — |
| **documenter** | Doc status | — | Code questions | Review data | — |

## Role Assignment Decision Tree

```
Is it a design/architecture task?
├── Yes → architect
└── No → Is it code implementation or integration?
    ├── Yes → implementer
    └── No → Is it testing, review, or security?
        ├── Yes → tester
        └── No → Is it documentation or reporting?
            ├── Yes → documenter
            └── No → tech-lead (coordination)
```

## Scaling Patterns

| Grade | tech-lead | architect | implementer | tester | documenter | Total |
|-------|-----------|-----------|-------------|--------|------------|-------|
| S     | 0         | 0         | 0           | 0      | 0          | 0 (direct) |
| A     | 0         | 0         | 1           | 1      | 0          | 2-3   |
| B     | 0         | 0-1       | 1-3         | 1      | 1          | 3-5   |
| C     | 1         | 1         | 2-5         | 1-2    | 1          | 5-10  |

## Cost Optimization

| Agent | Recommended Model | Rationale |
|-------|------------------|-----------|
| tech-lead | Opus (inherit) | Complex reasoning for coordination |
| architect | Opus (inherit) | Design decisions need deep reasoning |
| implementer | Opus (inherit) | Code quality requires strong model |
| tester | Opus (inherit) | Review + security needs strong reasoning |
| documenter | Sonnet | Documentation is less reasoning-intensive |
