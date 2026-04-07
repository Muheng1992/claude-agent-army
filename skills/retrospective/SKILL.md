---
name: retrospective
description: >
  Mission retrospective and self-improvement. Use after completing a development
  mission (assemble, sprint, or any multi-agent task) to analyze what worked,
  what failed, and capture learnings for future improvement.
---

# Mission Retrospective

You are conducting a structured retrospective after a development mission. Your goal is to extract actionable learnings and update agent memory for continuous improvement.

## Phase 1: Data Collection

Gather evidence from the completed mission:

1. **Read** recent reports in `docs/reports/` (code-review, test, security, fix, integration)
2. **Read** any plan files in `docs/reports/plans/`
3. **Check** git log for the mission's commits
4. **Identify** all agents that participated and their outputs

## Phase 2: Analysis

Analyze the mission across five dimensions:

### 2.1 Execution Efficiency
- How many agents were spawned vs actually needed?
- Were there idle agents or redundant work?
- Did parallel execution work smoothly, or were there conflicts?
- Estimated token usage: was the model tiering effective?

### 2.2 Quality Outcomes
- How many issues did the tester find during review?
- How many security findings from the auditor?
- How many fix iterations were needed before approval?
- Did the quality gate pass on the first attempt?

### 2.3 Architecture Compliance
- Were Clean Architecture rules followed?
- Did any dependency violations occur?
- Was the design phase adequate, or did implementation deviate?

### 2.4 Communication & Coordination
- Did agents have clear task boundaries?
- Were there file conflicts or scope overlaps?
- Did the tech-lead effectively delegate vs self-implement?
- Were quality reviews constructive and actionable?

### 2.5 Plan Accuracy
- Did the original plan match the actual execution?
- What was the plan completion rate?
- Were there unplanned tasks that emerged?
- Were any plan steps skipped or modified?

## Phase 3: Pattern Recognition

Identify recurring patterns:

### Success Patterns (What Worked)
- Techniques that should be repeated
- Agent configurations that were effective
- Context management strategies that saved tokens

### Failure Patterns (What Didn't Work)
- Common mistakes across missions
- Bottlenecks or inefficiencies
- Anti-patterns that keep recurring

### Friction Points
- Steps that required excessive human intervention
- Agent handoffs that were problematic
- Tool limitations encountered

## Phase 4: Actionable Improvements

Generate specific, actionable recommendations:

1. **Agent Configuration Changes**: Suggest modifications to agent definitions
2. **Skill Improvements**: Recommend updates to skill instructions
3. **Process Changes**: Propose workflow optimizations
4. **Knowledge Gaps**: Identify areas where agents need more context

## Phase 5: Memory Update

Update agent memory files with learnings:

1. Read existing agent memory files in `.claude/agent-memory/`
2. Append new learnings (do not overwrite existing knowledge)
3. If patterns are confirmed across multiple missions, promote to "established patterns"
4. If previous learnings proved wrong, mark as "revised" with explanation

## Output Format

```markdown
# Mission Retrospective Report

**Date**: YYYY-MM-DD
**Mission**: [Mission name/description]
**Duration**: [Estimated duration]
**Agents Deployed**: [Count and list]

## Executive Summary
[2-3 sentences: overall assessment]

## Metrics
| Metric | Value | Assessment |
|--------|-------|-----------|
| Agents spawned | N | Optimal / Over / Under |
| Fix iterations | N | Good (<2) / Acceptable (2-3) / Poor (>3) |
| Plan completion | N% | Full / Partial / Major deviation |
| Quality gate | Pass/Fail | First attempt / Required fixes |
| Adversarial findings | N | [Summary of cross-review value] |

## What Worked Well
1. [Pattern] — [Evidence]

## What Needs Improvement
1. [Issue] — [Root cause] — [Suggested fix]

## Action Items
| # | Action | Target | Priority |
|---|--------|--------|----------|
| 1 | [Specific change] | [Agent/Skill/Process] | HIGH/MED/LOW |

## Knowledge Updates
| Memory File | Update Type | Content |
|------------|------------|---------|
| [agent-name]/MEMORY.md | Added/Revised | [Brief description] |

## Patterns Catalog Update
### New Patterns Identified
- [Pattern name]: [Description]

### Patterns Confirmed (seen in ≥3 missions)
- [Pattern name]: Promoted to established

### Patterns Revised
- [Pattern name]: [What changed and why]
```

File the retrospective report to `docs/reports/retrospective/YYYY-MM-DD-[mission]-retrospective.md`.
Update `docs/INDEX.md` with the new report entry.
