/**
 * @crabpal/shared
 *
 * Shared business logic for CrabPal.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { ClaudeAgent } from '@crabpal/shared/agent';
 *   import { loadStoredConfig } from '@crabpal/shared/config';
 *   import { getCredentialManager } from '@crabpal/shared/credentials';
 *   import { CrabPalMcpClient } from '@crabpal/shared/mcp';
 *   import { debug } from '@crabpal/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@crabpal/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@crabpal/shared/workspaces';
 *
 * Available modules:
 *   - agent: ClaudeAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: CrabPal API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
