/** One row of the Datum conversation as the pane draws it. */
export type Entry =
  | { kind: 'user'; id: string; text: string; author: string }
  | { kind: 'agent'; id: string; text: string }
  | { kind: 'tool'; id: string; name: string; detail: string; state: 'running' | 'done' | 'error' }
  | { kind: 'note'; id: string; text: string; tone: 'info' | 'error' }

/** The live line under the conversation while Datum works. */
export type Busy = { since: number; activity: string; outChars: number }

/** idle: nothing runs; sending: a CLI call in flight; running: the agent works. */
export type Phase = 'idle' | 'sending' | 'running'

/**
 * The Datum session the pane follows. Entries are rebuilt from the session's
 * own event log (replay + live) on every attach — the store is the truth.
 */
export type Conversation = {
  space: string
  sessionId: string | null
  contextId: string | null
  url: string | null
  phase: Phase
  model: string | null
  costUsd: number
  runNo: number
  /** While the agent works: since when (ms), what it does now, how much it wrote. */
  busy: Busy | null
  entries: Entry[]
}

/** A space the person can reach, from `datum whoami`. */
export type Space = { slug: string; name: string }

/** What the pane's header says about the CLI, the person and the space. */
export type Info = {
  cli: string | null
  server: string | null
  identity: string | null
  role: string | null
  host: string | null
  /** Each space's A2A channel: on (card served) or off (403); absent = not asked yet. */
  a2a: Record<string, 'on' | 'off'>
  /** Why the sign-in could not be read, shown in place of the identity. */
  problem: string | null
}

/** The pane's space search: open or closed, and what has been typed. */
export type Picker = { open: boolean; query: string }

/** How far a phase of a flow run has come. */
export type PhaseState = 'done' | 'active' | 'waiting' | 'failed' | 'todo'
export type PhaseBar = { label: string; state: PhaseState; fill: number }

/** One question of an agent's question card (#1576). */
export type CardQuestion = {
  id: string
  header: string
  question: string
  multi: boolean
  options: { label: string; description: string | null }[]
  recommended: number[]
  why: string
}

/** The open question of a waiting routine step: a card, or plain text before cards. */
export type OpenQuestion = { id: string; stepRunId: string; text: string; card: CardQuestion[] | null }

/** The person's answer being written in a run card. */
export type AnswerDraft = {
  runId: string
  flowId: string
  stepRunId: string
  questionId: string
  active: number
  picks: Record<string, number[]>
  other: Record<string, string>
  sending: boolean
  error: string | null
}

/** An open flow run as the pane's card draws it. */
export type LiveRun = {
  id: string
  flowId: string
  flowName: string
  title: string
  status: string
  trigger: string | null
  startedAt: string | null
  current: string | null
  facts: { label: string; value: string }[]
  phases: PhaseBar[]
  waiting: {
    step: string | null
    approvers: string[]
    queue: string | null
    question: string | null
    since: string | null
  } | null
  question: OpenQuestion | null
  url: string | null
}

/** The space's open flow runs, as last read. */
/** A flow of the space as the window lists it, running or not. */
export type FlowRow = {
  id: string
  name: string
  active: boolean
  openRuns: number
  lastRunStatus: string | null
  lastRunAt: string | null
  nextRunAt: string | null
  url: string | null
}

/** The space's flows and their open runs, as last read; `error` when the flows could not be read. */
export type Runs = {
  space: string
  runs: LiveRun[]
  flows: FlowRow[]
  error: string | null
  updatedAt: number | null
  isOpen: boolean
}

declare module 'claude-code' {
  interface PluginState {
    // One window per Datum space: each family member is keyed by the pane id, `datum-<space>`.
    'datum': {
      conversation: StateFamily<Conversation>
      runs: StateFamily<Runs>
      draft: StateFamily<AnswerDraft | null>
      tick: StateFamily<number>
      picker: StateFamily<Picker>
      spaces: Space[]
      info: Info
      sync: boolean
      /** The space whose window `/datum`, `@datum` and delegate use when none is named. */
      active: string
    }
  }
}
