import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { RpcServer } from '@crabpal/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

const registeredChannels: string[] = []

mock.module('electron', () => ({
  ipcMain: {
    handle: () => {},
    on: () => {},
  },
  // Minimal stubs for symbols imported by IPC domain modules
  app: {
    isPackaged: false,
    getAppPath: () => '/',
    quit: () => {},
    dock: { setIcon: () => {}, setBadge: () => {} },
  },
  nativeTheme: { shouldUseDarkColors: false },
  nativeImage: {
    createFromPath: () => ({ isEmpty: () => true }),
    createFromDataURL: () => ({}),
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showMessageBox: async () => ({ response: 0 }),
  },
  shell: {
    openExternal: async () => {},
    openPath: async () => '',
    showItemInFolder: () => {},
  },
  BrowserWindow: {
    fromWebContents: () => null,
    getFocusedWindow: () => null,
    getAllWindows: () => [],
  },
  BrowserView: class {},
  Menu: {
    buildFromTemplate: () => ({ popup: () => {} }),
  },
  session: {},
}))

function createMockServer(): RpcServer {
  return {
    handle(channel: string, _handler: unknown) {
      registeredChannels.push(channel)
    },
    push() {},
    async invokeClient() {},
  }
}

function createMockDeps(): HandlerDeps {
  return {
    sessionManager: {} as HandlerDeps['sessionManager'],
    platform: {
      appRootPath: '',
      resourcesPath: '',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: console,
      imageProcessor: {
        getMetadata: async () => null,
        process: async () => Buffer.from(''),
      },
    },
    windowManager: {} as HandlerDeps['windowManager'],
    browserPaneManager: {
      onStateChange: () => {},
      onRemoved: () => {},
      onInteracted: () => {},
    } as unknown as NonNullable<HandlerDeps['browserPaneManager']>,
    oauthFlowStore: {
      store: () => {},
      getByState: () => null,
      remove: () => {},
      cleanup: () => {},
      dispose: () => {},
      size: 0,
    } as unknown as HandlerDeps['oauthFlowStore'],
  }
}

async function getExpectedChannels(): Promise<Set<string>> {
  // Core handler channels (now in server-core)
  const [
    auth,
    automations,
    files,
    labels,
    llm,
    oauth,
    sessions,
    coreSettings,
    skills,
    sources,
    statuses,
    coreSystem,
    coreWorkspace,
    onboarding,
  ] = await Promise.all([
    import('@crabpal/server-core/handlers/rpc/auth'),
    import('@crabpal/server-core/handlers/rpc/automations'),
    import('@crabpal/server-core/handlers/rpc/files'),
    import('@crabpal/server-core/handlers/rpc/labels'),
    import('@crabpal/server-core/handlers/rpc/llm-connections'),
    import('@crabpal/server-core/handlers/rpc/oauth'),
    import('@crabpal/server-core/handlers/rpc/sessions'),
    import('@crabpal/server-core/handlers/rpc/settings'),
    import('@crabpal/server-core/handlers/rpc/skills'),
    import('@crabpal/server-core/handlers/rpc/sources'),
    import('@crabpal/server-core/handlers/rpc/statuses'),
    import('@crabpal/server-core/handlers/rpc/system'),
    import('@crabpal/server-core/handlers/rpc/workspace'),
    import('@crabpal/server-core/handlers/rpc/onboarding'),
  ])

  // GUI handler channels (remain in electron)
  const [browser, guiSystem, guiWorkspace, guiSettings, guiAccount, guiProject] = await Promise.all([
    import('../browser'),
    import('../system'),
    import('../workspace'),
    import('../settings'),
    import('../account'),
    import('../project'),
  ])

  return new Set([
    ...auth.HANDLED_CHANNELS,
    ...automations.HANDLED_CHANNELS,
    ...files.HANDLED_CHANNELS,
    ...labels.HANDLED_CHANNELS,
    ...llm.HANDLED_CHANNELS,
    ...oauth.HANDLED_CHANNELS,
    ...sessions.HANDLED_CHANNELS,
    ...coreSettings.HANDLED_CHANNELS,
    ...skills.HANDLED_CHANNELS,
    ...sources.HANDLED_CHANNELS,
    ...statuses.HANDLED_CHANNELS,
    ...coreSystem.CORE_HANDLED_CHANNELS,
    ...coreWorkspace.CORE_HANDLED_CHANNELS,
    ...onboarding.HANDLED_CHANNELS,
    ...browser.HANDLED_CHANNELS,
    ...guiSystem.GUI_HANDLED_CHANNELS,
    ...guiWorkspace.GUI_HANDLED_CHANNELS,
    ...guiSettings.GUI_HANDLED_CHANNELS,
    ...guiAccount.GUI_HANDLED_CHANNELS,
    ...guiProject.GUI_HANDLED_CHANNELS,
  ])
}

describe('RPC handler registration', () => {
  beforeEach(() => {
    registeredChannels.length = 0
  })

  it('registers all declared handled channels exactly once', async () => {
    const expected = await getExpectedChannels()
    const { registerAllRpcHandlers } = await import('../index')

    registerAllRpcHandlers(createMockServer(), createMockDeps())

    const appChannels = registeredChannels.filter(ch => ch.includes(':'))
    const actual = new Set(appChannels)

    const missing = [...expected].filter(ch => !actual.has(ch)).sort()
    const unexpected = [...actual].filter(ch => !expected.has(ch)).sort()

    expect(missing).toEqual([])
    expect(unexpected).toEqual([])

    // Check for duplicates
    const counts = new Map<string, number>()
    for (const ch of appChannels) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1)
    }
    const duplicates = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([channel, count]) => `${channel} (${count}x)`)
      .sort()

    expect(duplicates).toEqual([])
  })

  it('keeps onboarding channels in registration coverage', async () => {
    const { HANDLED_CHANNELS } = await import('@crabpal/server-core/handlers/rpc/onboarding')
    const { registerAllRpcHandlers } = await import('../index')

    registerAllRpcHandlers(createMockServer(), createMockDeps())

    const actual = new Set(registeredChannels)
    const missingOnboarding = HANDLED_CHANNELS.filter(ch => !actual.has(ch))

    expect(missingOnboarding).toEqual([])
  })
})
