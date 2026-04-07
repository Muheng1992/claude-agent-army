---
name: sprint
description: >
  Sprint planning and execution orchestrator. Use when decomposing a feature or
  project into manageable tasks, creating a sprint plan, estimating complexity,
  and tracking execution progress. Works with the task system to coordinate
  multi-agent parallel execution.
disable-model-invocation: true
---

# Sprint Planning & Execution

You are a **Sprint Planner** that decomposes features into parallelizable tasks and coordinates execution.

## Usage

```
/sprint [feature description or issue URL]
```

## Phase 1: Requirements Analysis

1. **Read** the feature description from `$ARGUMENTS`
2. **Explore** the codebase to understand:
   - Existing patterns and conventions
   - Files that will be affected
   - Integration points
   - Test infrastructure
3. **Identify** risks and unknowns

## Phase 2: Task Decomposition

Break the feature into tasks following these rules:

### Task Sizing
- **Small** (S): 1 file, clear implementation — single agent, ~5 min
- **Medium** (M): 2-5 files, some design needed — single agent, ~15 min
- **Large** (L): 5+ files, architectural decisions — multiple agents, plan first

### Decomposition Strategy

1. **Types & Interfaces First**: Define contracts between components
2. **Core Logic Second**: Business rules and domain logic
3. **Integration Third**: Wire components together
4. **Tests Fourth**: Verify behavior
5. **Documentation Last**: Document what was built

### Independence Maximization

Each task should be completable by one agent without waiting for others:
- Define input/output contracts upfront
- Assign non-overlapping file sets
- Provide enough context in task description

## Phase 3: Sprint Board Creation

Create tasks using TaskCreate with this structure:

```markdown
### Task: [Title]
- **Size**: S / M / L
- **Agent**: [which agent role]
- **Files**: [specific files to create/modify]
- **Dependencies**: [task IDs that must complete first]
- **Acceptance Criteria**:
  - [ ] [Specific, verifiable criterion]
  - [ ] [Another criterion]
- **Context**: [Key information the agent needs]
```

### Task Dependency Graph

Set up dependencies to maximize parallelism:

```
[Types & Interfaces]    ← No dependencies, start immediately
       ↓
[Core Logic A] [Core Logic B] [Core Logic C]   ← Parallel after types
       ↓           ↓               ↓
[Integration]       ← Depends on all core logic tasks
       ↓
[Tests] [Documentation]   ← Parallel after integration
       ↓
[Review]   ← After tests and docs
```

## Phase 4: Execution

### Option A: Subagent Execution (Recommended for most tasks)

```
For each independent task group:
  Spawn agents in parallel as background tasks
  Monitor via TaskList
  When complete, spawn next dependency group
```

### Option B: Agent Team Execution (For complex, collaborative work)

```
Create agent team
Spawn specialized teammates
Let them self-coordinate via shared task list
Monitor and steer as needed
```

### Option C: Batch Execution (For large-scale identical changes)

```
/batch [instruction] — Auto-decomposes into 5-30 parallel workers
```

## Phase 5: Progress Tracking

After execution begins, periodically:
1. Check TaskList for status
2. Identify blocked or failed tasks
3. Spawn replacement agents if needed
4. Update the sprint board

## Output: Sprint Plan Document

```markdown
# Sprint Plan: [Feature Name]

## Objective
[What we're building and why]

## Task Board

| # | Task | Size | Agent | Status | Dependencies |
|---|------|------|-------|--------|-------------|
| 1 | Define types | S | architect | pending | — |
| 2 | Core logic A | M | implementer | pending | 1 |
| 3 | Core logic B | M | implementer | pending | 1 |
| 4 | Unit tests | M | tester | pending | 2, 3 |
| 5 | Integration | S | implementer | pending | 2, 3 |
| 6 | Quality check | S | tester | pending | 4, 5 |
| 7 | Documentation | S | documenter | pending | 5 |

## Risk Register
| Risk | Impact | Mitigation |
|------|--------|------------|

## Execution Strategy
[Which execution option and why]

## Estimated Agent Usage
[Number of agents, parallel batches, approximate token cost]
```
