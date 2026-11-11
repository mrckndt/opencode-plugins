// Run with: node --test .opencode/plugins/sidebar-usage/usage.test.ts
import assert from "node:assert/strict"
import test from "node:test"
import { summarize, usageIDs, type TokenUsage } from "./usage.ts"

const usage = (input: number, output: number, reasoning: number, read: number, write: number): TokenUsage => ({
  input,
  output,
  reasoning,
  cache: { read, write },
})

test("a root sums its whole family", () => {
  assert.deepEqual(usageIDs("root", undefined, ["root", "child"]), ["root", "child"])
})

test("a child shows only itself", () => {
  assert.deepEqual(usageIDs("child", "root", ["root", "child"]), ["child"])
})

test("a root falls back to itself before the family loads", () => {
  assert.deepEqual(usageIDs("root", undefined, []), ["root"])
})

test("sums every token bucket including cache write", () => {
  const summary = summarize(
    [usage(100, 20, 10, 50, 5), usage(1, 2, 3, 4, 5)],
    0.5,
  )
  assert.deepEqual(summary, {
    input: 101,
    output: 22,
    reasoning: 13,
    read: 54,
    write: 10,
    total: 200,
    cost: 0.5,
    hit: 33,
  })
})

test("hides zero usage and zero cost", () => {
  assert.equal(summarize([], 0), undefined)
  assert.equal(summarize([usage(0, 0, 0, 0, 0)], 0), undefined)
})

test("still renders a cost-only session", () => {
  assert.equal(summarize([], 0.01)?.total, 0)
})

test("pins the cache-hit denominator to input plus cache read and write", () => {
  assert.equal(summarize([usage(100, 0, 0, 50, 50)], 0)?.hit, 25)
})

test("omits the hit rate when the prompt side is empty", () => {
  assert.equal(summarize([usage(0, 100, 0, 0, 0)], 0)?.hit, undefined)
})
