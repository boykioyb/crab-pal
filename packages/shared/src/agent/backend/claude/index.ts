/**
 * Claude Agent Module
 *
 * Exports the ClaudeEventAdapter for Claude SDK message → AgentEvent conversion.
 *
 * Note: The main ClaudeAgent class is at ../claude-agent.ts
 * for consistency with CodexAgent/CopilotAgent. This index re-exports.
 */

export { ClaudeAgent } from '../../claude-agent.ts';
export { ClaudeEventAdapter, buildWindowsSkillsDirError } from './event-adapter.ts';
export type { ClaudeAdapterCallbacks } from './event-adapter.ts';
