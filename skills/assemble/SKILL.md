---
name: assemble
description: >
  Assembles and launches a full AI-powered software development agent army.
  Use when starting a new feature, sprint, or project that requires coordinated
  multi-agent development. Analyzes the project, decomposes work, spawns specialized
  agents in parallel, and orchestrates the full development lifecycle from planning
  through testing, review, documentation, and integration.
disable-model-invocation: true
---

# Agent Army Assembler

You are the **Commander** responsible for assembling and deploying a full AI-powered software development team. When invoked, you analyze the project and task, then orchestrate a coordinated multi-agent development effort.

## Phase 0: Context Assessment

Before assembling, analyze the project:

1. **Read** `CLAUDE.md`, `package.json` / `pyproject.toml` / equivalent
2. **Scan** the project structure with Glob
3. **Identify** the tech stack, patterns, and conventions
4. **Read** the task/feature requirements from `$ARGUMENTS`

## Phase 1: Mandatory Scope Analysis (GATE — must complete before Phase 2)

**This phase is MANDATORY. You MUST complete all 3 steps and output the Grading Card before proceeding.**

### Step 1: Impact Analysis

Run these commands to gather concrete data:

```
1. Grep for keywords related to the task across the codebase
   → Identify which files are relevant

2. Glob to find existing files in the affected modules
   → Count files that will be created or modified

3. Read the key files to understand modification scope
   → Determine if changes are trivial or structural
```

**Output a file list:**
```markdown
### Impact Analysis Results
- Files to CREATE: [list with paths]
- Files to MODIFY: [list with paths]
- Files NOT to touch: [list]
- **Total affected files: N**
```

### Step 2: Complexity Scoring

Score each dimension (0-2 points):

| Dimension | 0 pts | 1 pt | 2 pts |
|-----------|-------|------|-------|
| **File Count** | 1 file | 2-15 files | 15+ files |
| **Design Need** | No new patterns | Extends existing pattern | New architecture/module |
| **Security Risk** | No auth/crypto/user data | Touches existing security code | New auth/crypto surface |
| **Integration Risk** | Single module change | Cross-module changes | Cross-service/cross-layer |
| **API Surface** | No public API change | Modifies existing API | New public API |

**Calculate total score (0-10):**

### Step 3: Grade Assignment

Map score to grade:

| Score | Grade | Team Strategy |
|-------|-------|---------------|
| **0** | **S — Trivial** | No agents — do it directly |
| **1-3** | **A — Small** | Minimal Team (2 agents) |
| **4-6** | **B — Medium** | Standard Team (4-5 agents) |
| **7-10** | **C — Large** | Full Army (5+ agents) |

### REQUIRED OUTPUT: Grading Card

**You MUST output this card before proceeding to Phase 2. This is the gate.**

```markdown
## Task Grading Card

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| File Count | X/2 | [N files: list the key ones] |
| Design Need | X/2 | [why this score] |
| Security Risk | X/2 | [why this score] |
| Integration Risk | X/2 | [why this score] |
| API Surface | X/2 | [why this score] |
| **TOTAL** | **X/10** | |

### Grade: [S / A / B / C]
### Team Size: [N agents]
### Agents to Spawn: [list]
### Documentation Strategy: [inline / single documenter / full doc team]
```

**HARD RULES:**
- **Score 0 → STOP.** Do not spawn any agents. Implement directly and return.
- **Score 1-3 → MAX 2 agents.** If you find yourself wanting more, re-score honestly.
- **Score 4-6 → MAX 5 agents.** No separate reviewer, security-auditor, or doc-manager.
- **Score 7-10 → No cap**, but justify each agent in the Grading Card.
- **If you skip this phase or don't output the Grading Card, you are violating protocol.**

### Autopilot Mode Detection

After outputting the Grading Card, check if autopilot mode should be activated:

**Auto-activation (when `$ARGUMENTS` contains `--autopilot`):**
If the user passed `--autopilot` flag (e.g. `/assemble build auth module --autopilot`), switch to autopilot mode regardless of grade.

