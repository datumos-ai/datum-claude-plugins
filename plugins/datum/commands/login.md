---
description: Sign in to Datum with your Microsoft account (device code) so the Datum tools and CLI act as you
argument-hint: [base-url]
allowed-tools: [Bash]
---

Sign the `datum` CLI in to Datum for this user.

1. Run `datum login` — with `--base-url $ARGUMENTS` when an argument was
   given, otherwise with no flags (the CLI remembers the last deployment; if
   it complains there is none, ask the user for the Datum URL, e.g.
   `https://datum.example.com`).
2. The command prints a verification URL and a code and then WAITS. Show
   both to the user exactly as printed and ask them to complete the sign-in
   in a browser. Do not paste anything else into the command.
3. When it returns, run `datum whoami` and report the identity and role it
   shows. If the Datum MCP server currently lists only `datum_login`, tell the
   user the tools will appear on the next tool list refresh.

Never ask for, or store, an API key or a token.
