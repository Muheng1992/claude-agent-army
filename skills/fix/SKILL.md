---
name: fix
description: >
  Smart problem resolution skill. Analyzes errors, bugs, and issues to determine
  root cause, then dynamically selects the right agents to fix the problem.
  Handles build failures, test failures, runtime errors, security vulnerabilities,
  and architectural violations.
---

# Fix — Smart Problem Resolution

Analyze problems, identify root causes, and orchestrate the right agents to resolve them. This skill acts as a diagnostic triage system.

## Usage

```
/fix [error message, bug description, or issue reference]
```

## Phase 1: Problem Intake

Gather all available information about the problem:

1. **Error Message**: Capture the full error output (stack trace, error code, message)
2. **Context**: When does it occur? (build, test, runtime, deployment)
3. **Reproduction**: Steps to reproduce, or conditions that trigger the issue
4. **Scope**: Which files, modules, or layers are involved?
5. **Recent Changes**: Check `git log --oneline -10` and `git diff` for recent modifications

## Phase 2: Diagnosis

Classify the problem and identify root cause:

### Problem Classification

| Category | Indicators | Primary Agent |
|----------|-----------|---------------|
| **Build Error** | Compilation failure, import errors, missing deps | `implementer` |
| **Test Failure** | Assertion errors, test timeout, coverage drop | `tester` |
| **Runtime Bug** | Unexpected behavior, crash, wrong output | `implementer` |
| **Security Issue** | Vulnerability report, OWASP finding, auth bypass | `tester` → `implementer` |
| **Architecture Violation** | Layer dependency violation, circular import | `architect` → `implementer` |
| **Performance Issue** | Slow queries, memory leak, high latency | `architect` → `implementer` |
| **Integration Failure** | API mismatch, data format error, connection refused | `implementer` |
| **Documentation Gap** | Missing/outdated docs, wrong API description | `documenter` |

### Root Cause Analysis

Use the **5 Whys** technique:
1. **Why** did the error occur? → Direct cause
2. **Why** did that happen? → Contributing factor
3. **Why** was that possible? → Systemic issue
4. **Why** wasn't it caught? → Testing/review gap
5. **Why** wasn't it prevented? → Process/design gap

### Diagnostic Commands

Run these as appropriate:
```bash
# Build errors
npm run build 2>&1 | tail -50
# or: cargo build 2>&1, go build ./..., etc.

# Test failures
npm test 2>&1 | tail -100
# Look for: FAIL, Error, AssertionError

# Dependency issues
npm ls --depth=0 2>&1 | grep -i "err\|missing\|invalid"

# Recent changes that might have caused the issue
git log --oneline -10
git diff HEAD~3 --stat
```

## Phase 3: Resolution Strategy

Based on the diagnosis, create a resolution plan:

### Single-Agent Fix
For straightforward problems with clear root cause:
1. Identify the exact file(s) and line(s) to change
2. Spawn the appropriate agent with precise instructions
3. Verify the fix resolves the problem

### Multi-Agent Fix
For complex problems spanning multiple concerns:
1. Spawn `architect` to analyze impact and design fix approach
2. Spawn `implementer` to apply the code changes
3. Spawn `tester` to verify fix and add regression tests
4. Spawn `tester` to review code and check fix quality

### Fix Priority Matrix

| Severity | Impact | Action |
|----------|--------|--------|
| **CRITICAL** | System down, data loss, security breach | Fix immediately, skip ceremony |
| **HIGH** | Feature broken, tests failing, build broken | Fix before any new work |
| **MEDIUM** | Degraded performance, edge case bug | Schedule in current sprint |
| **LOW** | Cosmetic, minor inconvenience | Add to backlog |

## Phase 4: Fix Execution

### Pre-Fix Checklist
- [ ] Root cause identified and documented
- [ ] Fix approach determined
- [ ] Affected files listed
- [ ] Regression risk assessed

### Fix Process
1. **Create a regression test** that reproduces the bug (RED — it should fail)
2. **Apply the fix** (GREEN — test should pass)
3. **Run full test suite** to check for regressions
4. **Review** the fix for quality and completeness

### Post-Fix Verification
- [ ] Original error no longer occurs
- [ ] Regression test passes
- [ ] All existing tests still pass
- [ ] No new warnings or issues introduced
- [ ] Fix follows Clean Architecture rules

## Phase 5: Report & Learn

### Fix Report Format

```markdown
# Fix Report

**Date**: YYYY-MM-DD HH:MM
**Issue**: [brief description]
**Severity**: CRITICAL | HIGH | MEDIUM | LOW
**Category**: [from classification table]

## Problem
[Full error message or bug description]

## Root Cause
[5 Whys analysis result — the actual root cause]

## Fix Applied
| File | Change | Reason |
|------|--------|--------|
| [path] | [what changed] | [why] |

## Agents Involved
| Agent | Task | Outcome |
|-------|------|---------|
| [agent] | [what they did] | [result] |

## Verification
- [ ] Regression test added: [test file:test name]
- [ ] All tests pass: [X/Y passed]
- [ ] Build succeeds: Yes/No
- [ ] No new issues: Yes/No

## Prevention
[What should be done to prevent this class of bug in the future?]
- [ ] [Action item 1]
- [ ] [Action item 2]
```

### Report Filing

File the fix report at:
```
docs/reports/fix/YYYY-MM-DD-[issue-slug]-fix-report.md
```

Update `docs/INDEX.md` with the new report entry.

## Quick Reference

| Phase | Input | Output |
|-------|-------|--------|
| 1. Intake | Error/bug report | Structured problem description |
| 2. Diagnosis | Problem details | Root cause + classification |
| 3. Strategy | Root cause | Resolution plan + agent assignment |
| 4. Execution | Plan | Applied fix + verification |
| 5. Report | Fix results | Filed report + prevention items |