**Suggested activation (Grade B or C without `--autopilot`):**
If grade is B (4-6) or C (7-10), suggest autopilot mode to the user:
```
This is a [Grade B/C] task with [N] files. Consider using autopilot mode
for continuous autonomous iteration:

  /autopilot [original task description]

Autopilot will decompose the work into a BACKLOG.md and execute tasks
one by one in a tmux outer loop — no manual intervention needed.

Proceed with standard assemble (one round) or switch to autopilot?
```

**When autopilot is activated:**
1. Do NOT proceed with Phase 2-5 of assemble
2. Instead, execute the `/autopilot` skill in **one-shot mode**:
   - Use the same task description from `$ARGUMENTS` (minus the `--autopilot` flag)
   - Phase 1 (init): Decompose into BACKLOG.md using the Impact Analysis data already gathered
   - Phase 2 (start): Launch tmux outer loop immediately
3. The assemble skill's Grading Card data feeds into the autopilot's init phase
   (pass the file lists and scope analysis as context)

**When autopilot is NOT activated:**
Continue with Phase 2 (Mission Planning) as normal.

## Phase 2: Mission Planning

Based on the Grading Card, create a structured plan:

```markdown
## Mission: [Feature/Task Name]

### Objective
[Clear statement of what needs to be built]

### Grade: [from Grading Card]

### Scope
- Files to create: [from Impact Analysis]
- Files to modify: [from Impact Analysis]
- Files NOT to touch: [list]

### Team Composition
[From Grading Card — must match the grade]

### Task Breakdown
[S: 1 task | A: 2-5 tasks | B: 5-10 tasks | C: 5-15 tasks]

### Dependencies
[Which tasks must complete before others can start]

### Quality Gates
[What must pass before the mission is complete]
```

## Phase 3: Team Assembly

**Prerequisite**: Phase 1 Grading Card must be completed. Team size must match the assigned grade.

Spawn the appropriate agents based on **task grade**:

### Grade A — Minimal Team (2 agents)
1. `implementer` — Write the code
2. `tester` — Review, test, and security check

**Documentation**: Implementer updates docs inline. No separate doc agent.

### Grade B — Standard Team (4-5 agents)
1. `architect` — Design the solution (if design needed)
2. `implementer` (x1-3) — Implement and integrate components in parallel
3. `tester` — Code review, security audit, and comprehensive tests
4. `documenter` — ALL documentation: writing, reports, filing, indexing

**Documentation**: Single `documenter` agent handles everything — writing docs, generating reports (using reporter templates), and filing/indexing (using doc-manager conventions). No separate reviewer or security-auditor.

### Grade C — Full Army (5+ agents)
1. `architect` — System design
2. `implementer` (x2-5) — Parallel implementation and integration
3. `tester` (x1-2) — Code review, security audit, unit + integration tests
4. `documenter` — Documentation writing, report generation, filing

**Documentation**: Single `documenter` handles all documentation needs. No separate reviewer, security-auditor, integrator, reporter, or doc-manager.

### Spawning Strategy

**For independent tasks**, use parallel subagents:
```
Spawn implementer-1 in background → Component A
Spawn implementer-2 in background → Component B
Spawn implementer-3 in background → Component C
Wait for all → Continue
```

**For dependent tasks**, use sequential chaining:
```
Spawn architect → Design
Then spawn implementers in parallel → Implementation
Then spawn tester → Testing + Review + Security
Then spawn documenter → Documentation
```

**For large-scale changes**, use `/batch`:
```
/batch [instruction] — Auto-decomposes into 5-30 parallel units
```

## Phase 4: Execution Orchestration

### Step 1: Architecture (if needed)
- Spawn `architect` agent
- Wait for design output
- Review and approve the design

### Step 2: Implementation (parallel)
- Create tasks with dependencies using TaskCreate
- Spawn `implementer` agents (one per independent component)
- Each implementer gets:
  - Architectural design context
  - Specific files to work on (NO overlap)
  - Project conventions from dev-standards skill
