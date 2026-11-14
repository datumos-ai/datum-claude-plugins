import type { On } from 'claude-code'
import { describe, expect, mock, test, tier } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { spacePinnedIn } from '../hooks/register'
import { sse } from './fixtures/sse'

tier('user')

type Ran = { argv: readonly string[]; env?: Record<string, string> }

const TASK = JSON.stringify({
  task: { id: 'run-1', contextId: 'ctx-1', metadata: { datumSessionId: 'sess-1' }, status: { state: 'TASK_STATE_SUBMITTED' } },
})

/** The world beneath the mod: the datum CLI, the UI, the prompt. */
const world = (on: On, stream: string, taken: readonly string[] = [], flowsError?: string) => {
  const ran: Ran[] = []
  const spawned: Ran[] = []
  const submitted: string[] = []
  const focused: string[] = []
  const contexts: (readonly string[] | undefined)[] = []
  const filled: string[] = []
  const opened: string[] = []
  const commands: string[] = []
  const tools: string[] = []
  const clock = mock.clock(on)
  mock.store(on)

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => {
    if (taken.includes(e.name)) return { deny: `"/${e.name}" refused: it is another plugin's` }
    commands.push(e.name)
    return { value: { command: e.name } }
  })
  on('tool.register', ($, e) => {
    tools.push(e.name)
    return { value: { tool: `mcp__datum__${e.name}` } }
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.scroll', () => ({}))
  on('ui.panes', () => ({ value: [] }))
  on('ui.focus', ($, e) => {
    focused.push(e.element ?? '')
    return {}
  })
  on('process.run', ($, e) => {
    ran.push({ argv: e.argv, env: e.init?.env })
    const verb = e.argv[1]
    if (verb === 'flows' && flowsError) {
      return { value: { exitCode: 1, stdout: JSON.stringify({ error: flowsError }), stderr: `datum: HTTP 403 — ${flowsError}`, isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (verb === 'flows') {
      const flowsOut =
        e.argv[2] === 'list'
          ? JSON.stringify([{ id: 'f1', name: 'das-pdlc', openRuns: 1 }, { id: 'f2', name: 'das-sdlc', openRuns: 0 }])
          : e.argv[3] === 'list'
            ? JSON.stringify([{ id: 'r1', flowId: 'f1', status: 'waiting', title: 'Marża kampanii', trigger: 'on-demand', startedAt: '2026-10-04T14:24:45.637Z', waiting: { stepName: 'Review and epics', approvers: ['jdoe'], queue: { name: 'DAS Owners' }, startedAt: '2026-10-04T14:40:58.517Z' } }, { id: 'r0', flowId: 'f1', status: 'completed' }])
            : e.argv[3] === 'steps'
              ? JSON.stringify({ id: 'r1', status: 'running' })
              : JSON.stringify({
                  id: 'r1',
                  flowId: 'f1',
                  status: 'waiting',
                  definition: { steps: [{ id: 'a', phase: 'Research' }, { id: 'b', phase: 'Review' }] },
                  steps: [
                    { id: 'sa', stepId: 'a', status: 'completed' },
                    {
                      id: 'sb',
                      stepId: 'b',
                      status: 'waiting',
                      questions: [
                        {
                          id: 'q1',
                          status: 'open',
                          text: '',
                          card: {
                            questions: [
                              { id: 'dokument', header: 'Dokument', question: 'Teza do przeglądu', multi: false, options: [{ label: 'OK' }, { label: 'Przepisz' }], recommended: [0], why: 'dowody z kodu' },
                              { id: 'epik', header: 'Epik 1', question: 'Epik 1?', multi: false, options: [{ label: 'Akceptuj' }, { label: 'Odrzuć' }], recommended: [0], why: '' },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                  facts: [{ label: 'Agenda', value: '#155' }],
                })
      return { value: { exitCode: 0, stdout: flowsOut, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    const stdout =
      verb === 'whoami'
        ? JSON.stringify({ baseUrl: 'https://datum.example.tech', spaces: ['adops', 'growth-ads (Growth Ads)'] })
         : verb === 'a2a' && e.argv[2] === 'card' ? 'Name:  Datum · adops\nVersion:      0.515.1\n' : verb === 'a2a' ? TASK : '{"ok":true,"queued":false}'
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('process.spawn', async function* ($, e) {
    spawned.push({ argv: e.argv, env: e.env })
    if (stream) yield { stream: 'stdout' as const, text: stream }
    await clock.sleep(60_000)
    return { value: { code: 0, signal: null } }
  })
  on('prompt.fill', ($, e) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', ($, e) => {
    contexts.push(e.context)
    submitted.push(e.text)
    return { text: e.text }
  })

  return { ran, spawned, submitted, focused, contexts, filled, opened, commands, tools, clock }
}

const start = ($: Engine) =>
  $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })

describe('register', () => {
  test('@datum in the prompt goes to Datum as the person, not to the model', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const result = await $.prompt.submit({ text: '@datum czemu das-bidder ma 5xx?', wait: false, origin: { kind: 'composer' } })
    await w.clock.settle()

    expect(result.drop).toContain('Sent to the Datum agent (adops)')
    const send = w.ran.find(r => r.argv[1] === 'a2a' && r.argv[2] === 'send')
    expect(send?.argv).toEqual(['datum', 'a2a', 'send', '--space', 'adops', '--async', '-o', 'json', 'czemu das-bidder ma 5xx?'])
    expect(send?.env).toEqual({ DATUM_API_KEY: '', MCA_API_KEY: '' })
    expect(w.spawned[0]?.argv).toEqual(['datum', 'sessions', 'stream', 'list', 'sess-1', '--space', 'adops'])
    expect(w.submitted).toEqual([])
  })

  test("a delegated task's answer comes back into the conversation", async ($, on) => {
    const w = world(
      on,
      sse([
        { type: 'data-user-prompt', data: { text: 'Zbadaj 5xx das-bidder', runId: 'run-1' } },
        { type: 'start' },
        { type: 'data-agent-result', data: { resultText: 'Przyczyna: deploy 0.91.', isError: false } },
        { type: 'finish' },
      ]),
    )
    await start($)
    await w.clock.settle()

    const called = await $.tool.call({ tool: 'mcp__datum__delegate', task: 'Zbadaj 5xx das-bidder' } as never)
    await w.clock.settle()

    expect(called.result).toContain('Delegated to the Datum agent of space adops')
    expect(w.submitted).toHaveLength(1)
    expect(w.submitted[0]).toContain('Przyczyna: deploy 0.91.')
    expect(w.submitted[0]).toContain('https://adops.datum.example.tech/sessions/sess-1')
  })

  test("the person's own question is not pushed into Claude's conversation", async ($, on) => {
    const w = world(
      on,
      sse([
        { type: 'data-user-prompt', data: { text: 'hej', runId: 'run-1' } },
        { type: 'data-agent-result', data: { resultText: 'Cześć', isError: false } },
      ]),
    )
    await start($)
    await w.clock.settle()

    await $.command.run({
      command: 'datum',
      args: 'hej',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })
    await w.clock.settle()

    expect(w.spawned).toHaveLength(1)
    expect(w.submitted).toEqual([])
  })

  test('@datum:<slug> talks in that space\'s own window; going back to the first window resumes its conversation', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    await $.prompt.submit({ text: '@datum pierwsze', wait: false, origin: { kind: 'composer' } })
    await w.clock.settle()
    const dropped = await $.prompt.submit({ text: '@datum:growth-ads drugie', wait: false, origin: { kind: 'composer' } })
    await w.clock.settle()

    expect(dropped.drop).toContain('(growth-ads)')
    const sends = w.ran.filter(r => r.argv[1] === 'a2a' && r.argv[2] === 'send').map(r => r.argv[4])
    expect(sends).toEqual(['adops', 'growth-ads'])

    // each window follows its own session
    expect(w.spawned.map(sp => sp.argv.at(-1))).toEqual(['adops', 'growth-ads'])
    expect(w.opened.filter(id => id !== 'datum-adops')).toContain('datum-growth-ads')

    await $.command.run({
      command: 'datum',
      args: 'open adops',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })
    await w.clock.settle()
    expect(w.opened.at(-1)).toBe('datum-adops')
    // the adops conversation goes on: no new A2A conversation, no second stream
    expect(w.ran.filter(r => r.argv[1] === 'a2a' && r.argv[2] === 'send')).toHaveLength(2)
    expect(w.spawned).toHaveLength(2)
  })

  test('a space the person cannot reach is refused before anything is sent', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const dropped = await $.prompt.submit({ text: '@datum:obca pytanie', wait: false, origin: { kind: 'composer' } })
    await w.clock.settle()

    expect(dropped.drop).toContain('You have no access to space obca')
    expect(w.ran.filter(r => r.argv[1] === 'a2a' && r.argv[2] === 'send')).toEqual([])
  })

  test('the pane draws its header on the terminal and the desktop', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    for (const surface of ['terminal', 'desktop'] as const) {
      const pane = await $.ui.mount({
        plugin: 'datum',
        surface,
        component: 'Pane',
        requestId: 'datum-adops',
        props: { title: 'Datum · adops', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
      })
      expect(await pane.find({ type: 'Text', text: 'Datum' })).toBeDefined()
      expect(await pane.find({ type: 'Button', key: 'space' })).toBeDefined()
      if (surface === 'terminal') expect(await pane.find({ type: 'Raster', key: 'logo' })).toBeDefined()
    }
  })

  test('the space search filters as the person types and Enter opens the first match in a window of its own', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const pane = await $.ui.mount({
      plugin: 'datum',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'datum-adops',
      props: { title: 'Datum · adops', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })
    await pane.press({ key: 'space' })
    await pane.input({ key: 'space-q', text: 'ads', kind: 'change' })
    expect(await pane.find({ type: 'Button', key: 'space-growth-ads' })).toBeDefined()
    expect(await pane.find({ type: 'Button', key: 'space-adops' })).toBeUndefined()

    await pane.input({ key: 'space-q', text: 'ads' })
    await w.clock.settle()
    expect(w.opened.at(-1)).toBe('datum-growth-ads')
    expect(await pane.find({ key: 'space-q' })).toBeUndefined()
    // this window stays the adops one
    expect(await pane.find({ type: 'Text', text: /^adops · / })).toBeDefined()
  })

  test('a sent message lights the live line at once, before the agent answers', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    await $.prompt.submit({ text: '@datum pytanie', wait: false, origin: { kind: 'composer' } })
    await w.clock.settle()

    const pane = await $.ui.mount({
      plugin: 'datum',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'datum-adops',
      props: { title: 'Datum · adops', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })
    expect(await pane.find({ type: 'Text', text: /Datum (is picking it up|is thinking)…/ })).toBeDefined()
  })

  test('open flow runs of the space show as cards on the terminal and the desktop', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const runsRead = w.ran.filter(r => r.argv[1] === 'flows').map(r => r.argv.slice(2, 4).join(' '))
    expect(runsRead).toEqual(['list --space', 'runs list', 'runs get'])

    for (const surface of ['terminal', 'desktop'] as const) {
      const pane = await $.ui.mount({
        plugin: 'datum',
        surface,
        component: 'Pane',
        requestId: 'datum-adops',
        props: { title: 'Datum · adops', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
      })
      expect(await pane.find({ type: 'Button', key: 'runs-toggle', text: /Flows · 2 · 1 running/ })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'Marża kampanii' })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: /DAS Owners/ })).toBeDefined()
    }
  })

  test("an agent's question is answered from the run card, as the person, through the CLI", async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const pane = await $.ui.mount({
      plugin: 'datum',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'datum-adops',
      props: { title: 'Datum · adops', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
    })
    await pane.press({ key: 'answer-r1' })
    expect(await pane.find({ type: 'Text', text: 'Teza do przeglądu' })).toBeDefined()

    await pane.press({ key: 'opt-1' })
    // a single choice moves on to the next question by itself
    expect(await pane.find({ type: 'Text', text: 'Epik 1?' })).toBeDefined()
    await pane.input({ key: 'other-epik', text: 'zawęzić do DAS Performance', kind: 'change' })
    await pane.press({ key: 'answer-send' })
    await w.clock.settle()

    const call = w.ran.find(r => r.argv[1] === 'flows' && r.argv[3] === 'steps')
    expect(call?.argv.slice(0, 8)).toEqual(['datum', 'flows', 'runs', 'steps', 'answer', 'f1', 'r1', 'sb'])
    expect(JSON.parse(call?.argv.at(-1) ?? '{}')).toEqual({
      answers: [
        { id: 'dokument', picked: [1], other: '' },
        { id: 'epik', picked: [], other: 'zawęzić do DAS Performance' },
      ],
      questionId: 'q1',
    })
    expect(call?.env).toEqual({ DATUM_API_KEY: '', MCA_API_KEY: '' })
    expect(await pane.find({ key: 'answer-send' })).toBeUndefined()
  })

  test('sync is on by default: the first prompt sets the baseline, the next carries what changed', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()
    const prompt = (text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

    await prompt('pierwsza')
    expect(w.contexts.at(-1)).toBeUndefined()

    await prompt('druga')
    expect(w.contexts.at(-1)).toBeUndefined()

    await $.command.run({ command: 'datum', args: 'sync off', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    await prompt('trzecia')
    expect(w.contexts.at(-1)).toBeUndefined()
  })

  test('the pane tool hands the main agent the pane, fenced as data', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const called = await $.tool.call({ tool: 'mcp__datum__pane' } as never)
    const text = String(called.result)
    expect(text).toContain('datum-pane')
    expect(text).toContain('das-pdlc [waiting]')
  })

  test('→ Claude on a run card quotes it into the person\'s prompt', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const pane = await $.ui.mount({
      plugin: 'datum',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'datum-adops',
      props: { title: 'Datum · adops', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
    })
    await pane.press({ key: 'toclaude-run-r1' })
    expect(w.filled[0]).toMatch(/^> Datum flow \(adops\):\n> das-pdlc \[waiting\]/)
  })

  test("the project's pinned space is read from its .mcp.json, as the README asks teams to set it", async () => {
    expect(spacePinnedIn(JSON.stringify({ mcpServers: { datum: { command: 'datum', args: ['mcp', 'serve', '--space', 'adops'] } } }))).toBe('adops')
    expect(spacePinnedIn(JSON.stringify({ datum: { command: 'datum', args: ['mcp', 'serve', '--space', 'das'] } }))).toBe('das')
    expect(spacePinnedIn(JSON.stringify({ mcpServers: { other: { command: 'x', args: ['--space', 'adops'] } } }))).toBeNull()
    expect(spacePinnedIn('not json')).toBeNull()
  })

  test('/datum taken by another plugin: the command falls back to /datum-windows and the tools still register', async ($, on) => {
    const w = world(on, '', ['datum'])
    await start($)
    await w.clock.settle()

    expect(w.commands).toEqual(['datum-windows'])
    expect(w.tools).toEqual(['pane', 'delegate'])
    const reply = await $.command.run({
      command: 'datum-windows',
      args: 'help',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })
    expect(reply.text).toContain('/datum-windows open <slug>')
  })

  test('the space\'s flows show even when none runs: the idle ones with their last run', async ($, on) => {
    const w = world(on, '')
    await start($)
    await w.clock.settle()

    const pane = await $.ui.mount({
      plugin: 'datum',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'datum-adops',
      props: { title: 'Datum · adops', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
    })
    expect(await pane.find({ type: 'Text', text: /○ das-sdlc · never run/ })).toBeDefined()
  })

  test('flows that cannot be read say why instead of vanishing', async ($, on) => {
    const w = world(on, '', [], 'space_suspended')
    await start($)
    await w.clock.settle()

    const pane = await $.ui.mount({
      plugin: 'datum',
      surface: 'terminal',
      component: 'Pane',
      requestId: 'datum-adops',
      props: { title: 'Datum · adops', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
    })
    expect(await pane.find({ type: 'Text', text: 'Flows: unavailable here (space_suspended)' })).toBeDefined()
  })
})
