// Domain Layer — Model Configuration

export interface ModelSpec {
  readonly name: string;
  readonly contextWindowTokens: number;
  readonly recycleThresholdRatio: number;
}

export type ModelRegistry = ReadonlyMap<string, ModelSpec>;

const DEFAULT_MODELS: Record<string, ModelSpec> = {
  "claude-opus-4-6": {
    name: "claude-opus-4-6",
    contextWindowTokens: 200_000,
    recycleThresholdRatio: 0.75,
  },
  "claude-opus-4-6[1m]": {
    name: "claude-opus-4-6[1m]",
    contextWindowTokens: 1_000_000,
    recycleThresholdRatio: 0.75,
  },
  "claude-sonnet-4-6": {
    name: "claude-sonnet-4-6",
    contextWindowTokens: 200_000,
    recycleThresholdRatio: 0.75,
  },
  "claude-sonnet-4-6[1m]": {
    name: "claude-sonnet-4-6[1m]",
    contextWindowTokens: 1_000_000,
    recycleThresholdRatio: 0.75,
  },
  "claude-haiku-4-5": {
    name: "claude-haiku-4-5",
    contextWindowTokens: 200_000,
    recycleThresholdRatio: 0.75,
  },
};

export function createDefaultRegistry(): ModelRegistry {
  return new Map(Object.entries(DEFAULT_MODELS));
}

export function createRegistry(
  customModels?: Record<string, ModelSpec>
): ModelRegistry {
  const registry = new Map(Object.entries(DEFAULT_MODELS));

  if (customModels) {
    for (const [name, spec] of Object.entries(customModels)) {
      registry.set(name, spec);
    }
  }

  return registry;
}

export function getContextWindowSize(
  registry: ModelRegistry,
  modelName: string
): number | null {
  const spec = registry.get(modelName);
  return spec?.contextWindowTokens ?? null;
}

// AI-INVARIANT: recycleThreshold = contextWindowTokens * recycleThresholdRatio
export function calculateRecycleThreshold(
  registry: ModelRegistry,
  modelName: string,
  ratioOverride?: number
): number | null {
  const spec = registry.get(modelName);
  if (!spec) return null;

  const ratio = ratioOverride ?? spec.recycleThresholdRatio;
  return Math.floor(spec.contextWindowTokens * ratio);
}

export function isKnownModel(
  registry: ModelRegistry,
  modelName: string
): boolean {
  return registry.has(modelName);
}

// WHY: 粗略的 token 估算 — 以 4 字元 ≈ 1 token 計算
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
