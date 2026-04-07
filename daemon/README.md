# Daemon Orchestrator

持久化的 Node.js daemon，作為 Claude Code CLI sessions 的「Context Brain」。透過外部記憶管理與 hook 深度整合，確保 sessions 永遠不觸發 auto-compaction。

## Quick Start

### 安裝

```bash
cd plugins/agent-army/daemon
npm install
npm run build
```

### 啟動

```bash
# 前景執行（開發用）
npm run dev

# 背景執行（生產用）
node dist/bin/daemon.js start
```

### 停止

```bash
node dist/bin/daemon.js stop
```

### 狀態查詢

```bash
node dist/bin/daemon.js status
# Daemon is running (PID: 12345)
# Health: { "status": "ok", "activeSessions": 1, ... }
```

---

## 為什麼需要這個系統？

現有 `autopilot.sh` 有三個根本缺陷：

1. **無外部 context 追蹤** — 不知道每個 session 消耗了多少 token，無法在壓縮前主動介入
2. **無結構化中間結果管理** — 跨 session 的知識僅靠 git commit 傳遞，丟失了決策理由
3. **無即時健康監控** — 卡死的 session 只能靠 timeout 被動發現

Daemon Orchestrator 透過 HTTP hooks 即時追蹤每個 session 的 context 消耗，在接近上限前主動終止並重啟，同時將中間產物結構化儲存於外部 ledger。

---

## Architecture

完整設計請見 [ARCHITECTURE.md](ARCHITECTURE.md)。

### Clean Architecture 分層

```
┌─────────────────────────────────────────────────┐
│           Daemon Orchestrator (localhost:7777)    │
│                                                  │
│  Domain:     Mission, Task, Session,             │
│              ContextLedger, TaskGraph             │
│                                                  │
│  Application: StartMission, AssignTask,          │
│               HandleHookEvent, RecycleSession,   │
│               VerifyTask, Replan, CheckHealth     │
│                                                  │
│  Adapters:   REST Controllers, HookReceiver,     │
│              SessionSpawner, FileContextStore     │
│                                                  │
│  Infra:      Express Server, Heartbeat Scheduler,│
│              HooksInstaller, Config              │
└──────┬──────────┬──────────────┬─────────────────┘
       │          │              │
  Claude CLI  Claude CLI    Claude CLI
  Session A   Session B    Session C
  (worker)    (worker)     (verifier)
       │          │              │
       └── HTTP hooks POST to daemon ──┘
```

### 資料流

```
POST /missions
    → StartMissionUseCase
    → spawn planning session (Claude CLI)
    → session POST /hooks/stop with result
    → AssignTaskUseCase → spawn worker session
    → worker POST /hooks/post-tool-use (每次工具呼叫)
    → HandleHookEventUseCase 累加 token 估算
    → 接近閾值 → RecycleSessionUseCase
    → curated prompt → 新 fresh session
```

---

## API Reference

所有端點都在 `localhost:7777`。

### Health Check

```bash
GET /health

curl http://localhost:7777/health
# {"status":"ok","uptime":3600,"activeSessions":1}
```

### Missions

**啟動新 Mission**

```bash
curl -X POST http://localhost:7777/missions \
  -H 'Content-Type: application/json' \
  -d '{"description": "實作用戶登入功能，包含 JWT 驗證"}'
# {"missionId": "m-abc123", "status": "planning"}
```

**Mission 狀態 / Tasks / Sessions / Ledger**

```bash
curl http://localhost:7777/missions/m-abc123
curl http://localhost:7777/missions/m-abc123/tasks
curl http://localhost:7777/missions/m-abc123/sessions
curl http://localhost:7777/missions/m-abc123/ledger
```

**停止 Mission**

```bash
curl -X DELETE http://localhost:7777/missions/m-abc123
```

### Hooks（內部端點）

由 Claude Code CLI sessions 自動呼叫，不需手動操作：

| Endpoint | 觸發時機 |
|----------|---------|
| `POST /hooks/post-tool-use` | 每次工具呼叫完成後 |
| `POST /hooks/pre-compact` | session 即將被壓縮前 |
| `POST /hooks/stop` | session 正常結束時 |
| `POST /hooks/session-start` | 新 session 啟動時 |

---

## Hook 整合

Daemon 啟動時自動寫入 `.claude/settings.local.json`（gitignored），停止時自動移除。