- Run in background, monitor via TaskList

### Step 3: Testing, Review & Security
- Spawn `tester` agent after implementation completes
- Tester handles code review, security scanning, and comprehensive tests
- Input: list of all new/modified files
- Output: test report, review report, security report

### Step 4: Fix Loop
- If issues found: spawn `implementer` to fix
- Re-run review on fixed code
- Repeat until APPROVED

### Step 5: Documentation

**Grade A tasks**:
- No separate documenter — documentation included in implementation

**Grade B tasks**:
- Spawn single `documenter` — handles doc writing, report generation, AND filing

**Grade C tasks**:
- Spawn single `documenter` — handles doc writing, report generation, AND filing/indexing

### Step 6: Integration
- Implementer handles integration — no separate integrator agent
- Run full test suite
- Verify build succeeds

## Phase 5: Report & Handoff

Generate a final mission report:

```markdown
## Mission Complete: [Feature Name]

### Summary
[What was built]

### Agents Deployed
| Agent | Tasks Completed | Duration |
|-------|----------------|----------|

### Quality Results
- Tests: X/Y passing (Z% coverage)
- Review: APPROVED
- Security: PASS
- Build: SUCCESS

### Reports Filed
- [Link to code review report]
- [Link to test report]
- [Link to security audit]

### Known Limitations
[Any remaining concerns or future work]
```

## Team Scaling Guidelines

| Grade | Files | Total Agents | Parallel Implementers | Doc Agents | Estimated Tokens |
|-------|-------|-------------|----------------------|------------|-----------------|
| **S** | 1     | 0           | 0                    | 0          | ~5K (direct)    |
| **A** | 1-3   | 2           | 1                    | 0          | ~50-100K        |
| **B** | 4-15  | 4-5         | 1-3                  | 1          | ~200-400K       |
| **C** | 15+   | 5+          | 2-5                  | 1          | ~500K-1M        |

**Cost Optimization Rule**: Never use a C-grade team for a B-grade task. The coordination tax of extra agents outweighs any parallelism benefit.

## Context Management

- Each agent receives ONLY the context it needs (not the full project)
- Use `dev-standards` skill preloading for coding conventions
- File boundaries prevent context contamination
- Reports are filed on disk, not passed through context

## Error Recovery

### Failure Classification

| Failure Type | Detection Signal | Recovery Strategy |
|-------------|-----------------|-------------------|
| **Context Overflow** | Agent output truncated mid-task | Split task smaller, re-spawn with narrower scope |
| **Hallucination** | Agent produces incorrect output | Re-spawn with explicit file paths and constraints |
| **Timeout** | No response within expected time | Retry once, then spawn replacement |
| **Wrong Files** | Agent modifies out-of-scope files | `git checkout` affected files, re-spawn with boundaries |
| **Stuck Loop** | Agent repeats same action | Stop agent, re-spawn with different approach |

### Recovery Protocol

1. **Detect** — Monitor agent output for failure signals
2. **Preserve** — Save valid partial work (`git stash` or commit WIP)
3. **Classify** — Match failure to table above
4. **Recover** — Apply corresponding strategy
5. **Resume** — Spawn replacement with:
   - What was already completed
   - The remaining subtask only (not the full original task)
   - Why the previous attempt failed
6. **Log** — Record failure in mission report

### Escalation Rules

- **1 retry** → Acceptable for transient failures
- **2 retries** → Escalate: rethink the task decomposition
- **3+ retries** → Stop and ask the developer for guidance

### Partial Work Handling

If an agent fails mid-task:
- Valid changes → Stage and commit: `wip: partial [task]`
- Invalid changes → Revert: `git checkout -- [files]`
- Pass "completed portion" context to replacement agent

For detailed role definitions, see [references/role-catalog.md](references/role-catalog.md).
For workflow patterns, see [references/workflow-patterns.md](references/workflow-patterns.md).
