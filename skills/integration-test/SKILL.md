---
name: integration-test
description: >
  Integration testing orchestrator. Use when setting up integration test infrastructure,
  designing cross-module test scenarios, running E2E tests, or verifying component
  interactions. Coordinates test environment setup, scenario execution, and result analysis.
disable-model-invocation: true
---

# Integration Test Orchestrator

Design, set up, execute, and report on integration tests across all architecture layers. This skill guides a structured 5-phase process from scope analysis to result reporting.

## Usage

```
/integration-test [scope: module name, feature name, or "all"]
```

## Phase 1: Test Scope Analysis

Identify integration boundaries and dependencies before writing any tests.

1. **Map Component Boundaries** — List all modules involved and their interaction points
2. **Identify External Dependencies** — Database, APIs, message queues, file systems, third-party services
3. **Classify Integration Types**:
   - Component Integration (in-process, same layer)
   - Service Integration (cross-layer, cross-process)
   - E2E (full user journey, all layers)
4. **Review Existing Tests** — Check what integration coverage already exists
5. **Define Test Scope** — Prioritize based on risk, complexity, and business criticality

Output of Phase 1:
```markdown
### Integration Scope
- Modules: [list]
- Boundaries: [list of interaction points]
- External Dependencies: [list]
- Existing Coverage: [summary]
- Priority Order: [ranked list]
```

## Phase 2: Environment Setup

Configure the test infrastructure before writing test scenarios.

### Test Database
- Set up isolated test database (in-memory SQLite, Docker Postgres, etc.)
- Create migration/seed scripts for test data
- Ensure each test run starts with clean state

### Mock External Services
- Stub third-party APIs at the adapter layer
- Use contract tests where possible (consumer-driven contracts)
- Never mock domain logic — only external boundaries

### Test Containers (when applicable)
- Define containerized dependencies (DB, Redis, message broker)
- Configure startup/shutdown lifecycle
- Set timeout and health check strategies

### Fixtures & Test Data
- Create test data factories (not hardcoded fixtures)
- Define minimal but representative seed data
- Ensure data covers happy path, edge cases, and error scenarios

Output of Phase 2:
```markdown
### Environment Configuration
- Test DB: [type and setup method]
- Mocked Services: [list with stub strategy]
- Containers: [list if used]
- Fixtures: [factory location and pattern]
```

## Phase 3: Scenario Design

Design integration tests at three levels, following Clean Architecture layer mapping.

### Level 1: Component Integration

Test interactions between 2+ modules within the same layer or adjacent layers.

```
Domain Layer      → Unit Tests (already covered by tester)
Application Layer → Use Case + Port interaction tests
```

- Verify use cases correctly orchestrate domain entities
- Verify port interfaces are called with correct parameters
- Test data transformation between layers

### Level 2: Service Integration

Test cross-layer interactions with real (test) infrastructure.

```
Adapter Layer → Real DB queries, real HTTP calls (to test server)
```

- **Database Integration**: Repository implementations against real test DB
- **API Integration**: HTTP endpoint tests with request/response validation
- **External Service Integration**: Contract tests or stub-verified calls
- **Message Queue Integration**: Publish/subscribe verification (if applicable)

### Level 3: E2E Scenarios

Test complete user journeys across all layers.

Design patterns:
1. **User Journey** — Complete workflow: register → login → action → verify
2. **Critical Path** — Revenue-critical or safety-critical flows
3. **Error Recovery** — Network failure, timeout, invalid state → graceful degradation
4. **Data Consistency** — Verify data integrity across all persistence points

E2E Scenario Template:
```markdown
**Scenario**: [name]
**Preconditions**: [required state]
**Steps**:
1. [action]
2. [action]
3. [action]
**Expected Result**: [outcome]
**Cleanup**: [teardown steps]
```

## Phase 4: Test Execution

### Execution Strategy

1. **Run Order**: Component Integration → Service Integration → E2E
2. **Parallelism**: Component tests can run in parallel; E2E tests run sequentially
3. **Failure Handling**:
   - Component/Service failures: continue running, collect all failures
   - E2E failures: stop on first failure (dependent steps won't pass)
4. **Retry Policy**: Flaky tests get ONE retry; persistent failures are real failures

### Running Tests

1. Detect the project's test runner and integration test configuration
2. Run component integration tests first (fastest feedback)
3. Run service integration tests (requires environment)
4. Run E2E scenarios last (slowest, most comprehensive)
5. Collect results from all levels

### Failure Triage

When tests fail, classify the failure:

| Category | Action |
|----------|--------|
| **Test Bug** | Fix the test, not the code |
| **Environment Issue** | Fix setup/teardown, not the code |
| **Real Bug** | Report to implementer with reproduction steps |
| **Flaky Test** | Add retry + investigate root cause |

## Phase 5: Result Analysis & Report

Generate a comprehensive integration test report and file it.

### Report Template

```markdown
# Integration Test Report

**Date**: YYYY-MM-DD HH:MM
**Scope**: [what was tested]
**Environment**: [test environment details]

## Summary

| Level | Total | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| Component Integration | X | X | X | X |
| Service Integration | X | X | X | X |
| E2E Scenarios | X | X | X | X |
| **Total** | **X** | **X** | **X** | **X** |

## Component Integration Results
- [module-a ↔ module-b]: PASS/FAIL — [details]

## Service Integration Results
- [API endpoint / DB operation]: PASS/FAIL — [details]

## E2E Scenario Results
- [scenario name]: PASS/FAIL — [details]

## Failures & Root Causes
1. [failure description] — Category: [test bug/env issue/real bug/flaky]
   - Root cause: [analysis]
   - Action: [fix/report/investigate]

## Coverage Gaps
- [untested boundary]: [recommendation]

## Recommendations
- [actionable next steps]
```

### Report Filing

File the report via `documenter` or directly at:
```
docs/reports/test/YYYY-MM-DD-[scope]-integration-test-report.md
```

## Quick Reference

| Phase | Input | Output |
|-------|-------|--------|
| 1. Scope Analysis | Code + architecture | Boundary map, priority list |
| 2. Environment Setup | Dependencies | Configured test infrastructure |
| 3. Scenario Design | Boundaries + requirements | Test scenarios at 3 levels |
| 4. Test Execution | Scenarios + environment | Test results |
| 5. Result Analysis | Test results | Filed report with recommendations |
