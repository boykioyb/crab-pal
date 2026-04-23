import log from 'electron-log/main'

/**
 * Resolve debug mode deterministically across runtimes.
 *
 * Priority:
 * 1) --debug flag always enables debug mode
 * 2) CRAB_PAL_IS_PACKAGED env (when explicitly set)
 * 3) Electron runtime heuristic (defaultApp => dev, otherwise packaged)
 * 4) Non-Electron runtimes default to debug mode (headless Bun / node --check)
 */
function resolveDebugMode(): boolean {
  if (process.argv.includes('--debug')) return true

  const packagedEnv = process.env.CRAB_PAL_IS_PACKAGED
  if (packagedEnv === 'true') return false
  if (packagedEnv === 'false') return true

  const isElectronRuntime = typeof process.versions?.electron === 'string'
  if (isElectronRuntime) {
    if (process.defaultApp) return true
    return false
  }

  return true
}

export const isDebugMode = resolveDebugMode()

// File logging is always on so packaged users can diagnose auth/session issues
// via Settings → Logs. Console output stays gated on debug mode.
log.transports.file.format = ({ message }) => [
  JSON.stringify({
    timestamp: message.date.toISOString(),
    level: message.level,
    scope: message.scope,
    message: message.data,
  }),
]
log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB
log.transports.file.level = isDebugMode ? 'debug' : 'info'

if (isDebugMode) {
  log.transports.console.format = ({ message }) => {
    const scope = message.scope ? `[${message.scope}]` : ''
    const level = message.level.toUpperCase().padEnd(5)
    const data = message.data
      .map((d: unknown) => (typeof d === 'object' ? JSON.stringify(d) : String(d)))
      .join(' ')
    return [`${message.date.toISOString()} ${level} ${scope} ${data}`]
  }
  log.transports.console.level = 'debug'
} else {
  log.transports.console.level = false
}

// Export scoped loggers for different modules
export const mainLog = log.scope('main')
export const sessionLog = log.scope('session')
export const handlerLog = log.scope('handler')
export const windowLog = log.scope('window')
export const agentLog = log.scope('agent')
export const searchLog = log.scope('search')

/**
 * Get the path to the current log file.
 * File logging is always on (debug-level in dev, info-level in packaged builds),
 * so this returns the active log path in both runtimes.
 */
export function getLogFilePath(): string | undefined {
  return log.transports.file.getFile()?.path
}

export default log
