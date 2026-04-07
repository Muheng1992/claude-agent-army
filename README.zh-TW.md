**[English](./README.md)** | **繁體中文**

# Agent Army — Claude Code 多 Agent 自動化開發團隊

> **一行指令，讓 12+ 個 AI agent 幫你完成整個開發流程。**

Agent Army 是 [Claude Code CLI](https://claude.ai/code) 的開源 plugin。安裝後，你只需要描述你要做什麼，它會自動拆解任務、分配 agent、並行開發、跑測試、做 code review——全部自動化。

```bash
/agent-army:autopilot Build authentication module with JWT and role-based access control
```

就這樣。你去喝杯咖啡，回來功能已經建好了。

<!-- TODO: 加一張 autopilot 跑起來的截圖 -->

---

## 它跟 Claude Code 原生的 subagent 有什麼不同？

| | Claude Code 原生 | Agent Army |
|---|---|---|
| **你的角色** | 你是 tech lead，手動決定 spawn 誰、做什麼 | 你是老闆，agent 團隊自己運轉 |
| **角色分工** | 只有 general-purpose agent | 5 個專業角色各司其職 |
| **流程** | 你自己指揮 | 自動化 wave 執行（設計 → 實作 → 測試 → review） |
| **品質保證** | 靠你自己記得要測試 | TDD + code review + security audit 內建強制執行 |
| **失敗處理** | agent 掛了你自己處理 | 自動偵測 + 分類 + 重試 + 降級 |
| **跨 session** | 每次從零開始 | context-sync 保留上下文 |

---

## 5 個專業 Agent

| Agent | 角色 | 能力範圍 |
|-------|------|---------|
| **Tech Lead** | 指揮官 | 拆解任務、分配 agent、review 品質、解決衝突。**不寫代碼**——只指揮 |
| **Architect** | 設計師 | 系統設計、API 設計、資料建模。只產出設計，不實作 |
| **Implementer** | 工程師 | 寫代碼、整合、解 merge conflict。可並行多個 |
| **Tester** | 品管 | 單元測試 + 整合測試 + code review + 安全審計（OWASP） |
| **Documenter** | 文件 | 撰寫文件、產出報告、歸檔管理 |

Tech Lead 根據任務複雜度自動分級（S/A/B/C），決定要 spawn 多少 agent：

| 等級 | 規模 | 團隊配置 |
|------|------|---------|
| **S** | 改一個檔案 | 不 spawn，直接做 |
| **A** | 1-3 個檔案 | implementer + tester |
| **B** | 4-15 個檔案 | architect + implementer × 1-3 + tester + documenter |
| **C** | 15+ 個檔案 | 全員出動，implementer 可達 5 個並行 |

---

## 14 個 Skill（Slash Commands）

### 核心開發流程

| 指令 | 用途 |
|------|------|
| `/agent-army:autopilot [任務描述]` | **全自動模式**：拆任務 → 建 backlog → 啟動 tmux 迴圈 → 逐一執行直到完成 |
| `/agent-army:assemble [feature]` | 啟動 agent 團隊開發一個功能 |
| `/agent-army:sprint [feature]` | Sprint 規劃與任務拆解 |
| `/agent-army:tdd [feature]` | TDD Red-Green-Refactor 強制執行 |
| `/agent-army:fix [error]` | 智慧問題診斷與修復 |

### 品質保證

| 指令 | 用途 |
|------|------|
| `/agent-army:quality-gate [scope]` | 品質關卡檢查（6 道 gate） |
| `/agent-army:integration-test [scope]` | 整合測試協調（5 階段） |
| `/agent-army:code-review [scope]` | Code review 協調（4 階段） |

### 專案管理

| 指令 | 用途 |
|------|------|
| `/agent-army:setup [project]` | 初始化專案（安裝模板、git hooks、CI） |
| `/agent-army:onboard [project]` | 掃描專案結構，產出 memory bootstrap |
| `/agent-army:context-sync [mode]` | 跨 session 上下文同步（save / load / team） |
| `/agent-army:retrospective` | 任務回顧與自我改進 |
| `/agent-army:changelog [spec]` | 從 git 歷史自動產出 changelog |
| `/agent-army:timesheet [range]` | 工時分析與每日報告 |

---

## 安裝

### 方式一：透過 Marketplace（推薦）

```bash
# 1. 加入 marketplace 來源
/plugin marketplace add Muheng1992/claude-agent-army

# 2. 安裝 plugin
/plugin install agent-army@claude-agent-army

# 3. 初始化你的專案
/agent-army:setup my-project
```

### 方式二：本機測試

```bash
# Clone
git clone https://github.com/Muheng1992/claude-agent-army.git

# 啟動 Claude Code 並載入 plugin
claude --plugin-dir ./claude-agent-army
```

### 方式三：寫入專案設定

在你專案的 `.claude/settings.json` 中加入：

```json
{
  "extraKnownMarketplaces": {
    "claude-agent-army": {
      "source": {
        "source": "github",
        "repo": "Muheng1992/claude-agent-army"
      }
    }
  },
  "enabledPlugins": {
    "agent-army@claude-agent-army": true
  }
}
```

---

## Quick Start

```bash
# 1. 安裝完成後，先讓它認識你的專案
/agent-army:onboard my-project

# 2. 用一句話描述你要做什麼，然後放手
/agent-army:autopilot Build a REST API with user auth, CRUD endpoints, and tests

# 3. 它會自動：
#    → 分析你的 codebase
#    → 拆成 5-30 個原子任務
#    → 啟動 tmux 迴圈
#    → 逐一執行（Architect 設計 → Implementer 寫碼 → Tester 測試）
#    → 每個任務完成後自動 git commit checkpoint
#    → 全部完成後停止

# 4. 監控進度
/agent-army:autopilot status

# 5. 需要停止
/agent-army:autopilot stop
```

---

## Autopilot 安全機制

Autopilot 有內建的安全保護，防止失控：

| 限制 | 預設值 | 說明 |
|------|--------|------|
| 最大迭代次數 | 50 | 防止無限迴圈 |
| 最大花費 | $25.00 | 防止 token 爆預算 |
| 最大時長 | 240 分鐘 | 防止跑到天荒地老 |
| 單次迭代上限 | $5.00 | 防止單次爆費 |
| 冷卻間隔 | 30 秒 | Rate limiting |

每次迭代完成後自動建立 `autopilot:` 前綴的 git commit，可隨時 rollback。

緊急停止有三種方式：
1. `/agent-army:autopilot stop`（graceful，完成當前任務後停）
2. `tmux kill-session -t autopilot-{project}`（立即停止）
3. `touch .claude/autopilot/STOP`（手動建立停止信號）

---

## 內建模板

`/agent-army:setup` 會安裝以下模板：

| 類別 | 內容 |
|------|------|
| **Memory** | `MEMORY.md` + 結構化記憶檔案，跨 session 保持上下文 |
| **Git Hooks** | pre-commit（檔案長度 + 敏感資料掃描）、commit-msg（格式驗證）、pre-push（品質提醒） |
| **CI/CD** | GitHub Actions quality gate workflow（6 道檢查） |
| **Keybindings** | Agent Army 常用指令的快捷鍵 |
| **Workspace** | 多專案協調設定 |

---

## 系統需求

- **Claude Code CLI** v1.0.33+
- **tmux**（autopilot 需要）：`brew install tmux`
- **環境變數**：`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

---

## License

MIT — 自由使用、修改、分發。

---

## 作者

[@Muheng1992](https://github.com/Muheng1992)
