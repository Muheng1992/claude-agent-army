// src/adapters/controllers/hook-controller.ts
// WHY: 接收 Claude Code hooks 的 HTTP 端點，轉換為 domain HookEvent

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HookEvent } from '../../domain/hook-event.js';
import type { HandleHookEventUseCase } from '../../application/use-cases/handle-hook-event.js';
import { estimateTokens } from '../../domain/model-config.js';

export interface HookControllerDeps {
  handleHookEvent: HandleHookEventUseCase;
}

export function createHookRouter(deps: HookControllerDeps): Router {
  const router = Router();

  router.post('/session-start', handleSessionStart(deps));
  router.post('/post-tool-use', handlePostToolUse(deps));
  router.post('/pre-compact', handlePreCompact(deps));
  router.post('/stop', handleStop(deps));

  return router;
}

function handleSessionStart(deps: HookControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body ?? {};
      const event: HookEvent = {
        type: 'SessionStart',
        payload: {
          sessionId: String(body.session_id ?? ''),
          model: String(body.model ?? ''),
        },
      };
      const missionId = String(body.mission_id ?? '');
      await deps.handleHookEvent.execute({ missionId, event });
      res.json({ received: true, action: 'none' });
    } catch (err) {
      sendHookError(res, err);
    }
  };
}

function handlePostToolUse(deps: HookControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body ?? {};
      const output = String(body.tool_output ?? '');
      const event: HookEvent = {
        type: 'PostToolUse',
        payload: {
          sessionId: String(body.session_id ?? ''),
          tool: String(body.tool_name ?? ''),
          input: (body.tool_input as Record<string, unknown>) ?? {},
          output,
          outputTokenEstimate: estimateTokens(output),
        },
      };
      const missionId = String(body.mission_id ?? '');
      await deps.handleHookEvent.execute({ missionId, event });
      res.json({ received: true, action: 'none' });
    } catch (err) {
      sendHookError(res, err);
    }
  };
}

function handlePreCompact(deps: HookControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body ?? {};
      const event: HookEvent = {
        type: 'PreCompact',
        payload: {
          sessionId: String(body.session_id ?? ''),
        },
      };
      const missionId = String(body.mission_id ?? '');
      await deps.handleHookEvent.execute({ missionId, event });
      res.json({ received: true, action: 'recycle' });
    } catch (err) {
      sendHookError(res, err);
    }
  };
}

const VALID_STOP_REASONS = new Set(['end_turn', 'max_tokens', 'stop_sequence']);

function handleStop(deps: HookControllerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body ?? {};
      const rawReason = String(body.stop_reason ?? 'end_turn');
      const stopReason = VALID_STOP_REASONS.has(rawReason)
        ? (rawReason as 'end_turn' | 'max_tokens' | 'stop_sequence')
        : 'end_turn';
      const event: HookEvent = {
        type: 'Stop',
        payload: {
          sessionId: String(body.session_id ?? ''),
          stopReason,
          lastAssistantMessage: String(body.last_assistant_message ?? ''),
        },
      };
      const missionId = String(body.mission_id ?? '');
      await deps.handleHookEvent.execute({ missionId, event });
      const hasComplete = String(body.last_assistant_message ?? '').includes('TASK_COMPLETE');
      res.json({
        received: true,
        action: hasComplete ? 'complete' : 'none',
      });
    } catch (err) {
      sendHookError(res, err);
    }
  };
}

/** Hook 端點的錯誤回應 — hook 失敗不應阻塞 session */
function sendHookError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[hook-controller] Error processing hook:', message);
  // WHY: 回傳 200 而非 5xx，因為 hook 失敗不應讓 Claude session 卡住
  res.json({ received: false, error: message });
}
