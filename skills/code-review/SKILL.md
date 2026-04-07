---
name: code-review
description: >
  Code review orchestrator. Use when reviewing code changes for quality, security,
  performance, and Clean Architecture compliance. Automates diff analysis, multi-dimensional
  review, structured reporting, and report archival.
disable-model-invocation: true
---

# Code Review Orchestrator

Run a structured, multi-dimensional code review on recent changes. This skill guides a 4-phase process from diff analysis to report archival.

## Usage

```
/code-review [scope: file path, branch, PR number, or "staged"]
```

Scope options:
- **File path**: Review a specific file or directory
- **Branch**: Compare current branch against base (e.g., `main`)
- **PR number**: Review a pull request (requires `gh` CLI)
- **`staged`**: Review currently staged changes
- **`HEAD~N`**: Review the last N commits

## Phase 1: Diff Analysis

Automatically gather and understand the changes before reviewing.

1. **Collect Changes** — Run `git diff` for the specified scope
2. **Classify Change Types**:
   - New files (feature additions)
   - Modified files (enhancements, bug fixes, refactors)
   - Deleted files (removals)
   - Renamed/moved files (restructuring)
3. **Map Affected Layers** — Identify which Clean Architecture layers are touched:
   - Domain (entities, value objects, domain events)
   - Application (use cases, ports, DTOs)
   - Adapters (controllers, repository implementations)
   - Infrastructure (config, DI, server setup)
4. **Identify Review Focus** — Prioritize files by risk:
   - Security-sensitive files (auth, input handling, crypto)
   - Core business logic (domain layer)
   - Public API surface (endpoints, interfaces)
   - Configuration changes (env, CI/CD, dependencies)

Output of Phase 1:
```markdown
### Diff Summary
- Files changed: X (added: X, modified: X, deleted: X)
- Lines: +X / -X
- Layers affected: [list]
- High-risk files: [list with reason]
```

## Phase 2: Multi-Dimensional Review

Review changes across five dimensions. Spawn `tester` agent or execute directly.

### Dimension 1: Clean Architecture Compliance

| Check | Rule |
|-------|------|
| Dependency direction | Dependencies point inward only |
| Domain purity | No framework imports in domain layer |
| Port isolation | Use cases depend on ports (interfaces), not implementations |
| Entity containment | Entities never leak outside domain boundary |
| Adapter correctness | Adapters implement ports from application layer |
| Composition root | DI wiring only in infrastructure layer |

### Dimension 2: Code Quality

| Check | Standard |
|-------|----------|
| File length | ≤ 300 lines |
| Function length | ≤ 50 lines |
| Parameters | ≤ 4 per function (use object parameter for more) |
| Nesting depth | ≤ 3 levels |
| Naming | kebab-case files, PascalCase types, camelCase functions |
| DRY | No significant code duplication |
| Single Responsibility | Each function/class does one thing |

### Dimension 3: Security

Based on OWASP Top 10:

- [ ] Input validation at system boundaries
- [ ] No hardcoded secrets or credentials
- [ ] Parameterized queries (no SQL injection)
- [ ] Output encoding (no XSS)
- [ ] Auth/authz checks on protected resources
- [ ] No sensitive data in logs or error messages
- [ ] Dependency versions without known CVEs

### Dimension 4: Performance

- [ ] No N+1 query patterns
- [ ] No unnecessary allocations in loops
- [ ] Appropriate data structures for the use case
- [ ] No blocking operations in hot paths
- [ ] Pagination for list endpoints
- [ ] Proper indexing for queried fields

### Dimension 5: Testability & Maintainability

- [ ] New code has corresponding tests
- [ ] Code is testable (no hidden dependencies, injectable services)
- [ ] AI-friendly structure (clear, explicit, well-typed)
- [ ] Strategic comments for non-obvious logic (WHY, not WHAT)
- [ ] Consistent with existing codebase patterns

## Phase 3: Structured Report

Generate a severity-classified review report.

### Severity Levels

| Level | Criteria | Action |
|-------|----------|--------|
| **CRITICAL** | Security vulnerability, data loss risk, correctness bug | Must fix before merge |
| **HIGH** | Performance issue, missing error handling, architecture violation | Should fix |
| **MEDIUM** | Code clarity, naming, pattern adherence | Recommend fixing |
| **LOW** | Style preference, minor optimization | Optional |

### Report Template

```markdown
# Code Review Report

**Date**: YYYY-MM-DD HH:MM
**Scope**: [what was reviewed]
**Reviewer**: tester agent
**Overall**: APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION

## Diff Summary
- Files changed: X (added: X, modified: X, deleted: X)
- Lines: +X / -X
- Layers affected: [list]

## Review Results

| Dimension | Status | Findings |
|-----------|--------|----------|
| Clean Architecture | PASS/FAIL | X issues |
| Code Quality | PASS/FAIL | X issues |
| Security | PASS/FAIL | X issues |
| Performance | PASS/FAIL | X issues |
| Testability | PASS/FAIL | X issues |

## Critical Issues (must fix)
1. **[file:line]**: [description]
   - **Why**: [impact]
   - **Fix**: [suggestion]

## High Priority
1. ...

## Medium Priority
1. ...

## Low Priority
1. ...

## Positive Observations
- [well-written code patterns to reinforce]

## Recommendation
[APPROVE for merge / FIX required issues first / DISCUSS design decisions]
```

## Phase 4: Report Filing

File the report for historical preservation.

1. Generate the report using the template above
2. File via `documenter` or directly at:
   ```
   docs/reports/code-review/YYYY-MM-DD-[scope]-review-report.md
   ```
3. Update `docs/INDEX.md` if documenter is available

## Quick Reference

| Phase | Input | Output |
|-------|-------|--------|
| 1. Diff Analysis | Scope (files/branch/PR) | Change summary, risk map |
| 2. Multi-Dimensional Review | Code changes | Findings by dimension |
| 3. Structured Report | Findings | Severity-classified report |
| 4. Report Filing | Report | Archived in `docs/reports/code-review/` |
