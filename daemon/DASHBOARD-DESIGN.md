# Dashboard & Event Bus — 設計文件

> **版本**: v0.1
> **日期**: 2026-03-31
> **狀態**: 設計完成，待實作

本文件定義 Daemon Orchestrator 的即時 Web Dashboard 與 in-process Event Bus 設計。

---

## 目錄

1. [Event Bus 介面](#1-event-bus)
2. [SSE 端點設計](#2-sse-端點)
3. [Dashboard HTML 結構](#3-dashboard-html)
4. [Stub 審計](#4-stub-審計)
5. [整合流程](#5-整合流程)
6. [檔案結構](#6-檔案結構)
7. [設計決策](#7-設計決策)

---

## 1. Event Bus

Event Bus 為 in-process pub/sub 機制，位於 **infrastructure 層**。Use case 透過 **application port** (`EventBusPort`) 發射事件，遵守 Clean Architecture 依賴規則。

### 1.1 Event Types

```typescript
// src/domain/daemon-event.ts
// WHY: Event types 定義在 domain 層 — 它們是業務概念的一部分

type DaemonEventType =
  | "mission:started"
  | "mission:completed"
  | "mission:failed"
  | "mission:cancelled"
  | "task:assigned"
  | "task:started"
  | "task:completed"
  | "task:failed"
  | "task:retrying"
  | "task:abandoned"
  | "session:spawned"
  | "session:recycled"
  | "session:completed"
  | "session:killed"
  | "session:token-updated"
  | "hook:received"
  | "health:warning"
  | "artifact:created";
```

### 1.2 Event Payload Types

```typescript
// src/domain/daemon-event.ts

interface BaseEvent {
  readonly id: string;           // event-{timestamp}-{random4}
  readonly type: DaemonEventType;
  readonly timestamp: string;    // ISO 8601
}

interface MissionStartedEvent extends BaseEvent {
  readonly type: "mission:started";
  readonly payload: {
    readonly missionId: string;
    readonly name: string;
    readonly taskCount: number;
  };
}

interface MissionCompletedEvent extends BaseEvent {
  readonly type: "mission:completed";
  readonly payload: {
    readonly missionId: string;
    readonly completedTasks: number;
    readonly totalTasks: number;
  };
}

interface MissionFailedEvent extends BaseEvent {
  readonly type: "mission:failed";
  readonly payload: {
    readonly missionId: string;
    readonly reason: string;
  };
}

interface MissionCancelledEvent extends BaseEvent {
  readonly type: "mission:cancelled";
  readonly payload: {
    readonly missionId: string;
    readonly killedSessions: number;
  };
}

interface TaskAssignedEvent extends BaseEvent {
  readonly type: "task:assigned";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly sessionId: string;
    readonly model: string;
  };
}

interface TaskStartedEvent extends BaseEvent {
  readonly type: "task:started";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly title: string;
  };
}

interface TaskCompletedEvent extends BaseEvent {
  readonly type: "task:completed";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly title: string;
  };
}

interface TaskFailedEvent extends BaseEvent {
  readonly type: "task:failed";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly error: string;
  };
}

interface TaskRetryingEvent extends BaseEvent {
  readonly type: "task:retrying";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly retryCount: number;
    readonly maxRetries: number;
  };
}

interface TaskAbandonedEvent extends BaseEvent {
  readonly type: "task:abandoned";
  readonly payload: {
    readonly missionId: string;
    readonly taskId: string;
    readonly reason: string;
  };
}

interface SessionSpawnedEvent extends BaseEvent {
  readonly type: "session:spawned";
  readonly payload: {
    readonly missionId: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly model: string;
    readonly processId: number;
  };
}

interface SessionRecycledEvent extends BaseEvent {
  readonly type: "session:recycled";
  readonly payload: {
    readonly missionId: string;
    readonly oldSessionId: string;
    readonly newSessionId: string;
    readonly reason: string;
    readonly tokenEstimate: number;
  };
}

interface SessionCompletedEvent extends BaseEvent {
  readonly type: "session:completed";
  readonly payload: {
    readonly sessionId: string;
    readonly taskId: string;
  };
}

interface SessionKilledEvent extends BaseEvent {
  readonly type: "session:killed";
  readonly payload: {
    readonly sessionId: string;
    readonly processId: number;
  };
}

interface SessionTokenUpdatedEvent extends BaseEvent {
  readonly type: "session:token-updated";
  readonly payload: {
    readonly missionId: string;
    readonly sessionId: string;
    readonly tokenEstimate: number;
    readonly recycleThreshold: number;
    readonly utilization: number;  // 0-1
  };
}

interface HookReceivedEvent extends BaseEvent {
  readonly type: "hook:received";
  readonly payload: {
    readonly hookType: string;       // PostToolUse, PreCompact, Stop, SessionStart
    readonly sessionId: string;
    readonly summary: string;        // 人類可讀的摘要，如 "Read: src/main.ts"
  };
}

interface HealthWarningEvent extends BaseEvent {
  readonly type: "health:warning";
  readonly payload: {
    readonly message: string;
    readonly sessionId?: string;
  };
}

interface ArtifactCreatedEvent extends BaseEvent {
  readonly type: "artifact:created";
  readonly payload: {
    readonly missionId: string;
    readonly artifactId: string;
    readonly taskId: string;
    readonly artifactType: string;
    readonly contentPreview: string;  // 前 200 字元
  };
}

type DaemonEvent =
  | MissionStartedEvent
  | MissionCompletedEvent
  | MissionFailedEvent
  | MissionCancelledEvent
  | TaskAssignedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskRetryingEvent
  | TaskAbandonedEvent
  | SessionSpawnedEvent
  | SessionRecycledEvent
  | SessionCompletedEvent
  | SessionKilledEvent
  | SessionTokenUpdatedEvent
  | HookReceivedEvent
  | HealthWarningEvent
  | ArtifactCreatedEvent;
```

### 1.3 EventBusPort（Application Layer）

```typescript
// src/application/ports/event-bus-port.ts
// WHY: Port 定義在 application 層，讓 use case 可以 emit 事件而不依賴 infrastructure

import type { DaemonEvent } from "../../domain/daemon-event.js";

type EventHandler = (event: DaemonEvent) => void;

interface EventBusPort {
  /** 發射事件，所有 subscribers 同步接收 */
  emit(event: DaemonEvent): void;

  /** 訂閱所有事件 */
  subscribe(handler: EventHandler): void;

  /** 取消訂閱 */
  unsubscribe(handler: EventHandler): void;
}
```

### 1.4 EventBus 實作（Infrastructure Layer）

```typescript
// src/infrastructure/event-bus.ts

import type { DaemonEvent } from "../domain/daemon-event.js";
import type { EventBusPort } from "../application/ports/event-bus-port.js";

type EventHandler = (event: DaemonEvent) => void;

class EventBus implements EventBusPort {
  private readonly handlers = new Set<EventHandler>();

  // CONTEXT: 保留最近 500 筆事件供新連線的 SSE client 回補
  private readonly recentEvents: DaemonEvent[] = [];
  private readonly maxRecentEvents = 500;

  emit(event: DaemonEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[event-bus] Handler error:", err);
      }
    }
  }

  subscribe(handler: EventHandler): void {
    this.handlers.add(handler);
  }

  unsubscribe(handler: EventHandler): void {
    this.handlers.delete(handler);
  }

  /** 取得最近的事件（供 SSE 新連線回補） */
  getRecentEvents(): readonly DaemonEvent[] {
    return this.recentEvents;
  }

  /** 取得目前 subscriber 數量（用於 health check） */
  getSubscriberCount(): number {
    return this.handlers.size;
  }
}
```

**設計決策**:
- `emit()` 為同步呼叫 — handlers 不應執行耗時操作。SSE 推送本身只是寫入 HTTP response stream，天生快速。
- `recentEvents` 環形緩衝區讓新開啟的 dashboard 頁面可以立即看到近期歷史，無需額外 API。
- handler 錯誤被捕獲並 log，不會中斷其他 subscribers。

---

## 2. SSE 端點

### 2.1 `GET /events` — SSE Stream

```typescript
// 掛載在 src/infrastructure/server.ts 或新增 src/adapters/controllers/sse-controller.ts

// SSE 回應格式：
// Content-Type: text/event-stream
// Cache-Control: no-cache
// Connection: keep-alive

// 每筆事件格式：
// id: {event.id}
// event: {event.type}
// data: {"type":"session:token-updated","timestamp":"...","payload":{...}}
//
// (空行分隔)
```

**連線流程**：

1. Client 發起 `GET /events` 請求
2. Server 回傳 SSE headers，保持連線開啟
3. 立即推送 `recentEvents`（回補歷史）
4. 訂閱 EventBus，每當有新事件即推送到 client
5. Client 斷線時（`req.on('close')`）自動 unsubscribe

**SSE Controller 虛擬碼**：

```typescript
// src/adapters/controllers/sse-controller.ts

import type { Request, Response } from "express";
import type { EventBus } from "../../infrastructure/event-bus.js";

function createSseHandler(eventBus: EventBus) {
  return (req: Request, res: Response): void => {
    // 設定 SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",  // 避免 nginx 等 proxy 的緩衝
    });

    // 心跳：每 30 秒發送 comment 避免連線超時
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30_000);

    // 回補歷史事件
    for (const event of eventBus.getRecentEvents()) {
      writeSseEvent(res, event);
    }

    // 訂閱新事件
    const handler = (event: DaemonEvent) => {
      writeSseEvent(res, event);
    };
    eventBus.subscribe(handler);

    // 斷線清理
    req.on("close", () => {
      clearInterval(heartbeat);
      eventBus.unsubscribe(handler);
    });
  };
}

function writeSseEvent(res: Response, event: DaemonEvent): void {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
```

### 2.2 `GET /dashboard` — 靜態 HTML 頁面

```typescript
// 掛載在 server.ts

app.get("/dashboard", (_req, res) => {
  res.sendFile(resolve(__dirname, "../public/dashboard.html"));
});
```

**或者**（避免額外檔案讀取）使用 inline template：

```typescript
// src/infrastructure/dashboard-html.ts
// 匯出一個 const string，包含完整的 HTML/CSS/JS
export const DASHBOARD_HTML = `<!DOCTYPE html>...`;

// server.ts
app.get("/dashboard", (_req, res) => {
  res.type("html").send(DASHBOARD_HTML);
});
```

> **選擇**：使用獨立 `.html` 檔案放在 `src/public/dashboard.html`。理由：HTML 內容較大（預估 400+ 行），放在 TS 字串中不利於 syntax highlighting 和編輯。Infrastructure 層的 server.ts 負責 serve 它。

### 2.3 `GET /api/state` — 初始狀態快照

Dashboard 載入時需要一次性取得完整狀態（而非僅靠 SSE 歷史事件拼湊）。

```typescript
// 新增 API 端點或擴充現有 mission controller

// GET /api/state
// Response:
interface DashboardState {
  readonly missions: Array<{
    readonly mission: Mission;
    readonly tasks: Task[];
    readonly sessions: SessionContext[];
    readonly artifacts: Artifact[];
  }>;
  readonly daemon: {
    readonly uptime: number;
    readonly version: string;
    readonly eventBusSubscribers: number;
  };
}
```

**設計決策**：
- SSE 用於增量更新，`/api/state` 用於初始載入 — 兩者互補。
- 這避免了 dashboard 必須從 `recentEvents` 重建狀態的複雜邏輯。

---

## 3. Dashboard HTML

### 3.1 佈局結構

```
+--------------------------------------------------+
|  Daemon Orchestrator Dashboard     [status: ok]   |  <- 頂部狀態列
+----------+---------------------------------------+
|          |                                       |
| MISSION  |  TASK DAG                             |
| INFO     |  ┌─────┐  ┌─────┐  ┌─────┐          |
| -----    |  │ T01 │→ │ T02 │→ │ T03 │          |
| Name     |  └─────┘  └─────┘  └─────┘          |
| Status   |           ↘ ┌─────┐                   |
| Progress |             │ T04 │                   |
| Tokens   |             └─────┘                   |
|          +---------------------------------------+
| SESSIONS |  EVENT LOG                            |
| -----    |  [12:03:05] hook:received Post...     |
| sess-1   |  [12:03:04] session:token-updated ... |
|  ██████░ |  [12:03:01] task:assigned T01 → ...   |
|  75%     |  [12:02:58] mission:started ...       |
| sess-2   |  [12:02:55] ...                       |
|  ██░░░░░ |                                       |
|  25%     |                                       |
|          |                                       |
+----------+---------------------------------------+
```

### 3.2 技術規格

- **單一 HTML 檔案**：`src/public/dashboard.html`，內含 `<style>` 與 `<script>` 標籤
- **無外部依賴**：純 vanilla HTML/CSS/JS
- **即時更新**：使用 `EventSource` API 連接 `GET /events`
- **初始載入**：`fetch('/api/state')` 取得完整狀態後渲染，然後切換到 SSE 增量更新

### 3.3 主要 UI 元件

#### 3.3.1 頂部狀態列
- Daemon 執行狀態（ok / degraded / error）
- 運行時間（uptime）
- SSE 連線狀態指示燈（綠色 = 已連線）

#### 3.3.2 側邊欄 — Mission Info
- Mission 名稱與 ID
- 狀態標籤（color-coded：running=藍, completed=綠, failed=紅）
- 進度條：`completedTasks / totalTasks`
- 總 token 消耗量
- Mission 建立時間

#### 3.3.3 側邊欄 — Sessions Panel
- 每個活躍 session 一張卡片
- 顯示：session ID（縮短）、分配的 task、model 名稱
- Token 使用進度條：`tokenEstimate / recycleThreshold`
  - 綠色 < 50%、黃色 50-80%、紅色 > 80%
- Session 狀態標籤

#### 3.3.4 主區域 — Task DAG 視覺化
- 每個 task 一張卡片，水平或垂直排列
- 卡片顏色依狀態：
  - `pending`: 灰色
  - `assigned` / `running`: 藍色（脈衝動畫）
  - `completed`: 綠色
  - `failed`: 紅色
  - `retrying`: 橙色
  - `abandoned`: 深灰色
- 依賴關係用箭頭或連線表示
- 卡片內容：Task ID、標題、狀態、已分配 session

#### 3.3.5 主區域 — Event Log
- 倒序時間軸，最新事件在上方
- 每筆事件顯示：時間戳、事件類型（color-coded 標籤）、摘要文字
- 最多保留 200 筆（超過則移除最舊的）
- 可按事件類型篩選

### 3.4 CSS 配色

```css
:root {
  --bg-primary: #0d1117;       /* GitHub Dark 背景 */
  --bg-secondary: #161b22;
  --bg-card: #21262d;
  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  --border: #30363d;
  --accent-blue: #58a6ff;
  --accent-green: #3fb950;
  --accent-red: #f85149;
  --accent-orange: #d29922;
  --accent-purple: #bc8cff;
}
```

### 3.5 JavaScript 架構

```javascript
// 全局狀態
const state = {
  missions: [],    // 從 /api/state 初始載入
  events: [],      // SSE 事件歷史
  connected: false,
};

// 初始化流程
async function init() {
  // 1. 取得初始狀態
  const response = await fetch("/api/state");
  const data = await response.json();
  state.missions = data.missions;

  // 2. 渲染初始 UI
  renderMissionInfo();
  renderTaskDag();
  renderSessions();

  // 3. 建立 SSE 連線
  connectSSE();
}

function connectSSE() {
  const source = new EventSource("/events");

  source.onopen = () => {
    state.connected = true;
    updateConnectionStatus();
  };

  source.onerror = () => {
    state.connected = false;
    updateConnectionStatus();
    // EventSource 會自動重連
  };

  // 訂閱各事件類型
  const eventTypes = [
    "mission:started", "mission:completed", "mission:failed",
    "task:assigned", "task:started", "task:completed",
    "task:failed", "task:retrying",
    "session:spawned", "session:recycled", "session:token-updated",
    "session:completed", "session:killed",
    "hook:received", "health:warning", "artifact:created",
  ];

  for (const type of eventTypes) {
    source.addEventListener(type, (e) => {
      const event = JSON.parse(e.data);
      handleEvent(event);
    });
  }
}

function handleEvent(event) {
  // 加入事件歷史
  state.events.unshift(event);
  if (state.events.length > 200) state.events.pop();

  // 依事件類型更新對應 UI
  switch (event.type) {
    case "session:token-updated":
      updateSessionTokenBar(event.payload);
      break;
    case "task:completed":
    case "task:failed":
    case "task:assigned":
      updateTaskCard(event.payload);
      break;
    case "mission:completed":
    case "mission:failed":
      updateMissionInfo(event.payload);
      break;
    // ... 其他事件
  }

  // 更新事件 log
  renderEventLogEntry(event);
}
```

### 3.6 Task DAG 渲染

使用 CSS Grid + 拓撲排序來定位 task 卡片：

```javascript
function renderTaskDag() {
  const tasks = state.missions[0]?.tasks ?? [];

  // 計算拓撲層級（同一層的 tasks 垂直排列）
  const levels = computeTopologicalLevels(tasks);

  const container = document.getElementById("task-dag");
  container.innerHTML = "";
  container.style.display = "grid";
  container.style.gridTemplateColumns = `repeat(${levels.length}, 1fr)`;

  for (let col = 0; col < levels.length; col++) {
    const colDiv = document.createElement("div");
    colDiv.className = "dag-column";

    for (const task of levels[col]) {
      const card = createTaskCard(task);
      colDiv.appendChild(card);
    }
    container.appendChild(colDiv);
  }

  // 用 SVG overlay 畫依賴箭頭
  drawDependencyArrows(tasks, container);
}
```

> **設計決策**: 不使用 D3.js 或 dagre 等圖形函式庫。拓撲排序分層 + CSS Grid 足以處理 v0.1 的線性/簡單 DAG。若未來 DAG 複雜度增加，可引入 dagre-d3。

---

## 4. Stub 審計

逐一檢查每個 use case 與 main.ts 中的 stub，辨識缺失的功能。

### 4.1 `main.ts` — SessionRegistry 為 stub

**位置**: `src/infrastructure/main.ts:62-66, 72-78, 83-87`

```typescript
// 目前的 stub:
sessionRegistry: {
  findBySessionId: () => null,     // 永遠回傳 null
},
onRecycleNeeded: async () => {},    // 空操作
onTaskCompleted: async () => {},    // 空操作
```

**需要的改動**:
1. **建立 `InMemorySessionRegistry` 類別**（新檔案 `src/infrastructure/session-registry.ts`）
   - 實作 `SessionRegistry`、`RecycleSessionRegistry`、`HealthSessionRegistry` 三個介面
   - 維護 `Map<sessionId, SessionRegistryEntry>` 的全局狀態
   - `AssignTaskUseCase.execute()` 完成後註冊新 session
   - `RecycleSessionUseCase` 完成後更新 registry
   - `handleStop` 後清除 registry entry
2. **連接 `onRecycleNeeded`** — 呼叫 `RecycleSessionUseCase.execute()`
3. **連接 `onTaskCompleted`** — 觸發下一個 ready task 的 `AssignTaskUseCase`（mission orchestration loop 的核心）

**影響範圍**: 這是讓整個 orchestration loop 運轉的關鍵 — 沒有它，daemon 只能啟動 mission 但無法自動推進 tasks。

### 4.2 `main.ts` — `HealthSessionRegistry` 為 stub

**位置**: `src/infrastructure/main.ts:85-87`

```typescript
sessionRegistry: {
  getActiveSessions: () => [],  // 永遠回傳空陣列
},
```

**需要的改動**: 由 4.1 的 `InMemorySessionRegistry` 統一提供。

### 4.3 `HandleHookEventUseCase` — `onTaskCompleted` 未觸發後續流程

**位置**: `src/application/use-cases/handle-hook-event.ts:155-165`

當 task 完成後（`handleStop` 中偵測到 `TASK_COMPLETE`），目前呼叫 `this.deps.onTaskCompleted(missionId, entry.taskId)`，但 main.ts 注入了空實作。

**需要的改動**:
- `onTaskCompleted` 回呼應該：
  1. 從 TaskGraph 取得下一個 `readyTask`
  2. 若有 ready task → 呼叫 `AssignTaskUseCase.execute()`
  3. 若所有 tasks 完成 → 更新 Mission status 為 `completed`
  4. 發射 `task:completed` 事件到 EventBus

### 4.4 `StartMissionUseCase` — 未觸發首個 task 的分配

**位置**: `src/application/use-cases/start-mission.ts`

Mission 建立後（tasks 已儲存），use case 回傳但未自動開始第一個 task。

**需要的改動**:
- 在 `execute()` 末尾（儲存完成後），取得 `TaskGraph.getReadyTasks()` 並對第一個 ready task 呼叫 `AssignTaskUseCase.execute()`
- 或者：由 main.ts 的 orchestration loop 在 `startMission` 回傳後啟動
- **推薦做法**: 將 orchestration loop 邏輯放在 main.ts（infrastructure 層），而非 use case 內部，避免 use case 之間的直接耦合

### 4.5 `RecycleSessionUseCase` — 功能完整但缺乏 EventBus 整合

**位置**: `src/application/use-cases/recycle-session.ts`

Use case 邏輯本身完整，但缺少事件發射。

**需要的改動**:
- 注入 `EventBusPort`，在 kill 舊 session 後 emit `session:recycled`
- 在 spawn 新 session 後 emit `session:spawned`

### 4.6 `AssignTaskUseCase` — 功能完整但缺乏 EventBus 整合

**位置**: `src/application/use-cases/assign-task.ts`

**需要的改動**:
- 注入 `EventBusPort`
- spawn 後 emit `session:spawned`
- task 狀態更新後 emit `task:assigned`

### 4.7 `CheckHealthUseCase` — `HealthSessionRegistry` 為 stub

**位置**: `src/application/use-cases/check-health.ts`

健康檢查邏輯完整，但因 `sessionRegistry.getActiveSessions()` 回傳空陣列，目前無法回報任何 session 健康資訊。

**需要的改動**: 由 4.1 的 `InMemorySessionRegistry` 解決。

### 4.8 `server.ts` — `/health` 端點硬編碼數值

**位置**: `src/infrastructure/server.ts:29-30`

```typescript
activeMissions: 0,   // 硬編碼
activeSessions: 0,   // 硬編碼
```

**需要的改動**: 注入 `MissionRepositoryPort` 與 `SessionRegistry`，查詢真實數值。

### 4.9 `mission-controller.ts` — `handleGetSessions` 回傳 stub 資料

**位置**: `src/adapters/controllers/mission-controller.ts:102-109`

```typescript
processAlive: false,       // 硬編碼 false
tokenUtilization: 0,       // 硬編碼 0
```

**需要的改動**:
- 注入 `SessionManagerPort` 呼叫 `isAlive()`
- 從 model registry 計算 `tokenUtilization`

### 4.10 Stub 優先級摘要

| 優先級 | Stub | 影響 |
|--------|------|------|
| **P0** | SessionRegistry (4.1, 4.2) | Orchestration loop 完全不運作 |
| **P0** | onTaskCompleted (4.3) | Tasks 無法自動推進 |
| **P0** | 首個 task 分配 (4.4) | Mission 啟動後無動作 |
| **P1** | EventBus 整合 (4.5, 4.6) | Dashboard 無法即時更新 |
| **P2** | Health endpoint (4.8) | 監控資訊不準確 |
| **P2** | Session 查詢 (4.9) | Sessions API 回傳假資料 |

---

## 5. 整合流程

### 5.1 Event Bus 串接 Use Cases

```
Use Case                          Event Emitted
──────────────────────────────────────────────────
StartMissionUseCase.execute()  →  mission:started
                                  task:assigned (if auto-start)

AssignTaskUseCase.execute()    →  task:assigned
                                  session:spawned

HandleHookEvent (PostToolUse)  →  hook:received
                                  session:token-updated

HandleHookEvent (Stop)         →  hook:received
                                  session:completed
                                  task:completed (if TASK_COMPLETE)

HandleHookEvent (PreCompact)   →  hook:received

RecycleSessionUseCase.execute()→  session:recycled
                                  session:spawned (new session)

CheckHealthUseCase.execute()   →  health:warning (if any)

ReplanUseCase.execute()        →  task:retrying / task:abandoned
                                  mission:failed (if all abandoned)

Mission controller DELETE      →  mission:cancelled
                                  session:killed
```

### 5.2 資料流圖

```
Claude CLI Session
     │
     │ Hook (curl POST)
     ▼
Hook Controller (adapter)
     │
     │ HookEvent
     ▼
HandleHookEventUseCase (application)
     │
     ├──→ ContextLedgerPort.upsertSessionContext()
     │
     ├──→ EventBusPort.emit(hook:received)
     │
     ├──→ EventBusPort.emit(session:token-updated)
     │
     └──→ onRecycleNeeded() / onTaskCompleted()
              │
              ▼
         Orchestration Loop (infrastructure/main.ts)
              │
              ├──→ RecycleSessionUseCase / AssignTaskUseCase
              │
              └──→ EventBusPort.emit(...)
                        │
                        ▼
                   EventBus (infrastructure)
                        │
                        ├──→ SSE Controller → Browser (EventSource)
                        │
                        └──→ (future: logging, metrics, etc.)
```

### 5.3 main.ts 改動概要

```typescript
// 新增的 infrastructure 元件
const eventBus = new EventBus();
const sessionRegistry = new InMemorySessionRegistry();

// Use case 注入 EventBusPort
const startMission = new StartMissionUseCase({
  missionRepo, taskRepo, ledgerPort: contextLedger,
  eventBus,  // 新增
});

const assignTask = new AssignTaskUseCase({
  missionRepo, taskRepo, sessionManager, ledgerPort: contextLedger,
  eventBus,  // 新增
});

// HandleHookEvent 的回呼連接真實邏輯
const handleHookEvent = new HandleHookEventUseCase({
  ledgerPort: contextLedger,
  taskRepo,
  sessionRegistry,       // 真實 registry
  eventBus,              // 新增
  onRecycleNeeded: async (sessionId, reason) => {
    await recycleSession.execute({
      missionId: sessionRegistry.findBySessionId(sessionId)!.missionId,
      sessionId,
      reason: reason as RecycleSessionInput["reason"],
    });
  },
  onTaskCompleted: async (missionId, taskId) => {
    // Orchestration: 取得下一個 ready task 並分配
    const tasks = await taskRepo.findByMissionId(missionId);
    const readyTasks = findReadyTasks(tasks);
    if (readyTasks.length > 0) {
      await assignTask.execute({ missionId, taskId: readyTasks[0] });
    } else {
      const allDone = tasks.every(
        (t) => t.status === "completed" || t.status === "abandoned"
      );
      if (allDone) {
        await missionRepo.updateStatus(missionId, "completed");
        eventBus.emit(createMissionCompletedEvent(missionId, tasks));
      }
    }
  },
});

// Server 新增 SSE + Dashboard 端點
const app = createApp({
  missionRouter,
  hookRouter,
  eventBus,          // 新增
  dashboardEnabled: true,
});
```

---

## 6. 檔案結構

### 6.1 新增檔案

| 檔案路徑 | 層 | 職責 | 行數預估 |
|---|---|---|---|
| `src/domain/daemon-event.ts` | Domain | Event types 與 payload 定義 | ~180 |
| `src/application/ports/event-bus-port.ts` | Application | EventBusPort 介面 | ~15 |
| `src/infrastructure/event-bus.ts` | Infrastructure | EventBus 實作（pub/sub + 歷史緩衝） | ~60 |
| `src/infrastructure/session-registry.ts` | Infrastructure | InMemorySessionRegistry（統一實作三個 registry 介面） | ~100 |
| `src/adapters/controllers/sse-controller.ts` | Adapter | SSE endpoint + `/api/state` + `/dashboard` | ~80 |
| `src/public/dashboard.html` | Infrastructure | 單頁 Dashboard HTML/CSS/JS | ~500* |

> *dashboard.html 超過 300 行限制，但它是 HTML/CSS/JS 三合一的獨立前端檔案，不適用後端原始碼的行數規範。

### 6.2 修改檔案

| 檔案路徑 | 改動 |
|---|---|
| `src/infrastructure/server.ts` | 接受 `eventBus` 依賴，掛載 `/events`、`/dashboard`、`/api/state` |
| `src/infrastructure/main.ts` | 建立 EventBus、SessionRegistry，連接 orchestration loop |
| `src/application/use-cases/handle-hook-event.ts` | 注入 `EventBusPort`，emit 事件 |
| `src/application/use-cases/assign-task.ts` | 注入 `EventBusPort`，emit 事件 |
| `src/application/use-cases/start-mission.ts` | 注入 `EventBusPort`，emit `mission:started` |
| `src/application/use-cases/recycle-session.ts` | 注入 `EventBusPort`，emit `session:recycled` |
| `src/application/use-cases/replan.ts` | 注入 `EventBusPort`，emit retry/abandon 事件 |
| `src/application/use-cases/check-health.ts` | 注入 `EventBusPort`，emit `health:warning` |
| `src/adapters/controllers/mission-controller.ts` | emit `mission:cancelled`；修復 session 查詢 stub |

---

## 7. 設計決策

| 決策 | 選擇 | 理由 |
|---|---|---|
| Event Bus 位於 infrastructure 層 | Port in application，實作 in infrastructure | 遵守依賴規則 — use case 透過 port 發射事件 |
| SSE 而非 WebSocket | SSE | 單向串流即可；瀏覽器原生 `EventSource` 自動重連；實作更簡單 |
| 單一 HTML 檔案 | 無框架 | 避免前端 build 工具鏈；dashboard 功能簡單不需 React |
| `/api/state` 初始快照 | 獨立端點 | 比從 SSE 歷史事件重建狀態更可靠且直觀 |
| Event 歷史緩衝 500 筆 | 環形緩衝區 | 記憶體開銷極小（< 1MB），新連線可看到近期歷史 |
| SessionRegistry 在 infrastructure 層 | 非 use case 內部狀態 | 全局 mutable 狀態屬於 infrastructure 層管理，use case 透過介面存取 |
| Orchestration loop 在 main.ts | 非獨立 use case | 避免 use case 之間直接依賴；main.ts 作為 coordinator |
| Task DAG 用 CSS Grid | 非 D3.js / dagre | v0.1 的 DAG 為線性或簡單結構，CSS Grid 足以表達 |
| 暗色主題 | GitHub Dark 配色 | 開發者友好；與 terminal 環境一致 |
| Event handler 同步執行 | 非 async | SSE 寫入為 sync I/O（寫入 buffer），不需 await |
