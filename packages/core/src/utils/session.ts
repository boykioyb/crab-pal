/**
 * Session-level helpers that operate purely on types — no I/O.
 */
import type { Project } from '../types/project.ts';

/**
 * Minimal shape required to resolve an effective working directory.
 * Accepts any object with an optional per-session working-directory override.
 */
interface SessionLike {
  workingDirectory?: string;
}

/**
 * Resolve the effective working directory for a session.
 *
 *   session.workingDirectory ?? project.rootPath
 *
 * Use this everywhere a session needs a CWD (agent spawn, bash tool,
 * MCP server launch, etc.) so per-session overrides are honored while
 * project-default CWDs remain the common case.
 */
export function getEffectiveWorkingDirectory(
  session: SessionLike,
  project: Pick<Project, 'rootPath'>,
): string {
  return session.workingDirectory ?? project.rootPath;
}
