// Pure translation of a Datum session's event stream (`datum sessions stream`:
// SSE lines `data: {"seq","ts","chunk"}`, the AI SDK UI message stream) into
// the pane's conversation. No `$` here, so the tests drive it directly.

import type { Conversation, Entry } from '../types'

export type Chunk = { type: string; [field: string]: unknown }

/** What the register module acts on beyond the redraw. */
export type Effect =
  | { kind: 'prompt'; runId: string; text: string }
  | { kind: 'result'; text: string; isError: boolean }

const MAX_ENTRIES = 300

export const emptyConversation = (space: string): Conversation => ({
  space,
  sessionId: null,
  contextId: null,
  url: null,
  phase: 'idle',
  model: null,
  costUsd: 0,
  runNo: 0,
  busy: null,
  entries: [],
})

/** The conversation with its log cleared, ready for a replay of the stream. */
export const forReplay = (c: Conversation): Conversation => ({
  ...c,
  // a message just sent keeps its live line while the replay catches up
  phase: c.phase === 'sending' ? 'sending' : 'idle',
  busy: c.phase === 'sending' ? c.busy : null,
  costUsd: 0,
  runNo: 0,
  entries: [],
})

/** Splits complete SSE events off `buffer`; the unfinished tail is `rest`. */
export const splitSse = (buffer: string): { chunks: Chunk[]; rest: string } => {
  const chunks: Chunk[] = []
  const lines = buffer.split('\n')
  const rest = lines.pop() ?? ''
  for (const line of lines) {
    if (!line.startsWith('data:')) continue
    try {
      const event = JSON.parse(line.slice(5).trim()) as { chunk?: Chunk; ts?: string }
      // `__ts`: when the event was stored, so a replayed answer is told from a live one
      if (event.chunk && typeof event.chunk.type === 'string') chunks.push({ ...event.chunk, __ts: event.ts })
    } catch {
      // a line that is not JSON (keep-alive comment, a CLI notice) is skipped
    }
  }

  return { chunks, rest }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** `mcp__datum__query_loki_logs` → `query_loki_logs`. */
export const shortToolName = (name: string): string =>
  name.startsWith('mcp__') ? name.split('__').slice(2).join('__') || name : name

/** One line saying what a tool call was about, from its input. */
export const toolDetail = (input: unknown): string => {
  if (!input || typeof input !== 'object') return ''
  const record = input as Record<string, unknown>
  for (const key of ['description', 'command', 'query', 'expr', 'url', 'file_path', 'path', 'pattern', 'prompt', 'q']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim().replace(/\s+/g, ' ').slice(0, 120)
  }
  const json = JSON.stringify(record)

  return json === '{}' ? '' : json.slice(0, 120)
}

const push = (c: Conversation, entry: Entry): Conversation => ({
  ...c,
  entries: [...c.entries, entry].slice(-MAX_ENTRIES),
})

const patch = (c: Conversation, id: string, fn: (e: Entry) => Entry): Conversation => ({
  ...c,
  entries: c.entries.map(e => (e.id === id ? fn(e) : e)),
})

/** When the event was stored (the `__ts` splitSse carries), else now. */
const chunkTime = (chunk: Chunk): number => {
  const at = typeof chunk.__ts === 'string' ? Date.parse(chunk.__ts) : NaN
  return Number.isNaN(at) ? Date.now() : at
}

/** What the live line says after this chunk: thinking, writing, a tool, or done. */
const busyAfter = (c: Conversation, chunk: Chunk): Conversation['busy'] => {
  switch (chunk.type) {
    case 'data-user-prompt':
      // the message is in: the agent picks it up (now, or after the running turn)
      return c.busy ?? { since: chunkTime(chunk), activity: 'sending', outChars: 0 }
    case 'start':
      return { since: c.busy?.since ?? chunkTime(chunk), activity: 'thinking', outChars: 0 }
    case 'reasoning-start':
    case 'tool-output-available':
    case 'tool-output-error':
      return c.busy && { ...c.busy, activity: 'thinking' }
    case 'text-delta':
      return c.busy && { ...c.busy, activity: 'writing', outChars: c.busy.outChars + str(chunk.delta).length }
    case 'tool-input-available':
      return c.busy && { ...c.busy, activity: shortToolName(str(chunk.toolName)) }
    case 'finish':
    case 'data-run-stopped':
    case 'error':
      return null
    default:
      return c.busy
  }
}

/** Applies one chunk; `effect` is set for a user prompt and a run's result. */
export const reduce = (c: Conversation, chunk: Chunk): { conv: Conversation; effect?: Effect } => {
  const applied = apply(c, chunk)
  return { ...applied, conv: { ...applied.conv, busy: busyAfter(c, chunk) } }
}

const apply = (c: Conversation, chunk: Chunk): { conv: Conversation; effect?: Effect } => {
  const data = (chunk.data ?? {}) as Record<string, unknown>
  const runTag = `${c.runNo}`

  switch (chunk.type) {
    case 'data-user-prompt': {
      const runId = str(data.runId) || `p${c.entries.length}`
      const text = str(data.text)
      const conv = push(c, { kind: 'user', id: `u:${runId}:${c.entries.length}`, text, author: str(data.author) })

      return { conv, effect: { kind: 'prompt', runId, text } }
    }
    case 'data-agent-selection':
      return { conv: { ...c, model: str(data.model) || c.model } }
    case 'start':
      return { conv: { ...c, phase: 'running', runNo: c.runNo + 1 } }
    case 'text-start':
      return { conv: push(c, { kind: 'agent', id: `a:${runTag}:${str(chunk.id)}`, text: '' }) }
    case 'text-delta': {
      const id = `a:${runTag}:${str(chunk.id)}`
      const delta = str(chunk.delta)

      return { conv: patch(c, id, e => (e.kind === 'agent' ? { ...e, text: e.text + delta } : e)) }
    }
    case 'tool-input-available':
      return {
        conv: push(c, {
          kind: 'tool',
          id: `t:${str(chunk.toolCallId)}`,
          name: shortToolName(str(chunk.toolName)),
          detail: toolDetail(chunk.input),
          state: 'running',
        }),
      }
    case 'tool-output-available':
      return { conv: patch(c, `t:${str(chunk.toolCallId)}`, e => (e.kind === 'tool' ? { ...e, state: 'done' } : e)) }
    case 'tool-output-error':
      return { conv: patch(c, `t:${str(chunk.toolCallId)}`, e => (e.kind === 'tool' ? { ...e, state: 'error' } : e)) }
    case 'data-agent-result': {
      const paid = typeof data.totalCostUsd === 'number' ? data.totalCostUsd : 0
      const equivalent = typeof data.subscriptionEquivalentUsd === 'number' ? data.subscriptionEquivalentUsd : 0
      const conv = { ...c, costUsd: c.costUsd + (paid > 0 ? paid : equivalent) }

      return { conv, effect: { kind: 'result', text: str(data.resultText), isError: data.isError === true } }
    }
    case 'data-run-stopped':
      return { conv: push({ ...c, phase: 'idle' }, { kind: 'note', id: `n:stop:${runTag}`, text: 'Run stopped.', tone: 'info' }) }
    case 'error':
      return {
        conv: push({ ...c, phase: 'idle' }, { kind: 'note', id: `n:err:${runTag}:${c.entries.length}`, text: str(chunk.errorText) || 'The run failed.', tone: 'error' }),
      }
    case 'finish':
      return { conv: { ...c, phase: 'idle' } }
    default:
      return { conv: c }
  }
}

/** The pane's link to the session: `https://<space>.<host>/sessions/<id>`. */
export const panelUrl = (baseUrl: string | null, space: string, sessionId: string): string | null => {
  if (!baseUrl) return null
  try {
    const base = new URL(baseUrl)

    return `${base.protocol}//${space}.${base.host}/sessions/${sessionId}`
  } catch {
    return null
  }
}
