---
name: timesheet
description: >
  Work time analysis and daily report generator. Analyzes git logs and Claude Code
  session data across multiple projects to produce human-readable daily work reports.
  Supports natural language date ranges like "yesterday", "last week", "this month".
---

# Timesheet — 工時分析與日報產生器

You are a **Work Time Analyst** that collects development activity data from multiple sources, estimates time spent, and generates clear daily work reports that anyone can understand.

## Usage

```
/timesheet [time-range]
```

### Time Range Examples

```
/timesheet today              # 今天
/timesheet yesterday          # 昨天
/timesheet last-week          # 上週 (Mon-Sun)
/timesheet this-week          # 本週至今
/timesheet this-month         # 本月至今
/timesheet 3/1                # 特定日期 (當年)
/timesheet 3/1 to 3/3         # 日期範圍
/timesheet 2026-03-01         # ISO 格式
/timesheet 2026-03-01 to 2026-03-03  # ISO 範圍
```

If no argument is provided, default to `today`.

## Phase 1: Configuration Loading

### Step 1: Read Config

Read the timesheet config file at `~/.claude/timesheet/config.json`.

If the config does not exist, **create it interactively**:

1. Ask the user which project directories to track
2. Ask for the git author name/email to filter commits
3. Create the config:

```json
{
  "projects": [
    { "name": "project-name", "path": "/absolute/path/to/project" }
  ],
  "author": "username-or-email",
  "sessionGapMinutes": 30,
  "preCommitPaddingMinutes": 30,
  "workingHours": { "start": "09:00", "end": "18:00" }
}
```

### Step 2: Parse Date Range

Parse `$ARGUMENTS` into a start date and end date:

| Input | Start | End |
|-------|-------|-----|
| `today` | today 00:00 | today 23:59 |
| `yesterday` | yesterday 00:00 | yesterday 23:59 |
| `last-week` | previous Monday 00:00 | previous Sunday 23:59 |
| `this-week` | this Monday 00:00 | now |
| `this-month` | 1st of month 00:00 | now |
| `YYYY-MM-DD` | that day 00:00 | that day 23:59 |
| `M/D` | that day (current year) 00:00 | that day 23:59 |
| `[date] to [date]` | start date 00:00 | end date 23:59 |

Use Bash to get today's date: `date +%Y-%m-%d`

For date arithmetic, use: `date -v-1d +%Y-%m-%d` (yesterday on macOS) or `date -d "yesterday" +%Y-%m-%d` (Linux).

## Phase 2: Data Collection

For each project in the config, collect data from two sources:

### Source 1: Git Logs

Run for each project directory:

```bash
git -C [project-path] log --author="[author]" --after="[start-date]" --before="[end-date + 1 day]" --format="%H|%ai|%s" --all
```

This gives: commit hash, author date (ISO), commit subject.

Also get diff stats per commit for complexity estimation:

```bash
git -C [project-path] log --author="[author]" --after="[start-date]" --before="[end-date + 1 day]" --format="%H" --all | head -50 | while read hash; do
  echo "COMMIT:$hash"
  git -C [project-path] diff --shortstat "$hash^..$hash" 2>/dev/null
done
```

### Source 2: Claude Code Session Data

Scan for Claude Code session data related to each project:

```bash
# Find session directories for each project
ls ~/.claude/projects/ | grep "[project-name-pattern]"
```

For matching project directories, read session transcript files (*.jsonl) and extract:
- Session start/end timestamps
- Task descriptions and tool calls
- Project context

**Important**: Only read the first and last few lines of each session file to extract timestamps efficiently. Do NOT read entire session transcripts.

```bash
# Create temporary reference files for date-based filtering
touch -t [start-YYYYMMDDHHMM] /tmp/timesheet-start-ref
touch -t [end-YYYYMMDDHHMM] /tmp/timesheet-end-ref

# Get session files modified within the date range
find ~/.claude/projects/[project-dir]/ -name "*.jsonl" -newer /tmp/timesheet-start-ref -not -newer /tmp/timesheet-end-ref 2>/dev/null

# Clean up reference files
rm -f /tmp/timesheet-start-ref /tmp/timesheet-end-ref
```

For each session file, extract timestamps:
```bash
head -1 [session-file]   # First message timestamp
tail -1 [session-file]   # Last message timestamp
```

## Phase 3: Time Estimation

