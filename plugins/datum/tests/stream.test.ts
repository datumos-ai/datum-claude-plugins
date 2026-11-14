import { describe, expect, test, tier } from 'claude-code/testing'

import { emptyConversation, reduce, shortToolName, splitSse } from '../hooks/stream'
import type { Effect } from '../hooks/stream'
import { sse } from './fixtures/sse'

tier('user')

// The shape of a real adops run captured from `datum sessions stream` (trimmed).
const RUN = [
  { type: 'data-user-prompt', data: { text: 'Jak się nazywasz?', author: 'a@b.pl', runId: 'run-1' } },
  { type: 'data-agent-selection', data: { model: 'claude-opus-5-5' } },
  { type: 'start' },
  { type: 'reasoning-start', id: 'b1' },
  { type: 'reasoning-end', id: 'b1' },
  { type: 'tool-input-available', toolCallId: 't1', toolName: 'mcp__datum__query_loki_logs', input: { query: '{app="das-bidder"} |= "5xx"' } },
  { type: 'tool-output-available', toolCallId: 't1', output: 'ok' },
  { type: 'text-start', id: 'b2' },
  { type: 'text-delta', id: 'b2', delta: 'Jestem' },
  { type: 'text-delta', id: 'b2', delta: ' agentem **adops**.' },
  { type: 'text-end', id: 'b2' },
  { type: 'data-agent-result', data: { resultText: 'Jestem agentem **adops**.', isError: false, totalCostUsd: 0, subscriptionEquivalentUsd: 0.13 } },
  { type: 'finish' },
]

const replay = (text: string) => {
  const { chunks, rest } = splitSse(text)
  let conv = emptyConversation('adops')
  const effects: Effect[] = []
  for (const chunk of chunks) {
    const applied = reduce(conv, chunk)
    conv = applied.conv
    if (applied.effect) effects.push(applied.effect)
  }
  return { conv, effects, rest }
}

describe('stream', () => {
  test('a run becomes the prompt, the tool call and the answer', async () => {
    const { conv, effects, rest } = replay(sse(RUN))

    expect(rest).toBe('')
    expect(conv.phase).toBe('idle')
    expect(conv.model).toBe('claude-opus-5-5')
    expect(Math.round(conv.costUsd * 100)).toBe(13)
    expect(conv.entries.map(e => e.kind)).toEqual(['user', 'tool', 'agent'])
    expect(conv.entries[1]).toEqual(expect.objectContaining({ name: 'query_loki_logs', state: 'done' }))
    expect(conv.entries[2]).toEqual(expect.objectContaining({ text: 'Jestem agentem **adops**.' }))
    expect(effects).toEqual([
      { kind: 'prompt', runId: 'run-1', text: 'Jak się nazywasz?' },
      { kind: 'result', text: 'Jestem agentem **adops**.', isError: false },
    ])
  })

  test('an event cut between two pieces waits for its end', async () => {
    const text = sse(RUN.slice(0, 3))
    const cut = text.length - 10
    const first = splitSse(text.slice(0, cut))
    const second = splitSse(first.rest + text.slice(cut))

    expect(first.chunks.length + second.chunks.length).toBe(3)
    expect(second.rest).toBe('')
  })

  test('two runs reusing text block ids keep two answers', async () => {
    const second = RUN.map(c => (c.type === 'data-user-prompt' ? { ...c, data: { ...c.data, runId: 'run-2' } } : c))
    const { conv } = replay(sse([...RUN, ...second]))

    expect(conv.entries.filter(e => e.kind === 'agent')).toHaveLength(2)
  })

  test('mcp tool names lose their server prefix', async () => {
    expect(shortToolName('mcp__datum__query_loki_logs')).toBe('query_loki_logs')
    expect(shortToolName('Bash')).toBe('Bash')
  })

  test('the live line follows the run: thinking, a tool, writing, then gone', async () => {
    let conv = emptyConversation('adops')
    const step = (chunk: Record<string, unknown>) => {
      conv = reduce(conv, { ...chunk, type: String(chunk.type), __ts: '2026-10-04T14:25:26.000Z' }).conv
      return conv.busy
    }

    expect(step({ type: 'start' })).toEqual({ since: Date.parse('2026-10-04T14:25:26.000Z'), activity: 'thinking', outChars: 0 })
    expect(step({ type: 'tool-input-available', toolCallId: 't1', toolName: 'mcp__datum__query_loki_logs' })?.activity).toBe('query_loki_logs')
    expect(step({ type: 'tool-output-available', toolCallId: 't1' })?.activity).toBe('thinking')
    step({ type: 'text-start', id: 'b1' })
    expect(step({ type: 'text-delta', id: 'b1', delta: 'Dwanaście znak' })).toEqual(expect.objectContaining({ activity: 'writing', outChars: 14 }))
    expect(step({ type: 'finish' })).toBeNull()
  })
})
