// Pure shaping of a Datum flow run (`datum flows runs get`) into the pane's live
// run card, after the panel's LIVE RUNS cards: status, title, facts, one bar
// per phase of the definition, and what the run waits for or does now.

import type { AnswerDraft, CardQuestion, LiveRun, OpenQuestion, PhaseBar, PhaseState } from '../types'

type DefStep = { id: string; name?: string; type?: string; phase?: string | null }
type RawQuestion = {
  id: string
  status?: string
  text?: string
  card?: {
    questions?: {
      id?: string
      header?: string
      question?: string
      multi?: boolean
      options?: { label?: string; description?: string | null }[]
      recommended?: number[]
      why?: string
    }[]
  } | null
}
type StepRun = { id?: string; stepId: string; status: string; startedAt?: string | null; questions?: RawQuestion[] | null }
type Waiting = {
  stepName?: string
  approvers?: string[]
  queue?: { name?: string } | null
  startedAt?: string
  question?: { text?: string } | null
  message?: string
}

/** The fields of a run record the card reads; the rest of it is ignored. */
export type RunRecord = {
  id: string
  flowId: string
  title?: string | null
  status: string
  trigger?: string | null
  startedAt?: string | null
  currentStepName?: string | null
  waiting?: Waiting | null
  facts?: { label?: string; value?: string }[]
  definition?: { steps?: DefStep[] }
  steps?: StepRun[]
}

export const OPEN_STATUSES = ['running', 'waiting', 'pending'] as const

const DONE = new Set(['completed', 'skipped', 'succeeded'])
const FAILED = new Set(['failed', 'error', 'cancelled'])

/** The newest state of each step (a retried step runs again under the same id). */
const stepStates = (runs: readonly StepRun[]): Map<string, string> => {
  const states = new Map<string, string>()
  for (const r of runs) states.set(r.stepId, r.status)
  return states
}

/**
 * One bar per phase in definition order. A step without a phase joins the
 * phase before it (a branch rides with its routine); with no phases at all,
 * every step is its own bar, named as it is.
 */
export const phaseBars = (definition: readonly DefStep[], runs: readonly StepRun[]): PhaseBar[] => {
  const states = stepStates(runs)
  const anyPhase = definition.some(s => s.phase)
  const groups: { label: string; steps: DefStep[] }[] = []
  for (const step of definition) {
    const label = anyPhase ? step.phase ?? groups.at(-1)?.label ?? step.name ?? step.id : step.name ?? step.id
    const last = groups.at(-1)
    if (last && last.label === label) last.steps.push(step)
    else groups.push({ label, steps: [step] })
  }

  return groups.map(({ label, steps }) => {
    const seen = steps.map(s => states.get(s.id))
    const done = seen.filter(s => s !== undefined && DONE.has(s)).length
    const state: PhaseState = seen.some(s => s !== undefined && FAILED.has(s))
      ? 'failed'
      : seen.includes('waiting')
        ? 'waiting'
        : seen.includes('running') || seen.includes('pending')
          ? 'active'
          : done === steps.length
            ? 'done'
            : done > 0
              ? 'active'
              : 'todo'
    return { label, state, fill: steps.length ? done / steps.length : 0 }
  })
}

const short = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** The open question of the run's waiting step, if an agent asked one. */
export const openQuestion = (steps: readonly StepRun[]): OpenQuestion | null => {
  for (const step of steps) {
    const q = (step.questions ?? []).find(x => x.status === 'open')
    if (!q || !step.id) continue
    const card = q.card?.questions?.length
      ? q.card.questions.map((cq, i) => ({
          id: cq.id ?? `q${i}`,
          header: cq.header ?? `Question ${i + 1}`,
          question: cq.question ?? '',
          multi: cq.multi === true,
          options: (cq.options ?? []).map(o => ({ label: o.label ?? '', description: o.description ?? null })),
          recommended: (cq.recommended ?? []).filter(n => typeof n === 'number'),
          why: cq.why ?? '',
        }))
      : null
    return { id: q.id, stepRunId: step.id, text: q.text ?? '', card }
  }
  return null
}

/** A fresh answer to the run's open question: the agent's recommendations picked, as the panel does. */
export const draftFor = (run: LiveRun): AnswerDraft | null => {
  const q = run.question
  if (!q) return null
  return {
    runId: run.id,
    flowId: run.flowId,
    stepRunId: q.stepRunId,
    questionId: q.id,
    active: 0,
    picks: Object.fromEntries((q.card ?? []).map(cq => [cq.id, [...cq.recommended]])),
    other: {},
    sending: false,
    error: null,
  }
}

/** A pick toggled: single choice replaces (and drops own words), multi adds or removes. */
export const togglePick = (draft: AnswerDraft, q: CardQuestion, index: number): AnswerDraft => {
  const now = draft.picks[q.id] ?? []
  const picks = q.multi ? (now.includes(index) ? now.filter(n => n !== index) : [...now, index].sort()) : [index]
  return {
    ...draft,
    error: null,
    picks: { ...draft.picks, [q.id]: picks },
    other: q.multi ? draft.other : { ...draft.other, [q.id]: '' },
  }
}

/** Own words typed: on a single-choice question they stand instead of a pick. */
export const setOther = (draft: AnswerDraft, q: CardQuestion, text: string): AnswerDraft => ({
  ...draft,
  error: null,
  other: { ...draft.other, [q.id]: text },
  picks: !q.multi && text.trim() ? { ...draft.picks, [q.id]: [] } : draft.picks,
})

/** The request body, or why it cannot be sent yet (the server checks the same). */
export const answerBody = (
  draft: AnswerDraft,
  question: OpenQuestion,
  plain?: string,
): { body: Record<string, unknown> } | { error: string } => {
  if (!question.card) {
    const text = (plain ?? draft.other[question.id] ?? '').trim()
    return text ? { body: { answer: text, questionId: draft.questionId } } : { error: 'Write an answer.' }
  }
  const answers = []
  for (const q of question.card) {
    const picked = draft.picks[q.id] ?? []
    const other = (draft.other[q.id] ?? '').trim()
    if (picked.length === 0 && !other) return { error: `“${q.header}” has no answer yet.` }
    answers.push({ id: q.id, picked: q.multi || !other ? picked : [], other })
  }
  return { body: { answers, questionId: draft.questionId } }
}

/** The card for one open run; `url` is its page in the Datum panel. */
export const liveRun = (flowName: string, run: RunRecord, url: string | null): LiveRun => {
  const w = run.waiting
  return {
    id: run.id,
    flowId: run.flowId,
    flowName,
    title: short(run.title || flowName, 160),
    status: run.status,
    trigger: run.trigger ?? null,
    startedAt: run.startedAt ?? null,
    current: run.currentStepName ?? null,
    facts: (run.facts ?? [])
      .filter(f => f.value)
      .map(f => ({ label: f.label ?? '', value: f.value ?? '' }))
      .slice(0, 3),
    phases: phaseBars(run.definition?.steps ?? [], run.steps ?? []),
    question: run.status === 'waiting' ? openQuestion(run.steps ?? []) : null,
    waiting: w
      ? {
          step: w.stepName ?? null,
          approvers: (w.approvers ?? []).slice(0, 6),
          queue: w.queue?.name || null,
          question: w.question?.text ? short(w.question.text, 140) : w.message ? short(w.message, 140) : null,
          since: w.startedAt ?? null,
        }
      : null,
    url,
  }
}

/** `14 min`, `1 h 05 min`, `2 d 3 h`: how long since `iso`. */
export const since = (iso: string | null, now: number): string => {
  if (!iso) return ''
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, '0')} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}
