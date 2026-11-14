import { describe, expect, test, tier } from 'claude-code/testing'

import { answerBody, draftFor, liveRun, openQuestion, phaseBars, setOther, since, togglePick } from '../hooks/flows'

tier('user')

// das-pdlc as `datum flows runs get` returned it on 2026-10-04 (trimmed).
const DEFINITION = [
  { id: 'evidence', name: 'Thesis and evidence', type: 'routine', phase: 'Research' },
  { id: 'route', name: 'Anything to write?', type: 'branch', phase: 'Research' },
  { id: 'write', name: 'Thesis document and epics', type: 'routine', phase: 'Research' },
  { id: 'decide', name: 'Review and epics', type: 'routine', phase: 'Review' },
  { id: 'rewrite', name: 'Rewrite the document?', type: 'branch', phase: 'Review' },
]
const STEPS = [
  { stepId: 'evidence', status: 'completed' },
  { stepId: 'route', status: 'completed' },
  { stepId: 'write', status: 'completed' },
  { stepId: 'decide', status: 'waiting' },
]

describe('flows', () => {
  test('phases follow the definition: Research done, Review waiting', async () => {
    expect(phaseBars(DEFINITION, STEPS)).toEqual([
      { label: 'Research', state: 'done', fill: 1 },
      { label: 'Review', state: 'waiting', fill: 0 },
    ])
  })

  test('without phases every step is its own bar, and a retried step counts by its newest state', async () => {
    const bars = phaseBars(
      [{ id: 'a', name: 'Start' }, { id: 'b', name: 'Kod' }, { id: 'c', name: 'CI' }],
      [{ stepId: 'a', status: 'completed' }, { stepId: 'b', status: 'failed' }, { stepId: 'b', status: 'running' }],
    )
    expect(bars.map(b => [b.label, b.state])).toEqual([['Start', 'done'], ['Kod', 'active'], ['CI', 'todo']])
  })

  test('the card carries who it waits for, the queue and the question', async () => {
    const card = liveRun(
      'das-pdlc',
      {
        id: 'r1',
        flowId: 'f1',
        title: 'Marża kampanii performance powinna być widoczną miarą',
        status: 'waiting',
        trigger: 'on-demand',
        startedAt: '2026-10-04T14:24:45.637Z',
        facts: [{ label: 'Agenda', value: '#155' }],
        waiting: {
          stepName: 'Review and epics',
          approvers: ['jdoe', 'asmith'],
          queue: { name: 'DAS Owners' },
          startedAt: '2026-10-04T14:40:58.517Z',
          question: { text: 'Review and epics' },
        },
        definition: { steps: DEFINITION },
        steps: STEPS,
      },
      'https://das.example.tech/flows/f1/runs/r1',
    )
    expect(card.waiting).toEqual({
      step: 'Review and epics',
      approvers: ['jdoe', 'asmith'],
      queue: 'DAS Owners',
      question: 'Review and epics',
      since: '2026-10-04T14:40:58.517Z',
    })
    expect(card.facts).toEqual([{ label: 'Agenda', value: '#155' }])
  })

  test('elapsed time reads in minutes, hours, then days', async () => {
    const t0 = Date.parse('2026-10-04T10:00:00Z')
    expect(since('2026-10-04T10:00:00Z', t0 + 14 * 60_000)).toBe('14 min')
    expect(since('2026-10-04T10:00:00Z', t0 + 65 * 60_000)).toBe('1 h 05 min')
    expect(since('2026-10-04T10:00:00Z', t0 + 27 * 3_600_000)).toBe('1 d 3 h')
  })

  test('an agent question card: recommendations picked first, own words replace a single pick', async () => {
    const question = openQuestion([
      { stepId: 'evidence', status: 'completed' },
      {
        id: 'sr1',
        stepId: 'decide',
        status: 'waiting',
        questions: [
          { id: 'old', status: 'answered' },
          {
            id: 'q1',
            status: 'open',
            text: 'card as text',
            card: {
              questions: [
                { id: 'dokument', header: 'Dokument', question: 'Teza…', multi: false, options: [{ label: 'OK' }, { label: 'Przepisz', description: 'uwagi wpisz w Inne' }], recommended: [0], why: 'dowody' },
                { id: 'tezy', header: 'Nowe tezy', question: 'Które?', multi: true, options: [{ label: 'a' }, { label: 'b' }], recommended: [0, 1], why: '' },
              ],
            },
          },
        ],
      },
    ])
    expect(question?.id).toBe('q1')
    expect(question?.stepRunId).toBe('sr1')
    const run = { id: 'r1', flowId: 'f1', question } as unknown as Parameters<typeof draftFor>[0]
    let draft = draftFor(run)!
    expect(draft.picks).toEqual({ dokument: [0], tezy: [0, 1] })

    const [dokument, tezy] = question!.card!
    draft = togglePick(draft, tezy!, 1)
    draft = setOther(draft, dokument!, 'popraw sekcję 2')
    expect(answerBody(draft, question!)).toEqual({
      body: {
        answers: [
          { id: 'dokument', picked: [], other: 'popraw sekcję 2' },
          { id: 'tezy', picked: [0], other: '' },
        ],
        questionId: 'q1',
      },
    })

    draft = togglePick(draft, tezy!, 0)
    expect(answerBody(draft, question!)).toEqual({ error: '“Nowe tezy” has no answer yet.' })
  })
})
