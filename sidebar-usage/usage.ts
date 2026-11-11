// Pure usage aggregation helpers.
// Kept free of Solid and OpenCode imports so `node --test` can import this file directly.
export interface TokenUsage {
  readonly input: number
  readonly output: number
  readonly reasoning: number
  readonly cache: { readonly read: number; readonly write: number }
}

export interface UsageSummary {
  readonly input: number
  readonly output: number
  readonly reasoning: number
  readonly read: number
  readonly write: number
  readonly total: number
  readonly cost: number
  readonly hit?: number
}

/** A child shows only itself; a root sums its family, falling back to itself before the family loads. */
export function usageIDs(sessionID: string, parentID: string | undefined, family: readonly string[]) {
  if (parentID) return [sessionID]
  return family.length > 0 ? family : [sessionID]
}

export function summarize(usages: readonly TokenUsage[], cost: number): UsageSummary | undefined {
  const tokens = { input: 0, output: 0, reasoning: 0, read: 0, write: 0 }
  for (const usage of usages) {
    tokens.input += usage.input
    tokens.output += usage.output
    tokens.reasoning += usage.reasoning
    tokens.read += usage.cache.read
    tokens.write += usage.cache.write
  }
  const total = tokens.input + tokens.output + tokens.reasoning + tokens.read + tokens.write
  if (total === 0 && cost <= 0) return
  const prompt = tokens.input + tokens.read + tokens.write
  return {
    ...tokens,
    total,
    cost,
    hit: prompt === 0 ? undefined : Math.round((tokens.read / prompt) * 100),
  }
}
