// src/application/dtos/hook-event-dto.ts
// WHY: Raw hook payloads use snake_case (from curl/Claude Code),
// these types parse into domain HookEvent with camelCase.

import type { HookEvent } from "../../domain/hook-event.js";
import { estimateTokens } from "../../domain/model-config.js";

export interface PostToolUseHookBody {
  readonly session_id: string;
  readonly tool_name: string;
  readonly tool_input: Record<string, unknown>;
  readonly tool_output: string;
}

export interface PreCompactHookBody {
  readonly session_id: string;
}

export interface StopHookBody {
  readonly session_id: string;
  readonly stop_reason: "end_turn" | "max_tokens" | "stop_sequence";
  readonly last_assistant_message: string;
}

export function parsePostToolUseEvent(
  body: PostToolUseHookBody
): HookEvent {
  return {
    type: "PostToolUse",
    payload: {
      sessionId: body.session_id,
      tool: body.tool_name,
      input: body.tool_input,
      output: body.tool_output,
      outputTokenEstimate: estimateTokens(body.tool_output),
    },
  };
}

export function parsePreCompactEvent(
  body: PreCompactHookBody
): HookEvent {
  return {
    type: "PreCompact",
    payload: {
      sessionId: body.session_id,
    },
  };
}

export function parseStopEvent(body: StopHookBody): HookEvent {
  return {
    type: "Stop",
    payload: {
      sessionId: body.session_id,
      stopReason: body.stop_reason,
      lastAssistantMessage: body.last_assistant_message,
    },
  };
}
