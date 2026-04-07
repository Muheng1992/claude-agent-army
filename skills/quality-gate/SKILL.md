---
name: quality-gate
description: >
  Quality assurance checkpoint. Use after implementation to run a comprehensive
  quality check covering code review, test verification, security scan, documentation
  check, and Clean Architecture compliance. Blocks merge until all gates pass.
  Generates a quality report that is filed by the documenter.
disable-model-invocation: true
---

# Quality Gate Checkpoint

Run a comprehensive quality check on recent changes. All gates must pass before the work is considered complete.

## Usage

```
/quality-gate [scope: file path, feature name, or "all"]
```

## Gate 1: Build Verification

1. Run the project's build command
2. Check for compilation/type errors
3. Report: PASS / FAIL with error details

## Gate 2: Test Verification

### 2a: Unit Tests
1. Run the full unit test suite
2. Check for failures and regressions
3. Measure coverage for changed files

### 2b: Integration Tests
1. Check if integration tests exist for changed modules
2. Run integration tests (component integration + service integration)
3. Verify cross-layer interactions are covered
4. Run E2E scenarios for affected user journeys (if applicable)

Report: PASS / FAIL with details

Minimum requirements:
- All existing unit tests pass
- New code has ≥ 80% unit test coverage
- No test files without assertions
- Integration tests exist for cross-module boundaries
- All integration tests pass (no skipped without justification)

## Gate 3: Code Review

Spawn `tester` agent (or use subagent) to check:

1. **Clean Architecture Compliance**
   - Dependencies point inward only
   - No domain imports from infrastructure
   - Ports (interfaces) defined in application layer
   - No framework leakage into domain

2. **Code Quality**
   - Functions ≤ 50 lines
   - Files ≤ 300 lines
   - Naming follows conventions
   - No code duplication (DRY)

3. **Error Handling**
   - Validation at boundaries
   - Typed errors used
   - No swallowed errors

Report: PASS / NEEDS_ATTENTION with findings

## Gate 4: Security Scan

The `tester` agent also checks:

1. No hardcoded secrets
2. Input validation present
3. No SQL injection vectors
4. No XSS vectors
5. Dependencies have no known CVEs

Report: PASS / FAIL with severity levels

## Gate 5: Documentation Check

1. Public APIs have documentation
2. README is current (if applicable)
3. Architecture decisions documented
4. Inline comments follow WHY-not-WHAT convention

Report: PASS / NEEDS_ATTENTION

## Gate 6: Clean Architecture Audit

Specific checks for Clean Architecture compliance:

```
✓ Domain layer has no external imports
✓ Use cases depend only on ports (interfaces)
✓ Adapters implement ports correctly
✓ No circular dependencies
✓ DI container wires everything at composition root
✓ DTOs used at boundaries (no entity leakage)
```

## Execution Strategy

Run gates in parallel where possible:

```
[Gate 1: Build]  ─── must pass first ───→  [Gate 2: Tests]
                                            [Gate 3: Review]    ─── parallel
                                            [Gate 4: Security]
                                            [Gate 5: Docs]
                                            [Gate 6: Clean Arch]
```

## Output: Quality Gate Report

```markdown
# Quality Gate Report

**Date**: YYYY-MM-DD HH:MM
**Scope**: [what was checked]
**Overall**: PASS ✅ / FAIL ❌

## Results

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASS | No errors |
| Tests | ✅ PASS | 42/42 passing, 87% coverage |
| Review | ⚠️ NEEDS_ATTENTION | 2 medium issues |
| Security | ✅ PASS | No vulnerabilities |
| Docs | ✅ PASS | APIs documented |
| Clean Arch | ✅ PASS | All rules satisfied |

## Issues Requiring Attention
1. [Issue description and recommendation]

## Recommendation
[APPROVE for merge / FIX required issues first]
```

After generating, the report should be filed by the `documenter` at:
`docs/reports/quality-gate/YYYY-MM-DD-[scope]-quality-gate.md`
