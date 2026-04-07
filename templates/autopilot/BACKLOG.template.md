# Autopilot Backlog

> **Generated**: {{DATE}}
> **Source**: {{SOURCE_DESCRIPTION}}
> **Total tasks**: {{TASK_COUNT}}
> **Estimated duration**: {{ESTIMATED_DURATION}}

---

## Project Context

{{PROJECT_CONTEXT}}

### Quality Standards
- Clean Architecture compliance: **MANDATORY**
- Test coverage target: **≥ 80%**
- Code review: **Required before merge**
- Documentation: **Update as you go**

### Acceptance Criteria (Global)
- [ ] All tests pass
- [ ] Code follows project conventions (see `dev-standards`)
- [ ] Documentation updated
- [ ] `/quality-gate` check passes

---

## Task List

### Phase 1: Foundation

#### T01: {{TASK_TITLE}}
- **Status**: `[ ]` Pending
- **Description**: {{TASK_DESCRIPTION}}
- **Files to modify**:
  - {{FILE_PATH_1}}
  - {{FILE_PATH_2}}
- **Acceptance criteria**:
  - {{ACCEPTANCE_CRITERION_1}}
  - {{ACCEPTANCE_CRITERION_2}}
- **Dependencies**: None
- **Estimated effort**: {{EFFORT_ESTIMATE}}

#### T02: {{TASK_TITLE}}
- **Status**: `[ ]` Pending
- **Description**: {{TASK_DESCRIPTION}}
- **Files to modify**:
  - {{FILE_PATH_1}}
- **Acceptance criteria**:
  - {{ACCEPTANCE_CRITERION_1}}
- **Dependencies**: T01
- **Estimated effort**: {{EFFORT_ESTIMATE}}

---

### Phase 2: Core Implementation

#### T03: {{TASK_TITLE}}
- **Status**: `[ ]` Pending
- **Description**: {{TASK_DESCRIPTION}}
- **Files to modify**:
  - {{FILE_PATH_1}}
  - {{FILE_PATH_2}}
- **Acceptance criteria**:
  - {{ACCEPTANCE_CRITERION_1}}
  - {{ACCEPTANCE_CRITERION_2}}
  - {{ACCEPTANCE_CRITERION_3}}
- **Dependencies**: T01, T02
- **Estimated effort**: {{EFFORT_ESTIMATE}}

#### T04: {{TASK_TITLE}}
- **Status**: `[ ]` Pending
- **Description**: {{TASK_DESCRIPTION}}
- **Files to modify**:
  - {{FILE_PATH_1}}
- **Acceptance criteria**:
  - {{ACCEPTANCE_CRITERION_1}}
- **Dependencies**: T03
- **Estimated effort**: {{EFFORT_ESTIMATE}}

---

### Phase 3: Testing & Quality Assurance

#### T{{N-2}}: Add unit tests
- **Status**: `[ ]` Pending
- **Description**: Add comprehensive unit tests for all new code
- **Files to create**:
  - {{TEST_FILE_1}}
  - {{TEST_FILE_2}}
- **Acceptance criteria**:
  - Unit tests for domain layer (≥ 90% coverage)
  - Integration tests for adapters
  - All edge cases covered
  - Tests pass in CI
- **Dependencies**: All implementation tasks
- **Estimated effort**: {{EFFORT_ESTIMATE}}

#### T{{N-1}}: Documentation update
- **Status**: `[ ]` Pending
- **Description**: Update all relevant documentation
- **Files to modify**:
  - `README.md` (if API changed)
  - `docs/INDEX.md` (add new docs)
  - Inline code comments (WHY, CONTEXT, AI-BOUNDARY)
- **Acceptance criteria**:
  - API changes documented
  - Architecture diagrams updated (if needed)
  - Examples provided
- **Dependencies**: All implementation tasks
- **Estimated effort**: {{EFFORT_ESTIMATE}}

#### T{{N}}: Run quality gate
- **Status**: `[ ]` Pending
- **Description**: Final quality checkpoint before merge
- **Command**: `/quality-gate all`
- **Acceptance criteria**:
  - All tests pass (unit + integration)
  - No security vulnerabilities
  - Code review approved
  - Clean Architecture validation passes
  - No linting errors
  - Documentation complete
- **Dependencies**: All previous tasks
- **Estimated effort**: 10 minutes (automated)

---

## Status Legend

| Symbol | Meaning | When to Use |
|--------|---------|-------------|
| `[ ]` | Pending | Task not started |
| `[~]` | In Progress | Currently working on this |
| `[x]` | Done | Task completed successfully |
| `[!]` | Failed | Task failed, will not retry |
| `[-]` | Skipped | Task skipped intentionally |
| `[?]` | Blocked | Waiting for dependency or external input |

---

## Execution Log

### 2026-03-06 14:30 - Session 1
- Started: T01
- Completed: T01
- Notes: Foundation task completed without issues

### 2026-03-06 15:00 - Session 2
- Started: T02
- Status: In progress
- Notes: Encountered issue with {{ISSUE_DESCRIPTION}}, investigating...

---

## Notes for Future Sessions

### Context to Remember
- {{IMPORTANT_DECISION_1}}
- {{IMPORTANT_DECISION_2}}

### Known Issues
- {{KNOWN_ISSUE_1}}
- {{KNOWN_ISSUE_2}}

### Next Steps
When resuming:
1. Load this BACKLOG.md
2. Check execution log for last completed task
3. Continue from next pending task
4. Update status and log as you go

---

*This backlog is designed for Ralph Loop autopilot mode. Update status after each task completion.*
