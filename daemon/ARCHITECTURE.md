# Daemon Orchestrator — 介面契約與詳細設計

> **版本**: v0.1 (MVP)
> **日期**: 2026-03-31
> **狀態**: 設計完成，待實作

本文件定義 Daemon Orchestrator 所有層的 TypeScript 介面契約。實作者應根據本文件建立對應的 `.ts` 檔案，每個 section 對應一個原始碼檔案。

---

## 目錄

1. [Domain Layer — Entities & Value Objects](#1-domain-layer)
2. [Application Layer — Ports](#2-application-layer--ports)
3. [Application Layer — Use Cases (DTOs & Signatures)](#3-application-layer--use-cases)
4. [REST API Contract](#4-rest-api-contract)
5. [Hook Event Payloads](#5-hook-event-payloads)
6. [Config Schema](#6-config-schema)
7. [Model-Aware Token Management](#7-model-aware-token-management)
8. [Error Types](#8-error-types)
9. [File-to-Interface Mapping](#9-file-to-interface-mapping)

---

## 1. Domain Layer

Domain 層為純 TypeScript 型別，**不得** import 任何外部套件（僅原生型別）。

### 1.1 Mission（Aggregate Root）

```typescript
// src/domain/mission.ts

type MissionStatus =
  | "planning"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

interface MissionConfig {
  readonly description: string;
  readonly defaultModel: string;
  readonly maxConcurrentSessions: number;
  readonly maxRetries: number;
  readonly costLimitUsd: number;
  readonly durationLimitMinutes: number;
}

interface Mission {
  readonly id: string;
  readonly name: string;
  status: MissionStatus;
  readonly config: MissionConfig;
  readonly taskIds: string[];
  readonly createdAt: string;       // ISO 8601
  updatedAt: string;                // ISO 8601
  completedAt: string | null;
}
```

**設計決策**:
- `id` 使用 `mission-{timestamp}-{random4}` 格式，人類可讀且排序友善。
- `taskIds` 為有序列表，保留建立順序。Mission 不直接持有 Task 物件 — 透過 repository 載入以避免 aggregate 過大。

### 1.2 Task（Entity）

```typescript
// src/domain/task.ts

type TaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "verifying"
  | "completed"
  | "failed"
  | "retrying"
  | "abandoned";

// AI-INVARIANT: 合法的狀態轉移定義
// pending → assigned → running → verifying → completed
//                   ↘ failed → retrying → running
//                                       ↘ abandoned (max retries exceeded)
type TaskTransition = {
  readonly from: TaskStatus;
  readonly to: TaskStatus;
};

const VALID_TRANSITIONS: readonly TaskTransition[] = [
  { from: "pending",   to: "assigned"  },
  { from: "assigned",  to: "running"   },
  { from: "running",   to: "verifying" },
  { from: "running",   to: "failed"    },
  { from: "running",   to: "completed" },  // WHY: v0.1 跳過 verifying 直接完成
  { from: "verifying", to: "completed" },
  { from: "verifying", to: "failed"    },
  { from: "failed",    to: "retrying"  },
  { from: "failed",    to: "abandoned" },
  { from: "retrying",  to: "running"   },
];

interface AcceptanceCriteria {
  readonly description: string;
  readonly checkCommand: string | null;  // 可選的自動化驗證指令
}

interface Task {
  readonly id: string;                   // T01, T02, ...
  readonly missionId: string;
  readonly title: string;
  readonly description: string;
  status: TaskStatus;
  readonly dependencies: string[];       // 依賴的 task IDs
  assignedSessionId: string | null;
  readonly acceptanceCriteria: AcceptanceCriteria[];
  retryCount: number;
  readonly maxRetries: number;
  readonly model: string | null;         // null 表示使用 mission default
  readonly priority: number;             // 1 = highest
  lastError: string | null;
}
```

**設計決策**:
- `model` 為 `null` 時 fallback 到 `MissionConfig.defaultModel`，支援 per-task model override。
- `checkCommand` 可為 `null`，v0.1 的驗證以人工定義的 acceptance criteria 文字為主。
- `VALID_TRANSITIONS` 在 domain 層定義為常數，由 domain function `canTransition(from, to)` 驗證。

### 1.3 Session（Entity）

```typescript
// src/domain/session.ts

type SessionStatus =
  | "spawning"
  | "running"
  | "recycling"
  | "completed"
  | "failed"
  | "killed";

interface Session {
  readonly id: string;                   // session-{timestamp}-{random4}
  readonly taskId: string;
  readonly missionId: string;
  processId: number | null;              // OS process ID, null before spawn
  readonly model: string;
  tokenEstimate: number;                 // 累計估算 token 消耗
  status: SessionStatus;
  readonly spawnedAt: string;            // ISO 8601
  lastHeartbeatAt: string;              // ISO 8601
  completedAt: string | null;
  exitCode: number | null;
  readonly recycledFrom: string | null;  // 前一個被回收的 session ID
}
```

### 1.4 ContextLedger（Value Object）

```typescript
// src/domain/context-ledger.ts

interface Artifact {
  readonly id: string;                   // artifact-{timestamp}-{random4}
  readonly sessionId: string;
  readonly taskId: string;
  readonly type: "code" | "decision" | "error" | "summary" | "progress";
  readonly content: string;
  readonly createdAt: string;            // ISO 8601
}

interface Decision {
  readonly id: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly summary: string;              // 一行描述
  readonly rationale: string;            // 決策理由
  readonly createdAt: string;
}

interface SessionContext {
  readonly sessionId: string;
  readonly taskId: string;
  tokenEstimate: number;
  readonly filesRead: string[];
  readonly filesWritten: string[];
  status: "running" | "completed" | "recycled" | "failed";
}

interface ContextLedger {
  readonly missionId: string;
  readonly sessions: SessionContext[];
  readonly artifacts: Artifact[];
  readonly decisions: Decision[];
}
```

**設計決策**:
- `ContextLedger` 是 value object — 所有修改透過 application layer 的 port 完成，回傳新的 ledger 實例。
- `Artifact.type` 使用 union type 而非 enum，保持 domain 層的純淨性。

### 1.5 TaskGraph（DAG）

```typescript
// src/domain/task-graph.ts

interface TaskNode {
  readonly taskId: string;
  readonly status: TaskStatus;
  readonly dependencies: string[];       // 入邊：此 task 依賴的 task IDs
  readonly dependents: string[];         // 出邊：依賴此 task 的 task IDs
}

interface TaskGraph {
  readonly nodes: ReadonlyMap<string, TaskNode>;

  /** 回傳所有 dependencies 已 completed 且自身為 pending 的 tasks */
  getReadyTasks(): string[];

  /** 標記 task 完成，回傳新的 graph（immutable） */
  markCompleted(taskId: string): TaskGraph;

  /** 標記 task 失敗 */
  markFailed(taskId: string): TaskGraph;

  /** 檢查是否有環（建構時驗證） */
  hasCycle(): boolean;

  /** 取得拓撲排序結果 */
  getTopologicalOrder(): string[];

  /** 檢查所有 tasks 是否已完成或 abandoned */
  isTerminal(): boolean;
}
```

**設計決策**:
- `TaskGraph` 為 immutable — `markCompleted` / `markFailed` 回傳新實例。
- 建構時使用 Kahn's algorithm 偵測環，若有環則 throw `DomainError`。
- v0.1 為線性執行，`getReadyTasks()` 最多回傳一個 task。v0.2 開放平行。

### 1.6 HookEvent（Value Object）

```typescript
// src/domain/hook-event.ts

// CONTEXT: Claude Code hooks 回傳的原始結構
// 參考: https://docs.anthropic.com/en/docs/claude-code/hooks

type HookEventType =
  | "PostToolUse"
  | "PreCompact"
  | "Stop"
  | "SessionStart";

interface PostToolUsePayload {
  readonly sessionId: string;
  readonly tool: string;               // Read, Write, Edit, Bash, Grep, Glob
  readonly input: Record<string, unknown>;
  readonly output: string;             // 工具的輸出文字
  readonly outputTokenEstimate: number; // 由 daemon 計算：output.length / 4
}

interface PreCompactPayload {
  readonly sessionId: string;
  // WHY: PreCompact 是最後防線，觸發即表示估算失準
}

interface StopPayload {
  readonly sessionId: string;
  readonly stopReason: "end_turn" | "max_tokens" | "stop_sequence";
  readonly lastAssistantMessage: string;
}

interface SessionStartPayload {
  readonly sessionId: string;
  readonly model: string;
}

type HookEvent =
  | { readonly type: "PostToolUse";  readonly payload: PostToolUsePayload }
  | { readonly type: "PreCompact";   readonly payload: PreCompactPayload }
  | { readonly type: "Stop";         readonly payload: StopPayload }
  | { readonly type: "SessionStart"; readonly payload: SessionStartPayload };
```

**設計決策**:
- 使用 discriminated union 而非繼承，讓 TypeScript compiler 可以 exhaustive check。
- `outputTokenEstimate` 在 adapter 層計算後嵌入 payload，domain 層不負責估算邏輯。

### 1.7 ModelConfig（Value Object）

```typescript
// src/domain/model-config.ts

interface ModelSpec {
  readonly name: string;
  readonly contextWindowTokens: number;
  readonly recycleThresholdRatio: number;  // 預設 0.75
}

// AI-INVARIANT: recycleThreshold = contextWindowTokens * recycleThresholdRatio
// 此計算在 domain 層以純函式實作

type ModelRegistry = ReadonlyMap<string, ModelSpec>;

// 預設 model 規格
const DEFAULT_MODELS: Record<string, ModelSpec> = {
  "claude-opus-4-6":       { name: "claude-opus-4-6",       contextWindowTokens: 200_000, recycleThresholdRatio: 0.75 },
  "claude-opus-4-6[1m]":   { name: "claude-opus-4-6[1m]",   contextWindowTokens: 1_000_000, recycleThresholdRatio: 0.75 },
  "claude-sonnet-4-6":     { name: "claude-sonnet-4-6",     contextWindowTokens: 200_000, recycleThresholdRatio: 0.75 },
  "claude-sonnet-4-6[1m]": { name: "claude-sonnet-4-6[1m]", contextWindowTokens: 1_000_000, recycleThresholdRatio: 0.75 },
  "claude-haiku-4-5":      { name: "claude-haiku-4-5",      contextWindowTokens: 200_000, recycleThresholdRatio: 0.75 },
};
```

---

## 2. Application Layer — Ports

Port 定義在 application 層，由 adapter 層實作。所有 port 方法回傳 `Promise`。

### 2.1 ContextLedgerPort

```typescript
// src/application/ports/context-ledger-port.ts

interface ContextLedgerPort {
  /** 載入指定 mission 的 ledger，不存在則回傳空 ledger */
  load(missionId: string): Promise<ContextLedger>;

  /** 儲存整個 ledger（覆寫） */
  save(ledger: ContextLedger): Promise<void>;

  /** 新增 artifact 到 ledger */
  addArtifact(missionId: string, artifact: Artifact): Promise<void>;

  /** 新增 decision 到 ledger */
  addDecision(missionId: string, decision: Decision): Promise<void>;

  /** 新增或更新 session context */
  upsertSessionContext(
    missionId: string,
    sessionContext: SessionContext
  ): Promise<void>;

  /** 取得特定 task 的所有 artifacts */
  getArtifactsForTask(
    missionId: string,
    taskId: string
  ): Promise<Artifact[]>;

  /** 取得特定 task 的所有 decisions */
  getDecisionsForTask(
    missionId: string,
    taskId: string
  ): Promise<Decision[]>;
}
```

### 2.2 SessionManagerPort

```typescript
// src/application/ports/session-manager-port.ts

interface SpawnOptions {
  readonly model: string;
  readonly prompt: string;
  readonly workingDirectory: string;
  readonly maxBudgetUsd: number;
  readonly env: Record<string, string>;
}

interface SpawnResult {
  readonly sessionId: string;
  readonly processId: number;
}

interface SessionManagerPort {
  /** 啟動新的 Claude CLI session */
  spawn(options: SpawnOptions): Promise<SpawnResult>;

  /** 強制終止 session process */
  kill(processId: number): Promise<void>;

  /** 檢查 process 是否仍在執行 */
  isAlive(processId: number): Promise<boolean>;

  /** 取得所有由 daemon 管理的執行中 process IDs */
  getRunningProcessIds(): Promise<number[]>;

  /** 等待 process 結束，回傳 exit code */
  waitForExit(processId: number): Promise<number>;
}
```

### 2.3 PersistencePort

```typescript
// src/application/ports/persistence-port.ts

interface PersistencePort {
  /** 讀取 JSON 檔案並反序列化 */
  readJson<T>(filePath: string): Promise<T | null>;

  /** 序列化並寫入 JSON 檔案（atomic write） */
  writeJson<T>(filePath: string, data: T): Promise<void>;

  /** 讀取純文字檔案 */
  readFile(filePath: string): Promise<string | null>;

  /** 寫入純文字檔案 */
  writeFile(filePath: string, content: string): Promise<void>;

  /** 確保目錄存在（recursive mkdir） */
  ensureDir(dirPath: string): Promise<void>;

  /** 列出目錄下的檔案 */
  listFiles(dirPath: string): Promise<string[]>;

  /** 檢查路徑是否存在 */
  exists(filePath: string): Promise<boolean>;
}
```

### 2.4 MissionRepositoryPort

```typescript
// src/application/ports/mission-repository-port.ts

// WHY: Mission 和 Task 的 CRUD 獨立為 repository port，
// 與 PersistencePort（低階檔案操作）分離，
// 讓 use case 不需要知道檔案路徑結構。

interface MissionRepositoryPort {
  save(mission: Mission): Promise<void>;
  findById(missionId: string): Promise<Mission | null>;
  updateStatus(missionId: string, status: MissionStatus): Promise<void>;
}

interface TaskRepositoryPort {
  saveAll(missionId: string, tasks: Task[]): Promise<void>;
  findByMissionId(missionId: string): Promise<Task[]>;
  findById(missionId: string, taskId: string): Promise<Task | null>;
  update(missionId: string, task: Task): Promise<void>;
}
```

### 2.5 GitCheckpointPort

```typescript
// src/application/ports/git-checkpoint-port.ts

interface GitCheckpointPort {
  /** 建立 git checkpoint commit */
  commit(message: string): Promise<string>;  // 回傳 commit hash

  /** 取得目前 HEAD commit hash */
  getCurrentHead(): Promise<string>;
}
```

---

## 3. Application Layer — Use Cases

每個 use case 定義 Input DTO、Output DTO、依賴的 ports。

### 3.1 StartMissionUseCase

```typescript
// src/application/use-cases/start-mission.ts

interface StartMissionInput {
  readonly description: string;
  readonly model?: string;               // 預設使用 config 的 default model
  readonly maxRetries?: number;          // 預設 2
  readonly costLimitUsd?: number;        // 預設 10
  readonly durationLimitMinutes?: number; // 預設 120
}

interface StartMissionOutput {
  readonly missionId: string;
  readonly name: string;
  readonly taskCount: number;
  readonly tasks: Array<{
    readonly id: string;
    readonly title: string;
    readonly dependencies: string[];
  }>;
}

// 依賴: MissionRepositoryPort, TaskRepositoryPort,
//        SessionManagerPort, ContextLedgerPort, PersistencePort

// 流程:
// 1. 建立 Mission entity（status: planning）
// 2. Spawn planning session: claude -p "分解以下任務為 tasks..."
// 3. 解析 planning session 輸出為 Task[]
// 4. 建立 TaskGraph 驗證 DAG 合法性
// 5. 儲存 Mission + Tasks + 初始 Ledger
// 6. 更新 Mission status → running
// 7. 回傳 StartMissionOutput
```

### 3.2 AssignTaskUseCase

```typescript
// src/application/use-cases/assign-task.ts

interface AssignTaskInput {
  readonly missionId: string;
  readonly taskId: string;
}

interface AssignTaskOutput {
  readonly sessionId: string;
  readonly model: string;
  readonly prompt: string;               // 建構完成的 curated prompt
  readonly processId: number;
}

// 依賴: MissionRepositoryPort, TaskRepositoryPort,
//        SessionManagerPort, ContextLedgerPort

// 流程:
// 1. 載入 Task + Mission
// 2. 確認 task status 為 pending 或 retrying
// 3. 決定 model（task.model ?? mission.config.defaultModel）
// 4. 建構 curated prompt（見 Section 3.2.1）
// 5. Spawn session
// 6. 建立 Session entity
// 7. 更新 Task status → assigned → running
// 8. 更新 Ledger 的 SessionContext
// 9. 回傳 AssignTaskOutput
```

#### 3.2.1 Curated Prompt 建構規格

```typescript
interface CuratedPromptParts {
  readonly taskTitle: string;
  readonly taskDescription: string;
  readonly acceptanceCriteria: string[];
  readonly previousArtifacts: Artifact[];  // 僅與此 task 相關
  readonly relevantDecisions: Decision[];
  readonly filesWrittenByOtherTasks: string[];
  readonly taskSpecificInstructions: string;
}

// AI-INVARIANT: 最終 prompt 必須 < 10,000 tokens（約 40,000 字元）
// 若 artifacts 過多，依 createdAt 倒序取最新 N 筆，直到總量 < 上限
```

Curated prompt 模板：

```
你正在進行專案的任務。

## 任務: {taskId} - {taskTitle}
{taskDescription}

## 驗收標準
{acceptanceCriteria 逐項列出}

## 前次進度
{previousArtifacts，依時間排序}

## 已做的關鍵決策
{relevantDecisions}

## 其他 session 已修改的檔案
{filesWrittenByOtherTasks}

## 指示
1. 讀取 CLAUDE.md 了解專案規範
2. 從前次進度繼續，不要重做已完成的工作
3. {taskSpecificInstructions}
4. 完成後在最後一行輸出 "TASK_COMPLETE" 標記
```

### 3.3 HandleHookEventUseCase

```typescript
// src/application/use-cases/handle-hook-event.ts

interface HandleHookEventInput {
  readonly event: HookEvent;
}

// 無明確 output — side effects 透過 ports 執行

// 依賴: ContextLedgerPort, SessionManagerPort,
//        TaskRepositoryPort, MissionRepositoryPort

// 流程（依 event type 分支）:
//
// PostToolUse:
//   1. 更新 SessionContext.tokenEstimate += payload.outputTokenEstimate
//   2. 更新 filesRead / filesWritten
//   3. 若 tokenEstimate > recycleThreshold → 觸發 RecycleSessionUseCase
//
// PreCompact:
//   1. 立即觸發 RecycleSessionUseCase（估算失準的兜底）
//
// Stop:
//   1. 從 lastAssistantMessage 擷取結果
//   2. 建立 Artifact（type: summary）
//   3. 檢查是否包含 "TASK_COMPLETE" 標記
//   4. 若包含 → 更新 Task status → completed
//   5. 若不包含 → 判斷是否需要 retry
//   6. 觸發下一個 ready task 的 AssignTaskUseCase
//
// SessionStart:
//   1. 在 Ledger 中註冊新 SessionContext
```

### 3.4 RecycleSessionUseCase

```typescript
// src/application/use-cases/recycle-session.ts

interface RecycleSessionInput {
  readonly sessionId: string;
  readonly reason: "token_threshold" | "pre_compact" | "heartbeat_timeout";
}

interface RecycleSessionOutput {
  readonly oldSessionId: string;
  readonly newSessionId: string;
  readonly newProcessId: number;
  readonly artifactsSaved: number;
}

// 依賴: SessionManagerPort, ContextLedgerPort,
//        TaskRepositoryPort, MissionRepositoryPort

// 流程:
// 1. 載入舊 session 的 context
// 2. 從 Stop hook 或 process stdout 擷取最後狀態
// 3. 建立 Artifact（type: progress）記錄中間進度
// 4. Kill 舊 session process
// 5. 更新舊 session status → recycled
// 6. 建構新的 curated prompt（含前次進度 artifacts）
// 7. Spawn 新 session
// 8. 新 session.recycledFrom = 舊 sessionId
// 9. 更新 Task.assignedSessionId
// 10. 回傳 RecycleSessionOutput
```

### 3.5 VerifyTaskUseCase

```typescript
// src/application/use-cases/verify-task.ts

// CONTEXT: v0.1 驗證邏輯簡化 — 僅在 Stop event 中檢查 TASK_COMPLETE 標記
// v0.2 將加入獨立 verifier session

interface VerifyTaskInput {
  readonly missionId: string;
  readonly taskId: string;
}

interface VerifyTaskOutput {
  readonly passed: boolean;
  readonly reason: string;
  readonly checkResults: Array<{
    readonly criteria: string;
    readonly passed: boolean;
    readonly detail: string;
  }>;
}

// 依賴: TaskRepositoryPort, ContextLedgerPort, SessionManagerPort

// v0.1 流程:
// 1. 檢查 task 最後的 artifact 是否含 TASK_COMPLETE
// 2. 若有 checkCommand，spawn 短命 session 執行驗證
// 3. 回傳結果

// v0.2 流程（延後）:
// 1. Spawn verifier session
// 2. Verifier 讀取 acceptance criteria + 程式碼變更
// 3. 判斷是否通過
```

### 3.6 ReplanUseCase

```typescript
// src/application/use-cases/replan.ts

// CONTEXT: v0.1 的重規劃為簡易版 — 直接 retry 同一 task
// v0.2 將加入 AI 驅動的錯誤分析與 task 拆分

interface ReplanInput {
  readonly missionId: string;
  readonly failedTaskIds: string[];
}

interface ReplanOutput {
  readonly retriedTaskIds: string[];     // 可重試的 tasks
  readonly abandonedTaskIds: string[];   // 超過重試上限的 tasks
  readonly missionContinues: boolean;    // false 表示 mission 整體失敗
}

// 依賴: TaskRepositoryPort, MissionRepositoryPort

// v0.1 流程:
// 1. 檢查每個 failed task 的 retryCount < maxRetries
// 2. 可重試者：status → retrying, retryCount++
// 3. 不可重試者：status → abandoned
// 4. 若所有 tasks 都 abandoned 或 completed → 判斷 mission 是否完成
```

### 3.7 CheckHealthUseCase

```typescript
// src/application/use-cases/check-health.ts

interface CheckHealthInput {
  readonly missionId: string;
}

interface SessionHealth {
  readonly sessionId: string;
  readonly taskId: string;
  readonly processAlive: boolean;
  readonly tokenEstimate: number;
  readonly recycleThreshold: number;
  readonly tokenUtilization: number;     // tokenEstimate / recycleThreshold
  readonly lastHeartbeatAge: number;     // 距上次 heartbeat 的秒數
  readonly status: SessionStatus;
}

interface CheckHealthOutput {
  readonly missionId: string;
  readonly missionStatus: MissionStatus;
  readonly activeSessions: SessionHealth[];
  readonly completedTasks: number;
  readonly totalTasks: number;
  readonly totalTokensConsumed: number;
  readonly estimatedCostUsd: number;
  readonly uptime: number;               // daemon 啟動至今的秒數
  readonly warnings: string[];           // 如：session 卡死、token 接近上限
}

// 依賴: SessionManagerPort, ContextLedgerPort,
//        TaskRepositoryPort, MissionRepositoryPort

// 流程:
// 1. 載入 mission + tasks + ledger
// 2. 對每個 running session 呼叫 isAlive()
// 3. 計算各項指標
// 4. 若 session 超過 heartbeat timeout → 加入 warnings
// 5. 若 session 已死但 task 未完成 → 觸發 RecycleSessionUseCase
```

---

## 4. REST API Contract

Base URL: `http://localhost:{port}` (預設 port 7777)

### 4.1 POST /missions

啟動新 mission。

**Request:**
```typescript
interface CreateMissionRequest {
  readonly description: string;
  readonly model?: string;
  readonly maxRetries?: number;
  readonly costLimitUsd?: number;
  readonly durationLimitMinutes?: number;
}
```

**Response (201):**
```typescript
interface CreateMissionResponse {
  readonly missionId: string;
  readonly name: string;
  readonly status: MissionStatus;
  readonly taskCount: number;
  readonly tasks: Array<{
    readonly id: string;
    readonly title: string;
    readonly dependencies: string[];
  }>;
}
```

**Error (400):**
```typescript
interface ErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly details?: Record<string, unknown>;
}
```

### 4.2 GET /missions/:id

取得 mission 目前狀態。

**Response (200):**
```typescript
interface GetMissionResponse {
  readonly mission: Mission;
  readonly progress: {
    readonly completedTasks: number;
    readonly totalTasks: number;
    readonly activeSessions: number;
    readonly totalTokensConsumed: number;
  };
}
```

### 4.3 GET /missions/:id/tasks

取得 mission 所有 tasks 及其狀態。

**Response (200):**
```typescript
interface GetTasksResponse {
  readonly tasks: Task[];
  readonly graph: {
    readonly readyTasks: string[];
    readonly isTerminal: boolean;
  };
}
```

### 4.4 GET /missions/:id/sessions

取得 mission 的活躍 sessions。

**Response (200):**
```typescript
interface GetSessionsResponse {
  readonly sessions: Array<Session & {
    readonly processAlive: boolean;
    readonly tokenUtilization: number;
  }>;
}
```

### 4.5 GET /missions/:id/ledger

取得完整 context ledger。

**Response (200):**
```typescript
interface GetLedgerResponse {
  readonly ledger: ContextLedger;
  readonly stats: {
    readonly totalArtifacts: number;
    readonly totalDecisions: number;
    readonly totalSessions: number;
  };
}
```

### 4.6 DELETE /missions/:id

停止 mission，kill 所有相關 sessions。

**Response (200):**
```typescript
interface DeleteMissionResponse {
  readonly missionId: string;
  readonly killedSessions: number;
  readonly finalStatus: MissionStatus;
}
```

### 4.7 GET /health

Daemon 健康檢查。

**Response (200):**
```typescript
interface HealthResponse {
  readonly status: "ok" | "degraded" | "error";
  readonly uptime: number;
  readonly activeMissions: number;
  readonly activeSessions: number;
  readonly version: string;
}
```

### 4.8 POST /hooks/:eventType

Hook 事件接收端點。詳見 Section 5。

**Response (200):**
```typescript
interface HookResponse {
  readonly received: boolean;
  readonly action?: "none" | "recycle" | "complete" | "fail";
}
```

---

## 5. Hook Event Payloads

Claude Code hooks 透過 `curl` POST JSON 到 daemon。以下為各 hook 的 payload 規格。

### 5.1 Hook 安裝格式

Daemon 啟動時寫入 `.claude/settings.local.json`：

```typescript
interface HookInstallation {
  readonly hooks: {
    readonly PostToolUse: Array<{
      readonly matcher: string;              // "Read|Write|Edit|Bash|Grep|Glob"
      readonly hooks: Array<{
        readonly type: "command";
        readonly command: string;            // curl 指令
      }>;
    }>;
    readonly PreCompact: Array<{
      readonly hooks: Array<{
        readonly type: "command";
        readonly command: string;
      }>;
    }>;
    readonly Stop: Array<{
      readonly hooks: Array<{
        readonly type: "command";
        readonly command: string;
      }>;
    }>;
    // CONTEXT: SessionStart hook 不存在於 Claude Code 官方 API
    // 改用 spawn 時由 daemon 自行註冊
  };
}
```

### 5.2 PostToolUse Hook Payload

```typescript
// POST /hooks/post-tool-use
interface PostToolUseHookBody {
  readonly session_id: string;
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly tool_output: string;
}
```

Daemon 收到後轉換為 `HookEvent<PostToolUsePayload>`，計算 `outputTokenEstimate = tool_output.length / 4`。

### 5.3 PreCompact Hook Payload

```typescript
// POST /hooks/pre-compact
interface PreCompactHookBody {
  readonly session_id: string;
}
```

### 5.4 Stop Hook Payload

```typescript
// POST /hooks/stop
interface StopHookBody {
  readonly session_id: string;
  readonly stop_reason: "end_turn" | "max_tokens" | "stop_sequence";
  readonly last_assistant_message: string;
}
```

### 5.5 curl 指令範本

```bash
# PostToolUse hook command
curl -s -X POST http://localhost:7777/hooks/post-tool-use \
  -H "Content-Type: application/json" \
  -d '{"session_id":"$CLAUDE_SESSION_ID","tool_name":"$TOOL_NAME","tool_input":$TOOL_INPUT,"tool_output":"$TOOL_OUTPUT"}'

# PreCompact hook command
curl -s -X POST http://localhost:7777/hooks/pre-compact \
  -H "Content-Type: application/json" \
  -d '{"session_id":"$CLAUDE_SESSION_ID"}'

# Stop hook command
curl -s -X POST http://localhost:7777/hooks/stop \
  -H "Content-Type: application/json" \
  -d '{"session_id":"$CLAUDE_SESSION_ID","stop_reason":"$STOP_REASON","last_assistant_message":"$LAST_ASSISTANT_MESSAGE"}'
```

> **AI-CAUTION**: Hook command 中的環境變數由 Claude Code 注入。實際可用的變數需依 Claude Code hook 文件確認，上述為推測值。實作時需驗證。

---

## 6. Config Schema

```typescript
// src/infrastructure/config.ts

interface DaemonConfig {
  /** HTTP server port */
  readonly port: number;                        // 預設: 7777

  /** 工作目錄（daemon 資料儲存位置） */
  readonly dataDir: string;                     // 預設: ./data

  /** 專案根目錄 */
  readonly projectRoot: string;                 // 預設: process.cwd()

  /** Model 相關設定 */
  readonly models: {
    /** 預設 model（無 task-level override 時使用） */
    readonly defaultModel: string;              // 預設: "claude-sonnet-4-6"

    /** 自訂 model registry（擴充或覆寫 DEFAULT_MODELS） */
    readonly custom: Record<string, {
      readonly contextWindowTokens: number;
      readonly recycleThresholdRatio?: number;  // 預設 0.75
    }>;
  };

  /** Session 管理 */
  readonly session: {
    /** 每個 session 的最大成本（USD） */
    readonly maxBudgetUsd: number;              // 預設: 5

    /** Heartbeat 間隔（秒） */
    readonly heartbeatIntervalSeconds: number;  // 預設: 30

    /** Heartbeat timeout（秒）— 超過即判定卡死 */
    readonly heartbeatTimeoutSeconds: number;   // 預設: 120

    /** 最大同時執行 sessions（v0.1 固定為 1） */
    readonly maxConcurrentSessions: number;     // 預設: 1
  };

  /** Mission 安全限制 */
  readonly safety: {
    /** 單一 mission 最大成本（USD） */
    readonly maxMissionCostUsd: number;         // 預設: 50

    /** 單一 mission 最大持續時間（分鐘） */
    readonly maxMissionDurationMinutes: number; // 預設: 240

    /** 單一 task 最大重試次數 */
    readonly maxTaskRetries: number;            // 預設: 2

    /** 最大 recycle 次數 per task（防止無限 recycle） */
    readonly maxRecyclesPerTask: number;        // 預設: 5
  };

  /** Curated prompt 限制 */
  readonly prompt: {
    /** 最大 prompt token 數 */
    readonly maxPromptTokens: number;           // 預設: 10_000

    /** 最大 artifacts 數量（per task） */
    readonly maxArtifactsPerTask: number;       // 預設: 10
  };

  /** Git checkpoint */
  readonly git: {
    /** 是否在 task 完成時自動 commit */
    readonly autoCheckpoint: boolean;           // 預設: true

    /** Commit message 前綴 */
    readonly commitPrefix: string;              // 預設: "daemon:"
  };

  /** Claude CLI 執行設定 */
  readonly cli: {
    /** Claude CLI 執行檔路徑 */
    readonly executable: string;                // 預設: "claude"

    /** 額外 CLI flags */
    readonly extraFlags: string[];              // 預設: []

    /** 是否使用 --dangerously-skip-permissions */
    readonly skipPermissions: boolean;          // 預設: false
  };
}
```

Config 載入優先順序：
1. CLI 參數（最高優先）
2. 環境變數 `DAEMON_*`（如 `DAEMON_PORT=8888`）
3. 設定檔 `daemon.config.json`（專案根目錄）
4. 預設值

---

## 7. Model-Aware Token Management

### 7.1 Token 估算演算法

```typescript
// Domain layer 純函式

/**
 * 估算文字的 token 數量。
 *
 * CONTEXT: 精確的 tokenization 需要 tiktoken 等外部套件，
 * 但 domain 層不允許外部依賴。使用 chars/4 作為近似值，
 * 對英文準確率約 75%，對中日韓文字偏低估。
 * 乘以 safety factor 1.2 補償。
 *
 * @param text 輸入文字
 * @returns 估算的 token 數
 */
function estimateTokens(text: string): number;

// AI-INVARIANT: estimateTokens = Math.ceil(text.length / 4 * 1.2)
```

### 7.2 Recycle 閾值計算

```typescript
/**
 * 計算給定 model 的 session recycle 閾值。
 *
 * @param modelName model 識別名稱
 * @param registry model registry（含 context window 資訊）
 * @returns recycle 閾值（tokens），超過即觸發回收
 */
function calculateRecycleThreshold(
  modelName: string,
  registry: ModelRegistry
): number;

// AI-INVARIANT: threshold = contextWindowTokens * recycleThresholdRatio
// 若 model 不在 registry 中，使用保守值 200K * 0.5 = 100K
```

### 7.3 Token 追蹤流程

```
Session spawned
     │
     ▼
PostToolUse hook received
     │
     ├─ tool_output.length / 4 * 1.2 → delta tokens
     │
     ▼
session.tokenEstimate += delta
     │
     ├─ tokenEstimate < recycleThreshold → continue
     │
     ├─ tokenEstimate >= recycleThreshold → RecycleSessionUseCase
     │
     └─ PreCompact received → RecycleSessionUseCase (兜底)
```

### 7.4 Model 決定優先順序

```
1. task.model（per-task override）
   ↓ null
2. mission.config.defaultModel
   ↓ null
3. daemonConfig.models.defaultModel
   ↓ 未設定
4. "claude-sonnet-4-6"（硬編碼 fallback）
```

---

## 8. Error Types

```typescript
// src/domain/errors.ts

class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DomainError";
  }
}

// 具體 domain errors:
// - INVALID_TRANSITION: 不合法的狀態轉移
// - CYCLE_DETECTED: TaskGraph 中偵測到環
// - TASK_NOT_FOUND: 找不到指定 task
// - MISSION_NOT_FOUND: 找不到指定 mission

// src/application/errors.ts

class ApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

// 具體 application errors:
// - MISSION_ALREADY_RUNNING: 嘗試在 running mission 中重複啟動
// - SESSION_SPAWN_FAILED: Claude CLI 啟動失敗
// - PROMPT_TOO_LARGE: Curated prompt 超過 token 上限
// - COST_LIMIT_EXCEEDED: 超過成本上限
// - DURATION_LIMIT_EXCEEDED: 超過時間上限
// - MAX_RETRIES_EXCEEDED: 超過重試上限

// src/infrastructure/errors.ts

class InfrastructureError extends Error {
  constructor(
    message: string,
    public readonly cause: Error
  ) {
    super(message);
    this.name = "InfrastructureError";
  }
}

// 具體 infrastructure errors:
// - FILE_READ_ERROR: 檔案讀取失敗
// - FILE_WRITE_ERROR: 檔案寫入失敗
// - PROCESS_SPAWN_ERROR: Process 啟動失敗
// - SERVER_START_ERROR: HTTP server 啟動失敗
```

---

## 9. File-to-Interface Mapping

每個原始碼檔案與本文件中介面的對應關係：

| 檔案路徑 | 包含的介面 | 行數預估 |
|---|---|---|
| `src/domain/mission.ts` | `Mission`, `MissionConfig`, `MissionStatus` | ~40 |
| `src/domain/task.ts` | `Task`, `TaskStatus`, `AcceptanceCriteria`, `VALID_TRANSITIONS` | ~80 |
| `src/domain/session.ts` | `Session`, `SessionStatus` | ~30 |
| `src/domain/context-ledger.ts` | `ContextLedger`, `Artifact`, `Decision`, `SessionContext` | ~50 |
| `src/domain/task-graph.ts` | `TaskGraph`, `TaskNode` + `createTaskGraph()` 建構函式 | ~120 |
| `src/domain/hook-event.ts` | `HookEvent`, 各 payload types | ~60 |
| `src/domain/model-config.ts` | `ModelSpec`, `ModelRegistry`, `DEFAULT_MODELS` | ~40 |
| `src/domain/errors.ts` | `DomainError` | ~20 |
| `src/application/ports/context-ledger-port.ts` | `ContextLedgerPort` | ~30 |
| `src/application/ports/session-manager-port.ts` | `SessionManagerPort`, `SpawnOptions`, `SpawnResult` | ~30 |
| `src/application/ports/persistence-port.ts` | `PersistencePort` | ~25 |
| `src/application/ports/mission-repository-port.ts` | `MissionRepositoryPort`, `TaskRepositoryPort` | ~25 |
| `src/application/ports/git-checkpoint-port.ts` | `GitCheckpointPort` | ~15 |
| `src/application/use-cases/start-mission.ts` | `StartMissionInput`, `StartMissionOutput` | ~80 |
| `src/application/use-cases/assign-task.ts` | `AssignTaskInput`, `AssignTaskOutput`, `CuratedPromptParts` | ~90 |
| `src/application/use-cases/handle-hook-event.ts` | `HandleHookEventInput` | ~100 |
| `src/application/use-cases/recycle-session.ts` | `RecycleSessionInput`, `RecycleSessionOutput` | ~70 |
| `src/application/use-cases/verify-task.ts` | `VerifyTaskInput`, `VerifyTaskOutput` | ~50 |
| `src/application/use-cases/replan.ts` | `ReplanInput`, `ReplanOutput` | ~50 |
| `src/application/use-cases/check-health.ts` | `CheckHealthInput`, `CheckHealthOutput`, `SessionHealth` | ~60 |
| `src/application/errors.ts` | `ApplicationError` | ~20 |
| `src/infrastructure/config.ts` | `DaemonConfig` | ~80 |
| `src/infrastructure/errors.ts` | `InfrastructureError` | ~15 |

**總計約 25 個檔案，每個 < 300 行**，符合專案規範。

---

## 設計決策摘要

| 決策 | 選擇 | 理由 |
|---|---|---|
| Domain 不 import 外部套件 | 純 TS types + 純函式 | Clean Architecture 核心規範 |
| Token 估算用 chars/4 * 1.2 | 不用 tiktoken | Domain 層無外部依賴限制；safety factor 補償 |
| TaskGraph immutable | markCompleted 回傳新實例 | 避免 mutation side effects，簡化測試 |
| HookEvent 用 discriminated union | 非 class hierarchy | TypeScript exhaustive checking + 無 runtime 依賴 |
| Session ID 格式 session-{ts}-{rand} | 非 UUID | 人類可讀 + 時間排序 + 無需 uuid 套件 |
| Config 四層優先順序 | CLI > Env > File > Default | 符合 12-factor app 慣例 |
| v0.1 線性執行 | maxConcurrentSessions = 1 | 降低 MVP 複雜度，DAG 平行排程延至 v0.2 |
| MissionRepo / TaskRepo 獨立於 PersistencePort | Repository 模式 | Use case 不需知道檔案路徑結構 |
| Curated prompt < 10K tokens | 硬上限 | 確保新 session 有足夠 context 空間工作 |
