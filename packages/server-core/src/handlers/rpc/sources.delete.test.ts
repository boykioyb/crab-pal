import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { RPC_CHANNELS } from '@crabpal/shared/protocol'
import type { HandlerFn, RequestContext, RpcServer } from '@crabpal/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

const deleteSourceMock = mock(() => {})
const updatedSources = [
  {
    workspaceId: 'ws-1',
    folderPath: '/tmp/ws/.crabpal/sources/kept',
    config: {
      slug: 'kept',
      name: 'Kept Source',
      type: 'mcp',
    },
  },
] as any[]
const loadWorkspaceSourcesMock = mock(() => updatedSources)
const loadWorkspaceConfigMock = mock(() => ({
  defaults: {
    enabledSourceSlugs: ['deleted-source', 'kept'],
  },
}))
const saveWorkspaceConfigMock = mock(() => {})

mock.module('@crabpal/shared/config', () => ({
  getWorkspaceByNameOrId: (workspaceId: string) => (
    workspaceId === 'ws-1'
      ? { id: 'ws-1', rootPath: '/tmp/ws' }
      : null
  ),
}))

mock.module('@crabpal/shared/sources', () => ({
  deleteSource: deleteSourceMock,
  loadWorkspaceSources: loadWorkspaceSourcesMock,
}))

mock.module('@crabpal/shared/workspaces', () => ({
  loadWorkspaceConfig: loadWorkspaceConfigMock,
  saveWorkspaceConfig: saveWorkspaceConfigMock,
}))

async function createTestHarness() {
  const handlers = new Map<string, HandlerFn>()
  const pushCalls: Array<{ channel: string; target: any; args: any[] }> = []

  const server: RpcServer = {
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    push(channel, target, ...args) {
      pushCalls.push({ channel, target, args })
    },
    async invokeClient() {
      return undefined
    },
  }

  const deps: HandlerDeps = {
    sessionManager: {} as HandlerDeps['sessionManager'],
    oauthFlowStore: {} as HandlerDeps['oauthFlowStore'],
    platform: {
      appRootPath: '/',
      resourcesPath: '/',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      imageProcessor: {
        getMetadata: async () => null,
        process: async () => Buffer.from(''),
      },
    },
  }

  const { registerSourcesHandlers } = await import('./sources')
  registerSourcesHandlers(server, deps)

  const deleteHandler = handlers.get(RPC_CHANNELS.sources.DELETE)
  if (!deleteHandler) {
    throw new Error('DELETE handler not registered')
  }

  const ctx: RequestContext = {
    clientId: 'client-1',
    workspaceId: 'ws-1',
    webContentsId: 101,
  }

  return { deleteHandler, ctx, pushCalls }
}

describe('registerSourcesHandlers DELETE', () => {
  beforeEach(() => {
    deleteSourceMock.mockClear()
    loadWorkspaceSourcesMock.mockClear()
    loadWorkspaceConfigMock.mockClear()
    saveWorkspaceConfigMock.mockClear()
  })

  it('broadcasts the updated sources list after deletion', async () => {
    const { deleteHandler, ctx, pushCalls } = await createTestHarness()

    await deleteHandler(ctx, 'ws-1', 'deleted-source')

    expect(deleteSourceMock).toHaveBeenCalledWith('/tmp/ws', 'deleted-source')
    expect(loadWorkspaceConfigMock).toHaveBeenCalledWith('/tmp/ws')
    expect(saveWorkspaceConfigMock).toHaveBeenCalledWith('/tmp/ws', {
      defaults: {
        enabledSourceSlugs: ['kept'],
      },
    })
    expect(loadWorkspaceSourcesMock).toHaveBeenCalledWith('/tmp/ws')
    expect(pushCalls).toEqual([
      {
        channel: RPC_CHANNELS.sources.CHANGED,
        target: { to: 'workspace', workspaceId: 'ws-1' },
        args: ['ws-1', updatedSources],
      },
    ])
  })
})
