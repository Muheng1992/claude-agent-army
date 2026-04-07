// src/infrastructure/hooks-installer.ts
// WHY: 安裝 daemon hooks 到 .claude/settings.local.json，不覆蓋使用者既有設定

import { join } from 'node:path';
import type { PersistencePort } from '../application/ports/persistence-port.js';

interface HookEntry {
  readonly type: 'command';
  readonly command: string;
}

interface HookMatcher {
  readonly matcher?: string;
  readonly hooks: HookEntry[];
}

interface SettingsHooks {
  PostToolUse?: HookMatcher[];
  PreCompact?: HookMatcher[];
  Stop?: HookMatcher[];
  [key: string]: HookMatcher[] | undefined;
}

interface SettingsLocal {
  hooks?: SettingsHooks;
  [key: string]: unknown;
}

const DAEMON_MARKER = '# daemon-orchestrator';

export async function installHooks(
  projectRoot: string,
  port: number,
  persistence: PersistencePort
): Promise<void> {
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  const existing = await persistence.readJson<SettingsLocal>(settingsPath);
  const settings: SettingsLocal = existing ?? {};
  const hooks: SettingsHooks = settings.hooks ?? {};

  const baseUrl = `http://localhost:${port}`;

  hooks.PostToolUse = mergeHooks(
    hooks.PostToolUse ?? [],
    buildPostToolUseHook(baseUrl)
  );

  hooks.PreCompact = mergeHooks(
    hooks.PreCompact ?? [],
    buildPreCompactHook(baseUrl)
  );

  hooks.Stop = mergeHooks(
    hooks.Stop ?? [],
    buildStopHook(baseUrl)
  );

  settings.hooks = hooks;
  await persistence.writeJson(settingsPath, settings);

  console.log(`[hooks-installer] Hooks installed to ${settingsPath}`);
}

export async function uninstallHooks(
  projectRoot: string,
  persistence: PersistencePort
): Promise<void> {
  const settingsPath = join(projectRoot, '.claude', 'settings.local.json');
  const existing = await persistence.readJson<SettingsLocal>(settingsPath);
  if (!existing?.hooks) return;

  const hooks = existing.hooks;
  for (const key of Object.keys(hooks)) {
    const matchers = hooks[key];
    if (Array.isArray(matchers)) {
      hooks[key] = matchers.filter(
        (m) => !m.hooks.some((h) => h.command.includes(DAEMON_MARKER))
      );
    }
  }

  existing.hooks = hooks;
  await persistence.writeJson(settingsPath, existing);
  console.log(`[hooks-installer] Hooks uninstalled from ${settingsPath}`);
}

function buildPostToolUseHook(baseUrl: string): HookMatcher {
  return {
    matcher: 'Read|Write|Edit|Bash|Grep|Glob',
    hooks: [{
      type: 'command',
      command:
        `curl -s -X POST ${baseUrl}/hooks/post-tool-use ` +
        `-H "Content-Type: application/json" ` +
        `-d '{"session_id":"$CLAUDE_SESSION_ID","tool_name":"$TOOL_NAME",' ` +
        `'"tool_output":""}' ${DAEMON_MARKER}`,
    }],
  };
}

function buildPreCompactHook(baseUrl: string): HookMatcher {
  return {
    hooks: [{
      type: 'command',
      command:
        `curl -s -X POST ${baseUrl}/hooks/pre-compact ` +
        `-H "Content-Type: application/json" ` +
        `-d '{"session_id":"$CLAUDE_SESSION_ID"}' ${DAEMON_MARKER}`,
    }],
  };
}

function buildStopHook(baseUrl: string): HookMatcher {
  return {
    hooks: [{
      type: 'command',
      command:
        `curl -s -X POST ${baseUrl}/hooks/stop ` +
        `-H "Content-Type: application/json" ` +
        `-d '{"session_id":"$CLAUDE_SESSION_ID","stop_reason":"end_turn",' ` +
        `'"last_assistant_message":""}' ${DAEMON_MARKER}`,
    }],
  };
}

/** 合併 hooks：移除舊 daemon hooks 再加入新的 */
function mergeHooks(
  existing: HookMatcher[],
  newHook: HookMatcher
): HookMatcher[] {
  const filtered = existing.filter(
    (m) => !m.hooks.some((h) => h.command.includes(DAEMON_MARKER))
  );
  return [...filtered, newHook];
}
