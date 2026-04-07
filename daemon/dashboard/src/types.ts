export type AgentRole = 'architect' | 'implementer' | 'tester' | 'documenter' | 'tech-lead';

// WHY: 退化色調搭配 post-apocalyptic 主題，每個角色有專屬辨識色
export const ROLE_COLORS: Record<AgentRole, string> = {
  architect: '#6b8ab0',    // 藍灰 — 設計者
  implementer: '#c8a050',  // 琥珀 — 建造者
  tester: '#5a8a50',       // 衰綠 — 檢驗者
  documenter: '#8b7a5a',   // 棕褐 — 記錄者
  'tech-lead': '#c8603c',  // 鏽紅 — 指揮者
};

export type DaemonEventType =
  | 'mission:started'
  | 'mission:completed'
  | 'mission:failed'
  | 'mission:cancelled'
  | 'task:assigned'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:retrying'
  | 'task:abandoned'
  | 'session:spawned'
  | 'session:recycled'
  | 'session:completed'
  | 'session:killed'
  | 'session:token-updated'
  | 'hook:received'
  | 'health:warning'
  | 'artifact:created'
  | 'decision:recorded';

export interface DaemonEvent {
  readonly id: string;
  readonly type: DaemonEventType;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}

export type MissionStatus =
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'running'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'abandoned';

export type SessionStatus =
  | 'spawning'
  | 'running'
  | 'recycling'
  | 'completed'
  | 'killed';

export interface MissionSnapshot {
  readonly id: string;
  readonly name: string;
  readonly status: MissionStatus;
  readonly taskCount: number;
  readonly completedTasks: number;
  readonly sessionCount: number;
}

export interface TaskSnapshot {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: TaskStatus;
  readonly dependencies: string[];
  readonly sessionId?: string;
  readonly model?: string;
  readonly tokenUsage?: number;
  readonly recycleThreshold?: number;
  readonly retryCount?: number;
  readonly maxRetries?: number;
  readonly files?: string[];
  readonly acceptanceCriteria?: string[];
  readonly role?: AgentRole;
  readonly worktreePath?: string;
}

export interface SessionSnapshot {
  readonly id: string;
  readonly taskId: string;
  readonly model: string;
  readonly status: SessionStatus;
  readonly tokenEstimate: number;
  readonly recycleThreshold: number;
  readonly utilization: number;
  readonly role?: AgentRole;
}

export interface TokenDataPoint {
  readonly time: string;
  readonly [sessionId: string]: number | string;
}

export interface Decision {
  readonly id: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly summary: string;
  readonly rationale: string;
  readonly affectedFiles: string[];
  readonly createdAt: string;
}

export interface MissionDetail {
  readonly mission: MissionSnapshot;
  readonly tasks: TaskSnapshot[];
  readonly sessions: SessionSnapshot[];
  readonly decisions: Decision[];
}

export interface DashboardState {
  readonly missions: MissionSnapshot[];
  readonly tasks: TaskSnapshot[];
  readonly sessions: SessionSnapshot[];
  readonly decisions: Decision[];
  readonly tokenHistory: TokenDataPoint[];
}

export function getEventCategory(type: DaemonEventType): string {
  return type.split(':')[0];
}

// WHY: 退化色調搭配 post-apocalyptic 主題
export const EVENT_CATEGORY_COLORS: Record<string, string> = {
  mission: '#1a6b6b',
  task: '#3d6b5a',
  session: '#6b2a4a',
  hook: '#8b6a2a',
  health: '#cc3333',
  artifact: '#8b5e3c',
  decision: '#c8a050',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: '#5a5248',
  assigned: '#1a6b6b',
  running: '#3d6b5a',
  verifying: '#8b6a2a',
  completed: '#3d6b5a',
  failed: '#cc3333',
  retrying: '#8b6a2a',
  abandoned: '#cc3333',
  planning: '#5a5248',
  paused: '#8b6a2a',
  cancelled: '#cc3333',
  spawning: '#1a6b6b',
  recycling: '#8b6a2a',
  killed: '#cc3333',
};

export interface MissionCreateRequest {
  readonly description: string;
  readonly maxConcurrentSessions: number;
}