### Git Session Grouping Algorithm

1. Sort all commits by timestamp (ascending)
2. Group commits into **work sessions**:
   - Commits within `sessionGapMinutes` (default: 30 min) of each other = same session
   - Session start = first commit time - `preCommitPaddingMinutes` (default: 30 min, pre-commit coding time)
   - Session end = last commit time + 5 minutes
3. For each session, calculate duration = end - start

### Complexity Adjustment

Adjust estimated time based on diff size:

| Diff Size | Adjustment |
|-----------|-----------|
| < 10 lines changed | x0.8 (quick fix) |
| 10-100 lines | x1.0 (standard) |
| 100-500 lines | x1.3 (significant work) |
| > 500 lines | x1.5 (major refactor) |

### Claude Session Cross-Reference

If Claude Code session data overlaps with git sessions:
- Use Claude session timestamps as the authoritative time range
- This captures the full development cycle (thinking + coding + testing)

### Overlap Resolution

If sessions from different projects overlap in time:
- Split the overlapping time proportionally based on commit density
- Flag the overlap in the report

## Phase 4: Work Item Description

For each work session, generate a human-readable description:

1. **From git commit messages**: Summarize the commits into a single work item description
   - Group related commits (same prefix like `feat:`, `fix:`, etc.)
   - Translate conventional commit prefixes into plain language:
     - `feat:` → "實作/新增..."
     - `fix:` → "修復..."
     - `refactor:` → "重構..."
     - `docs:` → "撰寫文件..."
     - `test:` → "撰寫測試..."
     - `chore:` → "維護作業..."
   - Keep descriptions concise but meaningful

2. **From Claude session data**: Extract the task description from the session context

3. **Merge**: If both sources have data for the same time period, prefer the richer description

## Phase 5: Report Generation

Generate the report in **繁體中文** and output directly to the terminal.

### Single Day Report Format

```markdown
# 每日工作日報 — YYYY-MM-DD (週X)

## 總計工時：X.X 小時

---

### [project-name] (X.Xh)

| 時段 | 工作項目 | 時間 |
|------|---------|------|
| HH:MM-HH:MM | [work description] | X.Xh |
| HH:MM-HH:MM | [work description] | X.Xh |

主要成果: [1-sentence summary of the day's work on this project]

---

### [another-project] (X.Xh)

| 時段 | 工作項目 | 時間 |
|------|---------|------|
| HH:MM-HH:MM | [work description] | X.Xh |

主要成果: [1-sentence summary]

---

> 工時分佈: [project-a] XX% | [project-b] XX% | ...
```

### Multi-Day Report Format (Weekly/Range)

For date ranges spanning multiple days, generate a summary:

```markdown
# 工作週報 — YYYY-MM-DD ~ YYYY-MM-DD

## 總計工時：XX.X 小時 (X 個工作日)

## 每日明細

### YYYY-MM-DD (週X) — X.Xh
[Same single-day format, but condensed]

### YYYY-MM-DD (週X) — X.Xh
[...]

---

## 專案總覽

| 專案 | 總工時 | 佔比 | 主要工作 |
|------|-------|------|---------|
| [project-a] | X.Xh | XX% | [summary] |
| [project-b] | X.Xh | XX% | [summary] |

## 工時趨勢

| 日期 | 總工時 | 專案分佈 |
|------|-------|---------|
| 週一 | X.Xh | project-a: X.Xh, project-b: X.Xh |
| 週二 | X.Xh | ... |
| ... | ... | ... |

> 平均每日工時: X.X 小時
> 最忙碌的一天: YYYY-MM-DD (X.Xh)
> 最主要專案: [project-name] (XX%)
```

## Edge Cases

### No Activity Found
If no git commits or Claude sessions found for the date range:
```
在 [date-range] 期間沒有找到任何開發活動紀錄。

可能原因：
- 該期間沒有 git commits
- Claude Code 沒有 session 紀錄
- config.json 中的 author 或 project paths 需要更新
```

### New Project Setup
If a project path in config doesn't exist or isn't a git repo, warn the user and skip it.

### Timezone
Use the system's local timezone for all time calculations and display.

## Configuration Management

### Add Project
The user can ask to add a new project:
```
/timesheet add-project [name] [path]
```

Read the existing config, add the new project entry, and write back.

### List Projects
```
/timesheet projects
```

Show the configured projects and their paths.
