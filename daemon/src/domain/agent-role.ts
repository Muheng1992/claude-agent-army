// Domain Layer — Agent Role Definition Loading
// WHY: 從 .claude/agents/ 載入 agent 定義檔，供 session spawner 注入角色上下文

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentRole } from "./task.js";

export interface AgentDefinition {
  readonly role: AgentRole;
  readonly systemPrompt: string;
  readonly model?: string;
  readonly mode?: string;
  readonly isolation?: string;
}

// CONTEXT: Agent .md 檔案使用 YAML frontmatter（--- 區塊），需解析 model/mode/isolation 等欄位
export async function loadAgentDefinition(
  projectRoot: string,
  role: AgentRole
): Promise<AgentDefinition | null> {
  const agentFilePath = join(projectRoot, ".claude", "agents", `${role}.md`);

  try {
    const content = await readFile(agentFilePath, "utf-8");
    const frontmatter = parseFrontmatter(content);

    return {
      role,
      systemPrompt: content,
      model: frontmatter["model"] || undefined,
      mode: frontmatter["permissionMode"] || undefined,
      isolation: frontmatter["isolation"] || undefined,
    };
  } catch {
    // CONSTRAINT: Agent 定義檔可能不存在（如自訂角色），回傳 null 讓呼叫方降級處理
    return null;
  }
}

// WHY: 簡易 YAML frontmatter 解析 — 僅解析 key: value 格式，不支援巢狀結構
function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!content.startsWith("---")) return result;

  const endIndex = content.indexOf("---", 3);
  if (endIndex === -1) return result;

  const frontmatterBlock = content.substring(3, endIndex).trim();
  const lines = frontmatterBlock.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    // WHY: 跳過多行值（如 description 使用 > 或 | 標記）和陣列值
    if (value === ">" || value === "|" || value === "") continue;
    if (value.startsWith("-")) continue;

    result[key] = value;
  }

  return result;
}

// WHY: 根據角色產生角色特定的指示，附加到 curated prompt 中
export function getRoleInstructions(role: AgentRole): string {
  switch (role) {
    case "architect":
      return (
        "你的角色是 **架構師**。\n" +
        "- 只輸出設計文件，不要實作程式碼\n" +
        "- 產出介面定義、元件結構、資料流程描述\n" +
        "- 使用 plan mode：分析 → 設計 → 提案"
      );
    case "implementer":
      return (
        "你的角色是 **實作者**。\n" +
        "- 根據設計文件實作程式碼變更\n" +
        "- 遵循現有的 codebase 慣例與命名風格\n" +
        "- 在系統邊界加入錯誤處理"
      );
    case "tester":
      return (
        "你的角色是 **測試者**。\n" +
        "- 撰寫並執行測試，不要修改 source code\n" +
        "- 涵蓋 happy path 和主要錯誤路徑\n" +
        "- 執行 code review 和安全性掃描"
      );
    case "documenter":
      return (
        "你的角色是 **文件撰寫者**。\n" +
        "- 撰寫和更新專案文件\n" +
        "- 產生結構化報告並歸檔\n" +
        "- 維護文件索引和版本"
      );
    case "tech-lead":
      return (
        "你的角色是 **技術主管**。\n" +
        "- 協調和監督開發活動\n" +
        "- 不直接撰寫程式碼，委派給專業 agent\n" +
        "- 做出架構和實作決策"
      );
  }
}
