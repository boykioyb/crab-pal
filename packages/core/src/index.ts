/**
 * @crabpal/core
 *
 * Core types and utilities for CrabPal.
 *
 * NOTE: This package currently only exports types and utilities.
 * Storage, credentials, agent, auth, mcp, and prompts are still
 * imported directly from src/ in the consuming apps.
 *
 * Storage helpers are intentionally NOT re-exported from the root entry
 * because they depend on Node built-ins (`node:fs`, `node:path`,
 * `node:crypto`). Re-exporting them here drags those modules into the
 * renderer bundle through type-only consumers of `@crabpal/core` and
 * breaks the Vite build. Import them via the subpath instead:
 *   import { listProjects } from '@crabpal/core/storage';
 */

// Re-export all types
export * from './types/index.ts';

// Re-export utilities
export * from './utils/index.ts';
