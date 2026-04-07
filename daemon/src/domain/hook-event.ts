// Domain Layer — HookEvent Discriminated Union

export type HookEventType =
  | "PostToolUse"
  | "PreCompact"
  | "Stop"
  | "SessionStart";

export interface PostToolUsePayload {
  readonly sessionId: string;
  readonly tool: string;
  readonly input: Record<string, unknown>;
  readonly output: string;
  readonly outputTokenEstimate: number;
}

export interface PreCompactPayload {
  readonly sessionId: string;
}

export interface StopPayload {
  readonly sessionId: string;
  readonly stopReason: "end_turn" | "max_tokens" | "stop_sequence";
  readonly lastAssistantMessage: string;
}

export interface SessionStartPayload {
  readonly sessionId: string;
  readonly model: string;
}

export type HookEvent =
  | { readonly type: "PostToolUse";  readonly payload: PostToolUsePayload }
  | { readonly type: "PreCompact";   readonly payload: PreCompactPayload }
  | { readonly type: "Stop";         readonly payload: StopPayload }
  | { readonly type: "SessionStart"; readonly payload: SessionStartPayload };

const VALID_HOOK_TYPES: readonly string[] = [
  "PostToolUse",
  "PreCompact",
  "Stop",
  "SessionStart",
];

const VALID_TOOLS: readonly string[] = [
  "Read", "Write", "Edit", "Bash", "Grep", "Glob",
];

const VALID_STOP_REASONS: readonly string[] = [
  "end_turn", "max_tokens", "stop_sequence",
];

export function parseHookEvent(raw: unknown): HookEvent {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("HookEvent must be a non-null object");
  }

  const obj = raw as Record<string, unknown>;
  const type = obj["type"];

  if (typeof type !== "string" || !VALID_HOOK_TYPES.includes(type)) {
    throw new Error(`Invalid hook event type: "${String(type)}"`);
  }

  const payload = obj["payload"];
  if (typeof payload !== "object" || payload === null) {
    throw new Error("HookEvent payload must be a non-null object");
  }

  const p = payload as Record<string, unknown>;

  switch (type) {
    case "PostToolUse":
      return parsePostToolUse(p);
    case "PreCompact":
      return parsePreCompact(p);
    case "Stop":
      return parseStop(p);
    case "SessionStart":
      return parseSessionStart(p);
    default:
      throw new Error(`Unhandled hook event type: "${type}"`);
  }
}

function parsePostToolUse(p: Record<string, unknown>): HookEvent {
  assertString(p, "sessionId");
  assertString(p, "tool");
  assertString(p, "output");

  if (!VALID_TOOLS.includes(p["tool"] as string)) {
    throw new Error(`Invalid tool: "${p["tool"]}"`);
  }

  const input = typeof p["input"] === "object" && p["input"] !== null
    ? p["input"] as Record<string, unknown>
    : {};

  const output = p["output"] as string;
  // WHY: outputTokenEstimate 可由呼叫端提供，否則從 output 長度估算
  const outputTokenEstimate = typeof p["outputTokenEstimate"] === "number"
    ? p["outputTokenEstimate"]
    : Math.ceil(output.length / 4);

  return {
    type: "PostToolUse",
    payload: {
      sessionId: p["sessionId"] as string,
      tool: p["tool"] as string,
      input,
      output,
      outputTokenEstimate,
    },
  };
}

function parsePreCompact(p: Record<string, unknown>): HookEvent {
  assertString(p, "sessionId");
  return {
    type: "PreCompact",
    payload: { sessionId: p["sessionId"] as string },
  };
}

function parseStop(p: Record<string, unknown>): HookEvent {
  assertString(p, "sessionId");
  assertString(p, "stopReason");
  assertString(p, "lastAssistantMessage");

  const stopReason = p["stopReason"] as string;
  if (!VALID_STOP_REASONS.includes(stopReason)) {
    throw new Error(`Invalid stop reason: "${stopReason}"`);
  }

  return {
    type: "Stop",
    payload: {
      sessionId: p["sessionId"] as string,
      stopReason: stopReason as StopPayload["stopReason"],
      lastAssistantMessage: p["lastAssistantMessage"] as string,
    },
  };
}

function parseSessionStart(p: Record<string, unknown>): HookEvent {
  assertString(p, "sessionId");
  assertString(p, "model");
  return {
    type: "SessionStart",
    payload: {
      sessionId: p["sessionId"] as string,
      model: p["model"] as string,
    },
  };
}

function assertString(obj: Record<string, unknown>, key: string): void {
  if (typeof obj[key] !== "string" || (obj[key] as string).length === 0) {
    throw new Error(`HookEvent payload.${key} must be a non-empty string`);
  }
}
