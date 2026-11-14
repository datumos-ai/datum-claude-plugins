---
name: datum-delegate
description: >
  Hand a whole task to the space's Datum agent over the A2A protocol with
  `datum a2a` (the official `a2a` CLI, signed in as the person), and follow it
  to the result. Use it when the work needs what the SPACE has and this
  machine does not — its memory, runbooks, monitoring, clusters,
  repositories, credentials — and would take the agent minutes, not one
  lookup: "niech Datum zbada czemu das-bidder ma 5xx", "zleć agentowi
  przestrzeni diagnozę incydentu", "zapytaj agenta Datum, co się stało z
  feedem wczoraj", "delegate this investigation to Datum", "ask the space's
  agent and come back with the answer". Also use it to continue such a
  conversation (follow-ups in the same context), to check or cancel a
  delegated task, or when the user asks what Datum's agent can do. Not for a
  single knowledge lookup or one satellite capability — the MCP tools of this
  plugin answer those faster and cheaper.
version: 1.0.0
---

# Delegating to the space's Datum agent (A2A)

The `datum` MCP tools let *you* do the work with the space's tools. A2A is
the other way round: you describe the goal, the **space's own agent** does
the work with everything the space has, and you get the result. It is a run
on the platform — a session the team can open in the panel, paid with the
signed-in person's engine key — so it pays off for work of minutes, not for
a lookup the MCP tools answer in seconds.

Channel behaviour, limits and setup are described in the Datum documentation (A2A).

## The `delegate` tool first, when you have it

With the plugin's Datum windows running (Claude Code 2.1.287+), you have the
tool `delegate` (`mcp__datum__delegate`): it starts the task in the space's
window and returns at once, and the agent's answer is appended to this
conversation by itself when the run finishes — no polling, no stream to keep
alive, follow-ups land in the same space's conversation. Prefer it; pass
`space` when the person names one. Use `datum a2a` below when the tool is not
there.

## `datum a2a` — never a raw token

Every call goes through `datum a2a <verb> … --space <slug>`. It runs the
official `a2a` CLI as the signed-in person: it refreshes the sign-in, pins
the destination to the space's host and passes the credential only into the
`a2a` process. You never see, print or pass a token, and you never name a
host: flags like `-a`, `--endpoint`, `--auth`, `--svc-param` or `--config`
are refused (exit 2) — that is by design, do not look for a way round.

The space slug comes from the project's `.mcp.json`
(`"args": ["mcp", "serve", "--space", "<slug>"]`) or from the user. Pass it
as `--space <slug>` on every call (or `DATUM_SPACE=<slug>` in the command's
environment).

## Before the first task

1. `a2a version` — the CLI must be on PATH. Missing: tell the user to install
   it — macOS: `brew tap a2aproject/a2a-cli https://github.com/a2aproject/a2a-cli`,
   then `brew trust --formula a2aproject/a2a-cli/a2a` (a current Homebrew
   refuses a formula from an untrusted tap: "Refusing to load formula …
   from untrusted tap"), then `brew install a2a`; Windows:
   `winget install a2aproject.a2acli`; or a release binary from
   github.com/a2aproject/a2a-cli/releases. Do not install it yourself.
2. `datum a2a --help` — `Unknown command: a2a` means the `datum` CLI is
   older than the command (and `ERR_MODULE_NOT_FOUND … a2aCommand.js` is
   the broken 0.497.0/0.498.0 package): tell the user to run
   `npm install -g @datumos/datum-cli`.
3. `datum whoami --space <slug>` — signed in, and the role must be
   **operator** (a task starts a run). Not signed in: `/datum:login`.
4. `datum a2a card get --space <slug>` — who the agent is. `403` (the a2a
   CLI prints `card request failed, status: 403 Forbidden` and a hint about
   `--agent-card` — ignore the hint, the host is datum's) = the space's
   **A2A** feature is off, or the role cannot start a run (a newer
   `datum a2a` adds a line saying so). Tell the user a space admin enables it
   (Settings → Features → A2A), or that they need the operator role.

## Sending a task

Write the task as you would brief a colleague: the goal, the system, the time
window, what you already know, what you need back. In Polish when the user
works in Polish — the agent writes back in the language it is asked in.

```bash
datum a2a send --space <slug> --stream --timeout 3m -o json \
  "Zbadaj, czemu das-bidder ma wzrost 5xx od 14:00. Sprawdź deploymenty z ostatnich 24 h i logi. Zwróć przyczynę, dowody i rekomendację."
```

- Always `--stream` (progress arrives as `working` statuses, a quiet run
  sends a heartbeat every 20 s) **or** `--async`. Never a plain blocking send
  for real work — a proxy cuts a silent connection after a minute.
- `a2a` 0.3.0 drops a stream after about 3 minutes whatever `--timeout`
  says. For work that may take longer, start with `--async` and follow with
  `task get --wait`; if a stream does drop, the task keeps running — fetch
  it with `task get`, never re-send it.
- Keep the `taskId` and `contextId` from the output: the context is the
  conversation, the task is this one piece of work.
- Long work: run the command in the background (Bash `run_in_background`),
  keep working, and read the result when it finishes — or start with
  `--async` and later
  `datum a2a task get <taskId> --wait --timeout 30m --space <slug>`.

On Windows the commands are the same in PowerShell (line continuation is a
backtick, not a backslash).

## Reading the outcome

| State | What to do |
| --- | --- |
| `completed` | The answer is the `result` artifact — relay it, and say it came from the space's agent |
| `failed` | Relay the status message as is (e.g. no engine key on the person's Account page); do not retry blindly |
| `rejected` | The context already has a task running, or the space's budget or a restart refused it — wait for it or start a new context |
| `canceled` | Someone stopped it (you, or a person in the panel) |

Progress lines (`working: …`) are the agent thinking aloud and the tools it
reaches for — summarise them only if the user asks how it went.

## Follow-ups, status, cancel

```bash
# the same conversation — the agent remembers the thread
datum a2a send --space <slug> --stream --context-id <contextId> "A które line itemy tego dotknęły?"
datum a2a task list --space <slug> --context <contextId>
datum a2a task cancel <taskId> --space <slug>
```

A follow-up while the context's task is still running comes back
`rejected` — wait for it (`task get --wait`) first. Cancel only when the
user asks: it stops a real run on the platform.

## Honesty rules

- The agent works with the **caller's** role in the space (operator at
  most); what it cannot do there, you cannot make it do by rephrasing.
- The session is visible in the panel to the space — do not send secrets in
  a task.
- Say where an answer came from ("agent przestrzeni Datum ustalił…"); do not
  present it as your own verification.
