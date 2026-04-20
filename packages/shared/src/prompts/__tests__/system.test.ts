import { describe, it, expect } from 'bun:test'
import { getSystemPrompt } from '../system'

describe('system prompt guidance', () => {
  it('uses backend-neutral debug log querying guidance (rg/grep via Bash)', () => {
    const prompt = getSystemPrompt(
      undefined,
      { enabled: true, logFilePath: '/tmp/main.log' },
      '/tmp/workspace',
      '/tmp/workspace'
    )

    expect(prompt).toContain('Use Bash with `rg`/`grep` to search logs efficiently:')
    expect(prompt).toContain('rg -n "session" "/tmp/main.log"')
    expect(prompt).not.toContain('Use the Grep tool (if available)')
    expect(prompt).not.toContain('Grep pattern=')
  })

  it('does not mention Grep in call_llm tool-dependency guidance', () => {
    const prompt = getSystemPrompt(undefined, undefined, '/tmp/workspace', '/tmp/workspace')

    expect(prompt).toContain('The subtask needs file/shell tools (for example, Read or Bash)')
    expect(prompt).not.toContain('The subtask needs tools (Read, Bash, Grep)')
  })
})
