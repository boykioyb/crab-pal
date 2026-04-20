/**
 * ContextBreakdown — estimates per-category token usage for the /context modal.
 *
 * The Claude Agent SDK returns only aggregate `inputTokens` per message, so we
 * tokenize each prompt component locally. Tokens are approximated by
 * characters-per-token heuristic; accuracy is sufficient for a breakdown view.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Message } from '@crabpal/core/types';
import { getSessionToolDefs, SESSION_TOOL_REGISTRY } from '@crabpal/session-tools-core';
import { getSystemPrompt, findAllProjectContextFiles } from '../../prompts/system.ts';

// ============================================================
// Types
// ============================================================

export type ContextBucketId =
  | 'system'
  | 'tools'
  | 'mcp'
  | 'memory'
  | 'messages';

export interface ContextBucket {
  id: ContextBucketId;
  label: string;
  tokens: number;
  items?: number;
  subItems?: Array<{ label: string; tokens: number }>;
}

export interface ContextBreakdown {
  buckets: ContextBucket[];
  totalEstimated: number;
  totalActual?: number;
  contextWindow?: number;
  freeSpace?: number;
  model?: string;
}

export interface BuildContextBreakdownInput {
  workingDirectory?: string;
  workspaceRootPath?: string;
  enabledSourceSlugs?: string[];
  sourcesDir?: string;
  messages?: Message[];
  totalActual?: number;
  contextWindow?: number;
  model?: string;
}

// ============================================================
// Tokenization
// ============================================================

/** Characters per token heuristic (Anthropic-style English). */
const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateObjectTokens(obj: unknown): number {
  try {
    return estimateTokens(JSON.stringify(obj));
  } catch {
    return 0;
  }
}

// ============================================================
// Per-bucket estimators
// ============================================================

function estimateSystemPrompt(workingDirectory?: string, workspaceRootPath?: string): number {
  try {
    const prompt = getSystemPrompt(undefined, undefined, workspaceRootPath, workingDirectory);
    return estimateTokens(prompt);
  } catch {
    return 0;
  }
}

function estimateSystemTools(): { tokens: number; items: number; subItems: Array<{ label: string; tokens: number }> } {
  const defs = getSessionToolDefs({ includeDeveloperFeedback: true });
  const subItems: Array<{ label: string; tokens: number }> = [];
  let total = 0;
  for (const def of defs) {
    const schemaTokens = estimateObjectTokens(def.inputSchema);
    const descTokens = estimateTokens(def.description);
    const nameTokens = estimateTokens(def.name);
    const tokens = schemaTokens + descTokens + nameTokens;
    total += tokens;
    subItems.push({ label: def.name, tokens });
  }
  subItems.sort((a, b) => b.tokens - a.tokens);
  return { tokens: total, items: defs.length, subItems };
}

function estimateMcpTools(
  sourceSlugs: string[],
  sourcesDir?: string,
): { tokens: number; items: number; subItems: Array<{ label: string; tokens: number }> } {
  const subItems: Array<{ label: string; tokens: number }> = [];
  let total = 0;
  for (const slug of sourceSlugs) {
    let tokens = 0;
    if (sourcesDir) {
      const guidePath = join(sourcesDir, slug, 'guide.md');
      if (existsSync(guidePath)) {
        try {
          tokens = estimateTokens(readFileSync(guidePath, 'utf-8'));
        } catch {
          /* ignore */
        }
      }
    }
    total += tokens;
    subItems.push({ label: slug, tokens });
  }
  subItems.sort((a, b) => b.tokens - a.tokens);
  return { tokens: total, items: sourceSlugs.length, subItems };
}

function estimateMemoryFiles(workingDirectory?: string): {
  tokens: number;
  items: number;
  subItems: Array<{ label: string; tokens: number }>;
} {
  if (!workingDirectory) return { tokens: 0, items: 0, subItems: [] };
  const files = findAllProjectContextFiles(workingDirectory);
  const subItems: Array<{ label: string; tokens: number }> = [];
  let total = 0;
  for (const rel of files) {
    const abs = join(workingDirectory, rel);
    try {
      const content = readFileSync(abs, 'utf-8');
      const tokens = estimateTokens(content);
      total += tokens;
      subItems.push({ label: rel, tokens });
    } catch {
      /* ignore */
    }
  }
  return { tokens: total, items: files.length, subItems };
}

function estimateMessages(messages: Message[] | undefined): { tokens: number; items: number } {
  if (!messages || messages.length === 0) return { tokens: 0, items: 0 };
  let total = 0;
  let count = 0;
  for (const m of messages) {
    if (m.role === 'status') continue;
    count++;
    if (m.content) total += estimateTokens(m.content);
    if (m.toolInput) total += estimateObjectTokens(m.toolInput);
    if (m.toolResult) {
      total +=
        typeof m.toolResult === 'string'
          ? estimateTokens(m.toolResult)
          : estimateObjectTokens(m.toolResult);
    }
    if (m.toolName) total += estimateTokens(m.toolName);
  }
  return { tokens: total, items: count };
}

// ============================================================
// Public builder
// ============================================================

export function buildContextBreakdown(input: BuildContextBreakdownInput): ContextBreakdown {
  const systemTokens = estimateSystemPrompt(input.workingDirectory, input.workspaceRootPath);
  const tools = estimateSystemTools();
  const mcp = estimateMcpTools(input.enabledSourceSlugs ?? [], input.sourcesDir);
  const memory = estimateMemoryFiles(input.workingDirectory);
  const msgs = estimateMessages(input.messages);

  const buckets: ContextBucket[] = [
    { id: 'system', label: 'System prompt', tokens: systemTokens },
    { id: 'tools', label: 'System tools', tokens: tools.tokens, items: tools.items, subItems: tools.subItems },
    { id: 'mcp', label: 'MCP tools', tokens: mcp.tokens, items: mcp.items, subItems: mcp.subItems },
    { id: 'memory', label: 'Memory files', tokens: memory.tokens, items: memory.items, subItems: memory.subItems },
    { id: 'messages', label: 'Messages', tokens: msgs.tokens, items: msgs.items },
  ];

  const totalEstimated = buckets.reduce((sum, b) => sum + b.tokens, 0);
  // Free space = window minus whichever "used" value we trust more.
  // Prefer actual (from SDK) when available, else fall back to the local estimate.
  const used = input.totalActual ?? totalEstimated;
  const freeSpace =
    input.contextWindow !== undefined
      ? Math.max(0, input.contextWindow - used)
      : undefined;

  return {
    buckets,
    totalEstimated,
    totalActual: input.totalActual,
    contextWindow: input.contextWindow,
    freeSpace,
    model: input.model,
  };
}

/** Exported for debugging / smoke tests. */
export const __internal = {
  estimateSystemPrompt,
  estimateSystemTools,
  estimateMcpTools,
  estimateMemoryFiles,
  estimateMessages,
  SESSION_TOOL_REGISTRY,
};
