---
name: tdd
description: >
  TDD (Test-Driven Development) enforcement skill. Guides the Red-Green-Refactor
  cycle with strict phase gates. Ensures tests are written BEFORE implementation
  code, preventing the common anti-pattern of writing tests after the fact.
---

# TDD — Test-Driven Development Enforcer

Enforce the Red-Green-Refactor cycle as a strict development discipline. Tests come first, always.

## Usage

```
/tdd [feature or function description]
```

## The TDD Cycle

```
┌─────────┐     ┌─────────┐     ┌──────────┐
│  🔴 RED  │ ──→ │ 🟢 GREEN │ ──→ │ 🔵 REFACTOR│
│Write test│     │Make pass │     │Clean up   │
│that fails│     │minimally │     │keep green │
└─────────┘     └─────────┘     └──────────┘
      ↑                                │
      └────────────────────────────────┘
```

## Phase 1: RED — Write a Failing Test

**Goal**: Define the expected behavior BEFORE writing any implementation.

### Rules
- Write ONE test at a time
- The test MUST fail (if it passes, the test is wrong or the feature already exists)
- Test the PUBLIC interface, not internal details
- Use descriptive names: `should [behavior] when [condition]`

### Process
1. Understand the requirement or function spec
2. Write a test that exercises the expected behavior
3. Run the test — it MUST fail with a meaningful error
4. If it passes: investigate why (existing code? wrong assertion?)

### Gate Check
```
[ ] Test written?
[ ] Test runs?
[ ] Test FAILS with expected error?
→ If all YES: proceed to GREEN
→ If test passes: STOP — investigate before continuing
```

## Phase 2: GREEN — Make the Test Pass

**Goal**: Write the MINIMUM code to make the test pass. Nothing more.

### Rules
- Write ONLY enough code to make the failing test pass
- Do NOT add extra features, edge cases, or "nice to have" logic
- Do NOT refactor yet — ugly code is fine at this stage
- Do NOT write additional tests yet
- Hardcoding is acceptable if it makes the test pass (will be caught in next RED phase)

### Process
1. Write the simplest implementation that satisfies the test
2. Run the test — it MUST pass
3. Run ALL existing tests — they MUST all still pass (no regressions)

### Gate Check
```
[ ] New test passes?
[ ] All existing tests still pass?
[ ] No more code than necessary?
→ If all YES: proceed to REFACTOR
→ If tests fail: fix implementation (stay in GREEN)
```

## Phase 3: REFACTOR — Clean Up While Green

**Goal**: Improve code quality WITHOUT changing behavior. Tests stay green throughout.

### Rules
- All tests MUST remain passing after each refactoring step
- Improve readability, remove duplication, apply patterns
- Refactor BOTH test code AND implementation code
- Run tests after EVERY change — if a test breaks, undo immediately
- Do NOT add new behavior during refactor

### Refactoring Checklist
- [ ] Remove code duplication (DRY)
- [ ] Improve naming (variables, functions, classes)
- [ ] Extract methods if function is too long (>50 lines)
- [ ] Apply Clean Architecture layer rules
- [ ] Simplify complex conditionals
- [ ] Remove dead code

### Gate Check
```
[ ] All tests still pass?
[ ] Code is cleaner than before?
[ ] No new behavior added?
→ If all YES: return to RED for next test
→ If tests broke: UNDO last change, try different refactor
```

## Cycle Continuation

After one RED-GREEN-REFACTOR cycle:

1. **Identify next behavior** to implement
2. **Start RED** — write the next failing test
3. Repeat until the feature is complete

### Feature Completion Checklist
- [ ] All happy path behaviors tested and implemented
- [ ] Edge cases covered (empty, null, boundary values)
- [ ] Error cases handled (invalid input, failures)
- [ ] All tests pass
- [ ] Code is clean and well-factored
- [ ] Coverage ≥ 80% for new code

## Anti-Patterns to Prevent

| Anti-Pattern | Why It's Wrong | What To Do Instead |
|-------------|---------------|-------------------|
| Writing code first, tests after | Tests become confirmation bias | Always RED first |
| Writing multiple tests at once | Loses the tight feedback loop | One test per cycle |
| Making test pass with too much code | Over-engineering in GREEN | Minimum code only |
| Skipping REFACTOR | Technical debt accumulates | Always clean up |
| Refactoring while RED | No safety net for changes | Get to GREEN first |
| Testing private methods | Couples tests to implementation | Test public API only |

## Integration with Agent Army

### For Tester Agent
When the tester agent has this skill loaded:
- Start every implementation task with the RED phase
- Coordinate with implementer: tester writes test (RED), implementer makes it pass (GREEN)
- Both collaborate on REFACTOR

### For Implementer Agent
If asked to implement a feature with TDD:
1. Ask tester for failing tests first, OR
2. Write the failing test yourself (RED)
3. Then implement minimally (GREEN)
4. Then clean up (REFACTOR)

### Report Format
```markdown
## TDD Cycle Report

**Feature**: [what was developed]
**Cycles Completed**: N

| Cycle | Test Name | RED (fail?) | GREEN (pass?) | REFACTOR |
|-------|-----------|------------|--------------|----------|
| 1 | should X when Y | Yes | Yes | Extracted method |
| 2 | should A when B | Yes | Yes | Renamed vars |
| ... | ... | ... | ... | ... |

**Final Coverage**: X%
**All Tests Pass**: Yes/No
```
