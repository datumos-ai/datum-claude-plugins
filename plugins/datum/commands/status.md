---
description: Status of the Datum MCP connection in this session (endpoint, sign-in, last error)
allowed-tools: [mcp__plugin_datum_datum__datum_status, mcp__plugin_datum_datum__datum_whoami]
---

Check the Datum MCP connection of this Claude Code session.

1. Call the `datum_status` tool of the Datum MCP server. Report the endpoint
   (which space host the shim is pinned to), whether a sign-in is stored and
   for whom, when the token expires, and any last error.
2. If signed in, also call `datum_whoami` and report the effective role in
   the space.
3. If not signed in, offer `/datum:login` (or call `datum_login` and relay
   the URL and code verbatim).
