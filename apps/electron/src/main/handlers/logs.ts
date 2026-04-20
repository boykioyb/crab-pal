/**
 * Logs handlers — expose the main-process log file to the renderer so the
 * in-app Log Viewer can display, tail, and filter it. Also accepts renderer
 * log forwarding (`logs:renderer`) and writes it into the same file tagged
 * `renderer:<scope>`.
 *
 * Security: `logs:read` never accepts a file path from the renderer; it only
 * reads the canonical log file returned by `getLogFilePath()`.
 */

import { promises as fsp } from 'fs'
import { watch, type FSWatcher } from 'fs'
import log from 'electron-log/main'
import { RPC_CHANNELS } from '@crabpal/shared/protocol'
import type { RpcServer } from '@crabpal/server-core/transport'
import type { HandlerDeps } from './handler-deps'
import { getLogFilePath, mainLog } from '../logger'

const MAX_LINES = 500
const READ_WINDOW_BYTES = 512 * 1024 // tail up to 512 KB from the end

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'verbose' | 'silly'

function isLogLevel(value: unknown): value is LogLevel {
  return value === 'info' || value === 'warn' || value === 'error'
    || value === 'debug' || value === 'verbose' || value === 'silly'
}

async function readTail(filePath: string, maxLines: number): Promise<string[]> {
  let fh: Awaited<ReturnType<typeof fsp.open>> | undefined
  try {
    fh = await fsp.open(filePath, 'r')
    const stat = await fh.stat()
    const size = stat.size
    const readBytes = Math.min(size, READ_WINDOW_BYTES)
    const start = size - readBytes
    const buf = Buffer.alloc(readBytes)
    await fh.read(buf, 0, readBytes, start)
    const text = buf.toString('utf-8')
    const lines = text.split('\n').filter(l => l.length > 0)
    // If we didn't start at 0, discard the first (possibly partial) line.
    if (start > 0 && lines.length > 0) lines.shift()
    return lines.slice(-maxLines)
  } finally {
    await fh?.close()
  }
}

interface TailState {
  watcher: FSWatcher
  lastSize: number
  filePath: string
}

const tailers = new Map<string, TailState>()

async function startTail(
  clientId: string,
  filePath: string,
  emit: (lines: string[]) => void,
): Promise<void> {
  if (tailers.has(clientId)) return

  const stat = await fsp.stat(filePath)
  let lastSize = stat.size
  let reading = false
  let pendingReread = false

  const readDelta = async () => {
    if (reading) {
      pendingReread = true
      return
    }
    reading = true
    try {
      const s = await fsp.stat(filePath)
      // File rotated/truncated — re-baseline to current size.
      if (s.size < lastSize) {
        lastSize = s.size
        return
      }
      if (s.size === lastSize) return

      const len = s.size - lastSize
      const fh = await fsp.open(filePath, 'r')
      try {
        const buf = Buffer.alloc(len)
        await fh.read(buf, 0, len, lastSize)
        lastSize = s.size
        const text = buf.toString('utf-8')
        const lines = text.split('\n').filter(l => l.length > 0)
        if (lines.length > 0) emit(lines)
      } finally {
        await fh.close()
      }
    } catch (error) {
      mainLog.warn('logs tail read failed', (error as Error).message)
    } finally {
      reading = false
      if (pendingReread) {
        pendingReread = false
        void readDelta()
      }
    }
  }

  const watcher = watch(filePath, { persistent: false }, () => { void readDelta() })
  tailers.set(clientId, { watcher, lastSize, filePath })
}

function stopTail(clientId: string): void {
  const state = tailers.get(clientId)
  if (!state) return
  try { state.watcher.close() } catch { /* noop */ }
  tailers.delete(clientId)
}

export function registerLogsHandlers(server: RpcServer, _deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.logs.GET_FILE_PATH, async () => {
    return getLogFilePath() ?? null
  })

  server.handle(RPC_CHANNELS.logs.READ, async (_ctx, opts?: { tail?: number }) => {
    const filePath = getLogFilePath()
    if (!filePath) return { path: null, lines: [] as string[] }
    const tail = Math.max(1, Math.min(MAX_LINES, opts?.tail ?? MAX_LINES))
    try {
      const lines = await readTail(filePath, tail)
      return { path: filePath, lines }
    } catch (error) {
      mainLog.error('logs read failed', (error as Error).message)
      return { path: filePath, lines: [] as string[] }
    }
  })

  server.handle(RPC_CHANNELS.logs.TAIL_START, async (ctx) => {
    const filePath = getLogFilePath()
    if (!filePath) return { started: false }
    await startTail(ctx.clientId, filePath, (lines) => {
      server.push(RPC_CHANNELS.logs.NEW_LINES, { to: 'client', clientId: ctx.clientId }, lines)
    })
    return { started: true }
  })

  server.handle(RPC_CHANNELS.logs.TAIL_STOP, async (ctx) => {
    stopTail(ctx.clientId)
  })

  server.handle(
    RPC_CHANNELS.logs.RENDERER,
    async (
      _ctx,
      entry: { level?: string; scope?: string; args?: unknown[] },
    ) => {
      const level: LogLevel = isLogLevel(entry.level) ? entry.level : 'info'
      const scope = typeof entry.scope === 'string' && entry.scope.length > 0
        ? `renderer:${entry.scope}`
        : 'renderer'
      const args = Array.isArray(entry.args) ? entry.args : []
      log.scope(scope)[level](...args)
    },
  )
}
