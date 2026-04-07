# Workflow Patterns for Agent Army

## Pattern 1: Waterfall Pipeline

Best for: Well-understood features with clear requirements.

```
[architect] → [implementer x N] → [tester] → [implementer: merge + verify]
                                       ↓ (issues found)
                                 [implementer: fix] → [tester: re-check]
```

Steps:
1. Architect designs the solution
2. Implementers code in parallel (different files)
3. Tester writes tests, reviews code, and checks security
4. If issues: implementer fixes, tester re-checks
5. Implementer merges and verifies E2E

## Pattern 2: Parallel Quality Swarm

Best for: Thorough quality assurance of critical code changes.

```
                    ┌→ [tester: code review]      ─┐
[implementer] →     ├→ [tester: security audit]   ─┤→ [tech-lead: synthesize]
                    └→ [tester: test execution]   ─┘
```

Steps:
1. Implementer completes the feature
2. Multiple tester instances analyze in parallel (review, security, testing)
3. Tech lead synthesizes all findings
4. Implementer addresses feedback
5. Quick re-check round

## Pattern 3: Research-First Development

Best for: Unfamiliar codebases or technologies.

```
[Explore agents x 3] → [architect] → [implementer] → [tester]
```

Steps:
1. Three Explore agents investigate different aspects simultaneously
2. Architect uses research to design solution
3. Implementation follows
4. Tester handles testing, review, and security in one pass

## Pattern 4: TDD (Test-Driven Development)

Best for: Core business logic with clear specifications.

```
[architect: interface] → [tester: write tests] → [implementer: make tests pass] → [tester: verify]
```

Steps:
1. Architect defines interfaces and contracts
2. Tester writes tests based on contracts
3. Implementer writes code to pass tests
4. Tester verifies quality, reviews code, and checks security

## Pattern 5: Full Team Deployment

Best for: Large features spanning multiple modules.

```
Phase 1: [architect] designs                          ─── sequential
Phase 2: [implementer x 3-5] code in parallel        ─── parallel
Phase 3: [tester x 1-2] test + review + security     ─── parallel
Phase 4: [implementer] fixes from Phase 3             ─── sequential
Phase 5: [implementer] merges + final verification    ─── sequential
Phase 6: [documenter] docs + reports + filing         ─── sequential
```

## Pattern 6: Batch Migration

Best for: Large-scale codebase changes (framework migration, API updates).

```
[architect: plan] → /batch [migration instruction]
                     ├→ [worker-1 in worktree] → PR
                     ├→ [worker-2 in worktree] → PR
                     ├→ [worker-3 in worktree] → PR
                     └→ [worker-N in worktree] → PR
```

Uses Claude Code `/batch` command to auto-decompose into 5-30 independent units, each running in an isolated git worktree.

## Pattern 7: Continuous Review Loop

Best for: Iterative refinement of complex implementations.

```
[implementer] → [tester] → [implementer: fix] → [tester: re-check]
     ↑                                                    |
     └──────────── (until APPROVED) ──────────────────────┘
```

Max iterations: 3. If not approved after 3 rounds, escalate to user.

## Pattern 8: Documentation-Driven Development

Best for: API-first or documentation-heavy features.

```
[documenter: write API docs] → [architect: design from docs] → [implementer] → [tester]
```

Steps:
1. Document the desired API and behavior first
2. Architect designs to match documentation
3. Implementation follows the documented contract
4. Tester verifies documented behavior

## Context Passing Strategy

### Between Sequential Agents
```
Agent A completes → Summary written to task description
Agent B starts → Reads task description + relevant files
```

### For Parallel Agents
```
Tech Lead creates tasks → Each task has full context in description
Agents claim tasks → Read task description for context
Agents complete → Update task status + write results
```

### Context Budget Guidelines
- Spawn prompt: 500-2000 tokens (focused context)
- Preloaded skills: ~5000 tokens (shared conventions)
- Agent memory: Grows over sessions (institutional knowledge)
- File reads: On-demand (only what's needed)

## Anti-Patterns

### Don't: Share files between parallel agents
Two agents editing the same file = overwrites.
DO: Assign non-overlapping file sets.

### Don't: Pass full codebase context to every agent
Context overflow = poor performance.
DO: Provide focused context per task.

### Don't: Skip the quality check
Untested and unreviewed code = tech debt.
DO: Always run tester before integration.

### Don't: Run all agents sequentially
Sequential = slow, no parallelism benefit.
DO: Identify independent tasks and run in parallel.
