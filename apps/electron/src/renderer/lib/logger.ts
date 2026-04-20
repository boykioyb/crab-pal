import log from 'electron-log/renderer'

/**
 * Renderer-side loggers.
 *
 * `rendererLog`/`searchLog` use electron-log's renderer transport directly.
 * `createForwardingLogger(scope)` sends structured entries over IPC so they
 * appear in the main log file tagged as `renderer:<scope>` — surfaced in the
 * in-app Log Viewer.
 */

export const rendererLog = log.scope('renderer')
export const searchLog = log.scope('search')

type ForwardLevel = 'info' | 'warn' | 'error'

function serializeArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return { name: arg.name, message: arg.message, stack: arg.stack }
  }
  return arg
}

function forward(level: ForwardLevel, scope: string, args: unknown[]): void {
  const api = (typeof window !== 'undefined' ? window.electronAPI : undefined)
  if (!api?.logRenderer) return
  try {
    void api.logRenderer({ level, scope, args: args.map(serializeArg) })
  } catch {
    /* noop — never let logging break the app */
  }
}

export interface ForwardingLogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export function createForwardingLogger(scope: string): ForwardingLogger {
  return {
    info: (...args) => forward('info', scope, args),
    warn: (...args) => forward('warn', scope, args),
    error: (...args) => forward('error', scope, args),
  }
}

let consoleHookInstalled = false

/**
 * Forward `console.error` and `console.warn` in the renderer to the main log
 * file. Safe to call multiple times (installs once).
 */
export function installConsoleForwarding(scope = 'console'): void {
  if (consoleHookInstalled) return
  if (typeof window === 'undefined') return
  consoleHookInstalled = true
  const origError = console.error
  const origWarn = console.warn
  console.error = (...args: unknown[]) => {
    forward('error', scope, args)
    origError.apply(console, args as Parameters<typeof console.error>)
  }
  console.warn = (...args: unknown[]) => {
    forward('warn', scope, args)
    origWarn.apply(console, args as Parameters<typeof console.warn>)
  }
}

export default log
