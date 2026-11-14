# datum-claude-plugins

Claude Code plugins for **Datum** — the agentic service operations platform.
One plugin today, `datum`: use Datum from your own Claude Code, **as
yourself** — the agents of your spaces in windows beside the conversation, the
space's agent tools over MCP (knowledge search first) and the official `datum`
CLI, signed in with your Microsoft account. No API key.

> The plugins are clients: you need access to a Datum instance. Product
> site: <https://datumos.ai>.

## Install (once per machine)

Prerequisites: Node 22+ and Claude Code.

```bash
npm install -g @datumos/datum-cli          # installs or updates — run it again on a machine that has an older CLI
claude plugin marketplace add datumos-ai/datum-claude-plugins
claude plugin install datum@datum-claude-plugins
```

Already installed? Update both, or the skills stay at the old version:

```bash
claude plugin marketplace update datum-claude-plugins
claude plugin update datum@datum-claude-plugins
```

For delegating tasks over A2A (skill `datum-delegate`), also the official
`a2a` CLI:

```bash
brew tap a2aproject/a2a-cli https://github.com/a2aproject/a2a-cli
brew trust --formula a2aproject/a2a-cli/a2a   # a current Homebrew refuses an untrusted tap's formula
brew install a2a                              # Windows: winget install a2aproject.a2acli
```

A `DATUM_API_KEY` in your shell profile makes the `datum` API commands act
as that key instead of you (`datum login` and `whoami` say so) — remove it
from the profile. The plugin's MCP server and `datum a2a` always use your
sign-in.

Then sign in and check who you are:

```bash
datum login --base-url https://datum.example.com
#   open  https://microsoft.com/devicelogin
#   code  ABCD-1234
datum whoami --space adops
```

The most recent login is the CLI's default deployment, so the plugin's MCP
server needs no configuration. You can also sign in from inside Claude Code:
when you are not signed in, the Datum MCP server offers a single tool,
`datum_login`, whose result carries the URL and the code.

Building data products on lake tables? Add the companion plugin as well:

```bash
claude plugin install datum-data-products@datum-claude-plugins
```

## Pin your space in the team repository

Datum is multi-tenant: a **space** is a team. Add to your repository's
`.mcp.json` (create it if absent) so every Claude Code session in that repo
talks to your space:

```json
{
  "mcpServers": {
    "datum": { "command": "datum", "args": ["mcp", "serve", "--space", "adops"] }
  }
}
```

Without it, the plugin's own server talks to the org host — fine for
whoami, wrong for a space's knowledge.

## What you get

