/** Chunks as `datum sessions stream` prints them: one SSE event per chunk. */
export const sse = (chunks: readonly Record<string, unknown>[], from = 1): string =>
  chunks
    .map((chunk, i) => `data: ${JSON.stringify({ seq: from + i, ts: '2026-10-04T14:25:26.162Z', chunk })}\n\n`)
    .join('')
