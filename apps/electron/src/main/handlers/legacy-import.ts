import { RPC_CHANNELS } from '@crabpal/shared/protocol'
import type { RpcServer } from '@crabpal/server-core/transport'
import {
  detectLegacyPresence,
  previewLegacyImport,
  importLegacySelective,
  type ImportOptions,
  type LegacyCategory,
} from '@crabpal/shared/config'

export function registerLegacyImportHandlers(server: RpcServer): void {
  server.handle(RPC_CHANNELS.legacyImport.DETECT, async () => {
    return detectLegacyPresence()
  })

  server.handle(RPC_CHANNELS.legacyImport.PREVIEW, async (_ctx, categories: LegacyCategory[]) => {
    return previewLegacyImport(categories)
  })

  server.handle(
    RPC_CHANNELS.legacyImport.RUN,
    async (ctx, options: Omit<ImportOptions, 'onProgress'>) => {
      return importLegacySelective({
        ...options,
        onProgress: event => {
          server.push(
            RPC_CHANNELS.legacyImport.PROGRESS,
            { to: 'client', clientId: ctx.clientId },
            event,
          )
        },
      })
    },
  )
}