| Piece | What it does |
| --- | --- |
| MCP server `datum` (`datum mcp serve`) | `search_knowledge` — the space's knowledge bases; `satellite_call` / `satellite_task_result` — the team's satellite executors (operator role; mutating calls wait for a space admin's approval in the panel); `datum_whoami`; `datum_login` / `datum_status` from the shim. All the same tools the platform's agent uses |
| Skill `datum-cli` | how to use the CLI as a person: discover commands from `--help`, `--space`, exit codes, the Polish-domain-content rule |
| Skill `datum-knowledge` | when to search the knowledge base and how to cite sources |
| Skill `datum-ops` | when a satellite is the right tool, how to call a capability from its menu, and how to relay `pending_approval` honestly (a space admin decides in the panel) |
| Skill `data-products` | building a governed data product with its owner: source and table ownership, the model (datasets, joins, the metric grammar, field sets, required filters), the draft, control questions, access policies, reading validation problems — through `datum data-products …`. A copy of Datum's built-in skill, so your local Claude and the space's agent follow the same rules |
| Skill `datum-delegate` | when to hand a whole task to the space's agent over A2A instead of calling tools, and how: the official `a2a` CLI through `datum a2a` (no token handling), streaming or async, follow-ups in the same context, relaying the outcome honestly |
| Commands `/datum:login`, `/datum:whoami`, `/datum:status` | the sign-in and diagnostics, one word each |
| **Datum windows** (`/datum`, a hooks module) | the agent of each of your spaces in a window beside the conversation — one tab per space — with the space's running flows, answering a flow agent's questions, and tools for your local Claude: `delegate`, `pane`, sync. See [Datum windows](#datum-windows-beside-the-conversation) |

Your role is your own (membership, group or org grant), **capped at
operator** — an LLM on your machine never acts as admin, whoever signed in.
Admin work stays in the panel.

## Datum windows beside the conversation

A Claude Code **mod** (a hooks module, `plugins/datum/hooks/`) puts the agent of
each of your spaces in a window next to your session — no switching to the
panel. Every window is a tab (`Datum · <space>`); `ctrl+x tab` or a click
switches them.

| You type | What happens |
| --- | --- |
| `/datum` | opens the current space's window (`/datum-windows` when another plugin already holds `/datum`, a toast says so) |
| `/datum open <space>` | opens that space's window (its own tab, its own conversation) |
| `/datum <message>` · `@datum <message>` | sends to the current space's agent — the prompt goes to Datum, not to Claude |
| `/datum @<space> <message>` · `@datum:<space> <message>` | sends to that space (opens its window) |
| `/datum space` · `new` · `join <sessionId>` · `close` · `help` | your spaces, a fresh conversation, follow an existing session, close the window |
| `/datum sync on\|off` | whether window changes ride along with your messages to Claude (on by default) |

A window shows the conversation live (the agent's text, the tools it reaches
for, `Datum is thinking… (12s · ↓ tokens)`), a link to the session in the
panel, and the space's **flows** — the running ones as cards (phases, who a run waits
for, what it does now), the rest with their last run and next schedule. When a flow's agent asks a question, **Answer the
question** opens its card in the window: arrows move between options, Enter
or a digit picks and goes on to the next question, Esc cancels. The answer
goes as you, through `datum flows runs steps answer`; the server checks you
are in the question's circle.

For your local Claude:

- tool **`delegate`** — hands a task to a space's agent and returns at once;
  the answer is appended to the conversation by itself when the run finishes
  (an idle session is woken);
- tool **`pane`** — reads a window: the conversation's tail and the open runs;
- **sync** — what changed in the windows since your last message rides along
  with your next one (never the whole history; off with `/datum sync off`);
- **→ Claude** under every answer and run card quotes it into your prompt.

Where it starts: `DATUM_SPACE`, else the space you used last in this
directory, else the space pinned in the project's `.mcp.json`, else your first
space. Nothing is configured in the plugin: the deployment is the CLI's.

Everything the windows hand your local Claude is fenced as **data, not
instructions** (`<datum-pane>…</datum-pane>`, a closing tag inside is
defused): the space's agent reads untrusted sources, and your local Claude
runs Bash. A flow agent's question is drawn as plain text, no links.

Requires **Claude Code 2.1.287+** with mods on, the `datum` CLI **0.515+**
signed in (`/datum:login`), and on the space: **A2A** for the conversation
and **Flows** for the run cards (operator role). At most six live session
streams are kept; a window you have not used for longest lets its stream go
and gets it back when shown.

## Requirements on the Datum side

- The deployment has SSO login (Entra) configured and the app registration
  allows public client flows and exposes the `access_as_user` scope
  (org admin, once).
- Your space has **Settings → Features → Developer access (CLI & MCP)** on
  and, for `search_knowledge`, at least one searchable knowledge base; for
  the satellite tools, **Satellites** on with a connected satellite and the
  operator role for you; for `datum-delegate`, **A2A — delegate tasks to the
  agent** on, the operator role, an engine key on your Account page, and the
  [`a2a` CLI](https://github.com/a2aproject/a2a-cli) installed.

## Local development against a dev stack

```bash
export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"   # Node ignores the macOS keychain
datum login --base-url https://lvh.me:5174
```

Set `NODE_EXTRA_CA_CERTS` in the environment Claude Code inherits too, or
the shim cannot reach the local stack.

## Versioning

The plugin's `version` tracks the `@datumos/datum-cli` minor it was tested
against; the changelog below names the Datum release that introduced each
capability. Bump the plugin (and the marketplace entry) whenever a skill or
command changes; bump the minor when the CLI it drives changes.

| Plugin | CLI | Datum | What |
| --- | --- | --- | --- |
| 1.0.0 | 0.440+ | #327 phase 1 | `datum login` / `whoami` / `logout`, `datum mcp serve`, `search_knowledge`, `datum_whoami` |
| 1.1.0 | 0.440+ | #329, #330 (phase 2.1–2.2) | every tool call recorded in the person's `Claude Code · <nick>` session; `satellite_call` / `satellite_task_result` for operators; skill `datum-ops` |
| 1.2.0 | 0.497+ | #1382 | skill `datum-delegate` — tasks delegated to the space's agent over A2A with the `a2a` CLI; needs `datum a2a` |
| 1.2.1 | 0.499+ | #1428 | `datum-delegate` setup checks: `brew trust` before `brew install a2a`, an old/broken `datum` CLI, a 403 on the card = A2A off or role (was "404"); README: updating an installed plugin |
| 1.3.0 | 0.515+ | #1682 | **Datum windows** (a Claude Code mod, 2.1.287+): one window per space beside the conversation — live conversation with the space's agent, running flows as cards, answering a flow agent's question card; tools `delegate` and `pane`, sync with your messages, → Claude quotes |
| 1.3.1 | 0.515+ | #1682 | Datum windows start even when `/datum` is another plugin's: the command falls back to `/datum-windows`, and a refused registration no longer takes the tools and windows down with it |
| 1.4.0 | 0.586+ | #3171, #3212 | skill `data-products` — a copy of Datum's built-in one; companion plugin `datum-data-products` (2.0.0) — the groundwork for a product on lake tables, for any data: namespace, owner space, credential, catalog, where the data is already described, shared pitfalls |
| 1.3.2 | 0.515+ | #1682 | Datum windows list the space's flows always — running ones as cards, the rest with their last run and next schedule — and say why when flows cannot be read (a suspended space, Flows off) instead of hiding the section |

## Developing this repository

```bash
claude plugin marketplace add ./          # this checkout as a marketplace
claude plugin install datum@datum-claude-plugins
# after a change:
rm -rf ~/.claude/plugins/cache/datum-claude-plugins/
claude plugin install datum@datum-claude-plugins
claude plugin validate .
```

The Datum windows module (`plugins/datum/hooks/`) has its own checks:

```bash
claude plugin validate plugins/datum     # what the engine would refuse in the module
claude plugin test plugins/datum         # tests/*.test.ts against the engine
claude --plugin-dir plugins/datum        # a session that hot-reloads the module as you edit
```

Once Claude Code has loaded the module from this checkout it writes the API's
types under `plugins/datum/.claude-plugin/types/` and a `tsconfig.json` beside
them (both git-ignored); then `npx tsc -p plugins/datum` type-checks it.

CI (`.github/workflows/validate.yaml`) checks that every JSON file parses,
that the marketplace's plugin entries point at existing plugin directories
with a `plugin.json`, and that every skill has front matter with `name` and
`description`. It also fails on any mention of an operator's
organisation, hosts, registries or accounts — this repository is public.

## License

Apache-2.0 — see `LICENSE` and `NOTICE`. `Datum` and `DatumOS` are
trademarks; the license does not grant rights to them.
