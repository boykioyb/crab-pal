import type { HandlerDeps } from './handler-deps'
import type { RpcServer } from '@crabpal/server-core/transport'
import { registerCoreRpcHandlers, type ServerHandlerContext } from '@crabpal/server-core/handlers/rpc'
export { registerCoreRpcHandlers }

// GUI-only handlers remain local (Electron-specific imports)
import { registerSystemGuiHandlers } from './system'
import { registerWorkspaceGuiHandlers } from './workspace'
import { registerBrowserHandlers } from './browser'
import { registerSettingsGuiHandlers } from './settings'
import { registerAccountHandlers } from './account'
import { registerProjectHandlers, seedDefaultProjectsOnBoot } from './project'
export { seedDefaultProjectsOnBoot }
import { registerLegacyImportHandlers } from './legacy-import'
import { registerLogsHandlers } from './logs'

export function registerGuiRpcHandlers(server: RpcServer, deps: HandlerDeps): void {
  registerSystemGuiHandlers(server, deps)
  registerWorkspaceGuiHandlers(server, deps)
  registerBrowserHandlers(server, deps)
  registerSettingsGuiHandlers(server, deps)
  registerAccountHandlers(server, deps)
  registerProjectHandlers(server, deps)
  registerLegacyImportHandlers(server)
  registerLogsHandlers(server, deps)
}

export function registerAllRpcHandlers(server: RpcServer, deps: HandlerDeps, serverCtx?: ServerHandlerContext): void {
  registerCoreRpcHandlers(server, deps, serverCtx)
  registerGuiRpcHandlers(server, deps)
}