### 已安裝的 Hooks

| Event | Matcher | 用途 |
|-------|---------|------|
| `PostToolUse` | `Read\|Write\|Edit\|Bash\|Grep\|Glob` | 追蹤 context 消耗與檔案 I/O |
| `PreCompact` | — | 兜底觸發 session 回收 |
| `Stop` | — | 擷取 session 結果，標記完成 |
| `SessionStart` | — | 註冊新 session 到 ledger |

所有 hooks 使用 `command` type，透過 `curl` POST 到 daemon。

---

## Anti-Compression Strategy

這是 Daemon Orchestrator 的核心創新。

### 問題

Claude Code 在 context window 接近滿時會自動觸發 compaction（壓縮），丟失細節資訊，導致多步驟任務品質下降。

### 解法：主動回收 + Curated Prompt

1. **追蹤**: 每個 `PostToolUse` hook 回報工具輸出，daemon 累加字元數 ÷ 4 估算 tokens
2. **Model-Aware 閾值**: 根據 session 使用的 model 動態決定回收時機

| Model | Context Window | 回收閾值 (75%) |
|-------|---------------|---------------|
| `claude-sonnet-4-6` | 200K tokens | 150K tokens |
| `claude-opus-4-6` | 200K tokens | 150K tokens |
| `claude-sonnet-4-6[1m]` | 1M tokens | 750K tokens |
| `claude-opus-4-6[1m]` | 1M tokens | 750K tokens |
| `claude-haiku-4-5` | 200K tokens | 150K tokens |

3. **回收流程**:
   - 從 Stop hook 取得最後 assistant 訊息，存為 Artifact
   - 終止當前 session process
   - 建構 curated prompt（僅包含相關 artifacts + task description，< 10K tokens）
   - 啟動全新 fresh session，從已知狀態繼續

4. **PreCompact 兜底**: 若 token 估算失準，`PreCompact` hook 作為最後防線觸發回收

---

## Configuration

### daemon.config.json

在專案根目錄建立 `daemon.config.json`（優先順序：CLI 參數 > 環境變數 > 設定檔 > 預設值）：

```json
{
  "port": 7777,
  "dataDir": "./data",
  "models": {
    "defaultModel": "claude-sonnet-4-6",
    "custom": {
      "my-large-model": {
        "contextWindowTokens": 1000000,
        "recycleThresholdRatio": 0.75
      }
    }
  },
  "session": {
    "maxBudgetUsd": 5,
    "heartbeatIntervalSeconds": 30,
    "heartbeatTimeoutSeconds": 120,
    "maxConcurrentSessions": 1
  },
  "safety": {
    "maxMissionCostUsd": 50,
    "maxMissionDurationMinutes": 240,
    "maxTaskRetries": 2,
    "maxRecyclesPerTask": 5
  },
  "prompt": {
    "maxPromptTokens": 10000,
    "maxArtifactsPerTask": 10
  },
  "git": {
    "autoCheckpoint": true,
    "commitPrefix": "daemon:"
  },
  "cli": {
    "executable": "claude",
    "extraFlags": [],
    "skipPermissions": false
  }
}
```

### 環境變數

| 變數 | 對應設定 | 預設值 |
|------|---------|--------|
| `DAEMON_PORT` | `port` | `7777` |
| `DAEMON_DATA_DIR` | `dataDir` | `./data` |
| `DAEMON_PROJECT_ROOT` | `projectRoot` | `process.cwd()` |
| `DAEMON_DEFAULT_MODEL` | `models.defaultModel` | `claude-sonnet-4-6` |

---

## MVP 限制（v0.1）

以下功能已在計畫中，但延後至後續版本：

| 功能 | 預計版本 |
|------|---------|
| DAG 平行排程（多 session 同時執行） | v0.2 |
| 驗證 loop（spawn verifier session） | v0.2 |
| 失敗重規劃 | v0.2 |
| API 成本追蹤 | v0.2 |
| Decision log 自動擷取 | v0.3 |
| 跨 mission 學習 | v0.3 |
| Web dashboard | v0.3 |

**v0.1 已實作**：Daemon process + REST API、hook 接收 + Context Ledger、model-aware token 估算 + 主動 session 回收、線性 task 執行、heartbeat、BACKLOG.md 解析、CLI start/stop/status、git checkpoint。

