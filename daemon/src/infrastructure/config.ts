// src/infrastructure/config.ts
// WHY: 四層優先順序載入設定：CLI > Env > File > Default

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DaemonConfig {
  readonly port: number;
  readonly dataDir: string;
  readonly projectRoot: string;
  readonly models: {
    readonly defaultModel: string;
    readonly custom: Record<string, {
      readonly contextWindowTokens: number;
      readonly recycleThresholdRatio?: number;
    }>;
  };
  readonly session: {
    readonly maxBudgetUsd: number;
    readonly heartbeatIntervalSeconds: number;
    readonly heartbeatTimeoutSeconds: number;
    readonly maxConcurrentSessions: number;
  };
  readonly safety: {
    readonly maxMissionCostUsd: number;
    readonly maxMissionDurationMinutes: number;
    readonly maxTaskRetries: number;
    readonly maxRecyclesPerTask: number;
  };
  readonly prompt: {
    readonly maxPromptTokens: number;
    readonly maxArtifactsPerTask: number;
  };
  readonly git: {
    readonly autoCheckpoint: boolean;
    readonly commitPrefix: string;
  };
  readonly cli: {
    readonly executable: string;
    readonly extraFlags: string[];
    readonly skipPermissions: boolean;
  };
}

const DEFAULTS: DaemonConfig = {
  port: 7777,
  dataDir: './data',
  projectRoot: process.cwd(),
  models: {
    defaultModel: 'claude-opus-4-6[1m]',
    custom: {},
  },
  session: {
    maxBudgetUsd: 5,
    heartbeatIntervalSeconds: 30,
    heartbeatTimeoutSeconds: 120,
    maxConcurrentSessions: 3,
  },
  safety: {
    maxMissionCostUsd: 50,
    maxMissionDurationMinutes: 240,
    maxTaskRetries: 2,
    maxRecyclesPerTask: 5,
  },
  prompt: {
    maxPromptTokens: 10_000,
    maxArtifactsPerTask: 10,
  },
  git: {
    autoCheckpoint: true,
    commitPrefix: 'daemon:',
  },
  cli: {
    executable: 'claude',
    extraFlags: [],
    skipPermissions: false,
  },
};

/** 從檔案載入設定 */
function loadConfigFile(projectRoot: string): Partial<DaemonConfig> {
  try {
    const configPath = join(projectRoot, 'daemon.config.json');
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as Partial<DaemonConfig>;
  } catch {
    return {};
  }
}

/** 從環境變數載入設定 */
function loadEnvConfig(): Partial<DaemonConfig> {
  const config: Record<string, unknown> = {};
  const env = process.env;

  if (env.DAEMON_PORT) config.port = parseInt(env.DAEMON_PORT, 10);
  if (env.DAEMON_DATA_DIR) config.dataDir = env.DAEMON_DATA_DIR;
  if (env.DAEMON_PROJECT_ROOT) config.projectRoot = env.DAEMON_PROJECT_ROOT;
  if (env.DAEMON_DEFAULT_MODEL) {
    config.models = { defaultModel: env.DAEMON_DEFAULT_MODEL, custom: {} };
  }

  return config as Partial<DaemonConfig>;
}

/** 深度合併設定物件 */
function deepMerge(
  base: DaemonConfig,
  ...overrides: Partial<DaemonConfig>[]
): DaemonConfig {
  let result = { ...base };
  for (const override of overrides) {
    result = mergeTwo(result, override);
  }
  return result;
}

function mergeTwo(
  base: DaemonConfig,
  override: Partial<DaemonConfig>
): DaemonConfig {
  return {
    port: override.port ?? base.port,
    dataDir: override.dataDir ?? base.dataDir,
    projectRoot: override.projectRoot ?? base.projectRoot,
    models: { ...base.models, ...override.models },
    session: { ...base.session, ...override.session },
    safety: { ...base.safety, ...override.safety },
    prompt: { ...base.prompt, ...override.prompt },
    git: { ...base.git, ...override.git },
    cli: { ...base.cli, ...override.cli },
  };
}

/** 載入完整設定，按優先順序合併 */
export function loadConfig(
  cliOverrides: Partial<DaemonConfig> = {}
): DaemonConfig {
  const projectRoot = cliOverrides.projectRoot ?? DEFAULTS.projectRoot;
  const fileConfig = loadConfigFile(projectRoot);
  const envConfig = loadEnvConfig();
  return deepMerge(DEFAULTS, fileConfig, envConfig, cliOverrides);
}
