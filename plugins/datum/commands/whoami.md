---
description: Who Datum thinks you are — identity, role in a space, sign-in status
argument-hint: [space-slug]
allowed-tools: [Bash]
---

Report the user's Datum identity.

1. Run `datum whoami --space $ARGUMENTS` when a space slug was given,
   otherwise `datum whoami`.
2. Summarise: identity, role (and that person tokens are capped at operator),
   the space or org host answered, `authVia`.
3. If it says `not signed in`, offer `/datum:login`. If it says developer
   access is disabled for the space, say a space admin enables it under
   Settings → Features → Developer access.
