import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'

const STORAGE_MODULE_PATH = pathToFileURL(join(import.meta.dir, '..', 'storage.ts')).href

function runEnsureConfigDir(homeDir: string): void {
  const { CRABPAL_CONFIG_DIR, CRAB_PAL_CONFIG_DIR, ...baseEnv } = process.env
  void CRABPAL_CONFIG_DIR
  void CRAB_PAL_CONFIG_DIR

  const run = Bun.spawnSync([
    process.execPath,
    '--eval',
    `import { ensureConfigDir } from '${STORAGE_MODULE_PATH}'; ensureConfigDir();`,
  ], {
    env: {
      ...baseEnv,
      HOME: homeDir,
      USERPROFILE: homeDir,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (run.exitCode !== 0) {
    throw new Error(
      `ensureConfigDir subprocess failed (exit ${run.exitCode})\nstdout:\n${run.stdout.toString()}\nstderr:\n${run.stderr.toString()}`,
    )
  }
}

function setupLegacyHome() {
  const homeDir = mkdtempSync(join(tmpdir(), 'crabpal-home-'))
  const legacyConfigDir = join(homeDir, '.craft-agent')
  const legacyWorkspaceRoot = join(legacyConfigDir, 'workspaces', 'legacy-space')

  mkdirSync(legacyWorkspaceRoot, { recursive: true })

  writeFileSync(
    join(legacyConfigDir, 'config.json'),
    JSON.stringify({
      workspaces: [
        {
          id: 'ws-1',
          name: 'Legacy Workspace',
          rootPath: legacyWorkspaceRoot,
          createdAt: 1,
        },
      ],
      activeWorkspaceId: 'ws-1',
      activeSessionId: null,
      llmConnections: [],
    }, null, 2),
    'utf-8',
  )

  writeFileSync(
    join(legacyWorkspaceRoot, 'config.json'),
    JSON.stringify({
      id: 'ws-1',
      name: 'Legacy Workspace',
      slug: 'legacy-space',
      defaults: {
        workingDirectory: join(legacyWorkspaceRoot, 'sandbox'),
      },
      createdAt: 1,
      updatedAt: 1,
    }, null, 2),
    'utf-8',
  )

  writeFileSync(
    join(legacyConfigDir, 'preferences.json'),
    JSON.stringify({
      lastWorkspacePath: legacyWorkspaceRoot,
    }, null, 2),
    'utf-8',
  )

  writeFileSync(join(legacyConfigDir, 'credentials.enc'), 'legacy-secret', 'utf-8')

  return {
    homeDir,
    legacyConfigDir,
    legacyWorkspaceRoot,
    crabpalConfigDir: join(homeDir, '.crabpal'),
  }
}

describe('legacy config dir import', () => {
  it('imports legacy ~/.craft-agent data into ~/.crabpal and rewrites default paths', () => {
    const { crabpalConfigDir, legacyWorkspaceRoot, homeDir } = setupLegacyHome()

    runEnsureConfigDir(homeDir)

    const importedConfig = JSON.parse(readFileSync(join(crabpalConfigDir, 'config.json'), 'utf-8'))
    const importedWorkspaceConfig = JSON.parse(readFileSync(join(crabpalConfigDir, 'workspaces', 'legacy-space', 'config.json'), 'utf-8'))
    const importedPreferences = JSON.parse(readFileSync(join(crabpalConfigDir, 'preferences.json'), 'utf-8'))
    const importMarker = JSON.parse(readFileSync(join(crabpalConfigDir, '.legacy-import-complete.json'), 'utf-8'))

    expect(importedConfig.workspaces[0].rootPath).toBe(join(crabpalConfigDir, 'workspaces', 'legacy-space'))
    expect(importedWorkspaceConfig.defaults.workingDirectory).toBe(join(crabpalConfigDir, 'workspaces', 'legacy-space', 'sandbox'))
    expect(importedPreferences.lastWorkspacePath).toBe(join(crabpalConfigDir, 'workspaces', 'legacy-space'))
    expect(readFileSync(join(crabpalConfigDir, 'credentials.enc'), 'utf-8')).toBe('legacy-secret')
    expect(importMarker.outcome).toBe('imported')
    expect(importMarker.copiedEntries).toContain('config.json')
    expect(importMarker.copiedEntries).toContain('workspaces')
    expect(legacyWorkspaceRoot).toBe(join(homeDir, '.craft-agent', 'workspaces', 'legacy-space'))
  })

  it('does not overwrite an existing CrabPal config root', () => {
    const { crabpalConfigDir, homeDir } = setupLegacyHome()
    const existingWorkspaceRoot = join(crabpalConfigDir, 'workspaces', 'existing-space')

    mkdirSync(existingWorkspaceRoot, { recursive: true })
    writeFileSync(
      join(crabpalConfigDir, 'config.json'),
      JSON.stringify({
        workspaces: [
          {
            id: 'ws-existing',
            name: 'Existing Workspace',
            rootPath: existingWorkspaceRoot,
            createdAt: 1,
          },
        ],
        activeWorkspaceId: 'ws-existing',
        activeSessionId: null,
        llmConnections: [],
      }, null, 2),
      'utf-8',
    )

    runEnsureConfigDir(homeDir)

    const config = JSON.parse(readFileSync(join(crabpalConfigDir, 'config.json'), 'utf-8'))
    const importMarker = JSON.parse(readFileSync(join(crabpalConfigDir, '.legacy-import-complete.json'), 'utf-8'))

    expect(config.workspaces[0].id).toBe('ws-existing')
    expect(config.workspaces[0].rootPath).toBe(existingWorkspaceRoot)
    expect(importMarker.outcome).toBe('skipped-existing-target')
    expect(existsSync(join(crabpalConfigDir, 'credentials.enc'))).toBe(false)
  })
})
