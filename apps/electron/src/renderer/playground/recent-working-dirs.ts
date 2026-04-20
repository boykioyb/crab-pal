export type RecentDirScenario = 'none' | 'few' | 'many'

const RECENT_DIR_SCENARIO_DATA: Record<RecentDirScenario, string[]> = {
  none: [],
  few: [
    '/Users/demo/projects/crabpal',
    '/Users/demo/projects/crabpal/apps/electron',
    '/Users/demo/projects/crabpal/packages/shared',
  ],
  many: [
    '/Users/demo/projects/crabpal',
    '/Users/demo/projects/crabpal/apps/electron',
    '/Users/demo/projects/crabpal/apps/viewer',
    '/Users/demo/projects/crabpal/apps/cli',
    '/Users/demo/projects/crabpal/packages/shared',
    '/Users/demo/projects/crabpal/packages/server-core',
    '/Users/demo/projects/crabpal/packages/pi-agent-server',
    '/Users/demo/projects/crabpal/packages/ui',
    '/Users/demo/projects/crabpal/scripts',
  ],
}

/** Return a copy of the fixture list for the selected scenario. */
export function getRecentDirsForScenario(scenario: RecentDirScenario): string[] {
  return [...RECENT_DIR_SCENARIO_DATA[scenario]]
}
