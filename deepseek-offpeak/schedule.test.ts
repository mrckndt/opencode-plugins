// Run with: node --test .opencode/plugins/deepseek-offpeak/schedule.test.ts
import assert from "node:assert/strict"
import test from "node:test"
import {
  formatNext,
  formatNextPair,
  hhmm,
  modelFamily,
  nextChange,
  nextTickDelay,
  periodInfo,
  PROFILES,
  resolveProfile,
  zoneLabel,
  type Profile,
} from "./schedule.ts"

const ollama = PROFILES.find((profile) => profile.providerID === "ollama-cloud")!
const go = PROFILES.find((profile) => profile.providerID === "opencode-go")!

test("Ollama Cloud peaks 12:00-18:00 UTC on weekdays", () => {
  assert.equal(periodInfo(ollama, new Date("2026-09-24T11:59:00Z")), "off-peak")
  assert.equal(periodInfo(ollama, new Date("2026-09-24T12:00:00Z")), "peak")
  assert.equal(periodInfo(ollama, new Date("2026-09-24T17:59:00Z")), "peak")
  assert.equal(periodInfo(ollama, new Date("2026-09-24T18:00:00Z")), "off-peak")
  assert.equal(periodInfo(ollama, new Date("2026-09-26T13:00:00Z")), "off-peak")
})

test("OpenCode Go peaks 01:00-04:00 and 06:00-10:00 UTC on weekdays", () => {
  assert.equal(periodInfo(go, new Date("2026-09-24T00:59:00Z")), "off-peak")
  assert.equal(periodInfo(go, new Date("2026-09-24T01:00:00Z")), "peak")
  assert.equal(periodInfo(go, new Date("2026-09-24T03:59:00Z")), "peak")
  assert.equal(periodInfo(go, new Date("2026-09-24T04:00:00Z")), "off-peak")
  assert.equal(periodInfo(go, new Date("2026-09-24T05:59:00Z")), "off-peak")
  assert.equal(periodInfo(go, new Date("2026-09-24T06:00:00Z")), "peak")
  assert.equal(periodInfo(go, new Date("2026-09-24T09:59:00Z")), "peak")
  assert.equal(periodInfo(go, new Date("2026-09-24T10:00:00Z")), "off-peak")
  assert.equal(periodInfo(go, new Date("2026-09-26T02:00:00Z")), "off-peak")
})

test("OpenCode Go has no Chinese holiday carve-out", () => {
  // 2026-10-01 is National Day and a Thursday. The published Go schedule only
  // exempts weekends, so the weekday peak windows still apply.
  assert.equal(periodInfo(go, new Date("2026-10-01T02:00:00Z")), "peak")
})

test("finds the next Go transition", () => {
  assert.deepEqual(nextChange(go, new Date("2026-09-24T01:30:00Z")), {
    kind: "peakEnd",
    at: new Date("2026-09-24T04:00:00Z"),
  })
  assert.deepEqual(nextChange(go, new Date("2026-09-24T09:59:00Z")), {
    kind: "peakEnd",
    at: new Date("2026-09-24T10:00:00Z"),
  })
  assert.deepEqual(nextChange(go, new Date("2026-09-24T00:30:00Z")), {
    kind: "peakStart",
    at: new Date("2026-09-24T01:00:00Z"),
  })
  assert.deepEqual(nextChange(go, new Date("2026-09-24T04:30:00Z")), {
    kind: "peakStart",
    at: new Date("2026-09-24T06:00:00Z"),
  })
  // After the last Friday window the next peak is Monday.
  assert.deepEqual(nextChange(go, new Date("2026-09-25T10:30:00Z")), {
    kind: "peakStart",
    at: new Date("2026-09-28T01:00:00Z"),
  })
  assert.deepEqual(nextChange(go, new Date("2026-09-26T12:00:00Z")), {
    kind: "peakStart",
    at: new Date("2026-09-28T01:00:00Z"),
  })
  // A `from` exactly on a boundary reports the following transition.
  assert.deepEqual(nextChange(go, new Date("2026-09-24T01:00:00Z")), {
    kind: "peakEnd",
    at: new Date("2026-09-24T04:00:00Z"),
  })
})

test("finds the next Ollama Cloud transition", () => {
  assert.deepEqual(nextChange(ollama, new Date("2026-09-24T11:30:00Z")), {
    kind: "peakStart",
    at: new Date("2026-09-24T12:00:00Z"),
  })
  assert.deepEqual(nextChange(ollama, new Date("2026-09-24T17:30:00Z")), {
    kind: "peakEnd",
    at: new Date("2026-09-24T18:00:00Z"),
  })
  assert.deepEqual(nextChange(ollama, new Date("2026-09-25T18:30:00Z")), {
    kind: "peakStart",
    at: new Date("2026-09-28T12:00:00Z"),
  })
})

test("returns undefined when a profile never changes period", () => {
  const quiet: Profile = { label: "Quiet", providerID: "quiet", windows: [] }
  assert.equal(nextChange(quiet, new Date("2026-09-24T00:00:00Z")), undefined)
})

test("formats the next transition clock and day", () => {
  const now = new Date("2026-09-24T01:30:00Z")
  assert.equal(formatNext(new Date("2026-09-24T04:00:00Z"), now), "04:00")
  assert.equal(formatNext(new Date("2026-09-28T01:00:00Z"), now), "Mon 01:00")
  assert.equal(formatNext(new Date("2026-10-05T01:00:00Z"), now), "Oct 5 01:00")
})

test("formats the transition pair in a local zone with DST applied", () => {
  const berlin = "Europe/Berlin"
  // CET (UTC+1) in winter.
  assert.equal(
    formatNextPair(new Date("2026-01-15T17:00:00Z"), new Date("2026-01-15T12:00:00Z"), berlin),
    "17:00 UTC · 18:00",
  )
  // CEST (UTC+2) in summer.
  assert.equal(
    formatNextPair(new Date("2026-07-15T16:00:00Z"), new Date("2026-07-15T12:00:00Z"), berlin),
    "16:00 UTC · 18:00",
  )
  // The 2026-03-29 switch skips 02:00-03:00 Berlin, so 01:00 UTC is already 03:00.
  assert.equal(
    formatNextPair(new Date("2026-03-29T01:00:00Z"), new Date("2026-03-28T12:00:00Z"), berlin),
    "Sun 01:00 UTC · Sun 03:00",
  )
  // A same-day UTC transition can already be the next day in Berlin.
  assert.equal(
    formatNextPair(new Date("2026-01-15T23:30:00Z"), new Date("2026-01-15T12:00:00Z"), berlin),
    "23:30 UTC · Fri 00:30",
  )
  assert.equal(
    formatNext(new Date("2026-01-15T23:30:00Z"), new Date("2026-01-15T12:00:00Z"), berlin),
    "Fri 00:30",
  )
})

test("collapses the pair when the local zone is UTC", () => {
  assert.equal(formatNextPair(new Date("2026-01-15T17:00:00Z"), new Date("2026-01-15T12:00:00Z"), "UTC"), "17:00 UTC")
})

test("derives a short label from an IANA zone id", () => {
  assert.equal(zoneLabel("Europe/Berlin"), "Berlin")
  assert.equal(zoneLabel("America/New_York"), "New York")
  assert.equal(zoneLabel("UTC"), "UTC")
})

test("formats minutes without wrapping past midnight", () => {
  assert.equal(hhmm(0), "00:00")
  assert.equal(hhmm(7), "00:07")
  assert.equal(hhmm(60), "01:00")
  assert.equal(hhmm(1439), "23:59")
  assert.equal(hhmm(1440), "24:00")
})

test("aligns the next tick to a whole five-minute interval", () => {
  assert.equal(nextTickDelay(new Date("2026-09-24T01:00:30.000Z")), 270_000)
  assert.equal(nextTickDelay(new Date("2026-09-24T01:00:00.000Z")), 300_000)
  assert.equal(nextTickDelay(new Date("2026-09-24T01:04:59.500Z")), 500)
  assert.equal(nextTickDelay(new Date("2026-09-24T01:12:00.000Z")), 180_000)
})

test("normalizes model variants and dated snapshot suffixes", () => {
  assert.equal(modelFamily("DeepSeek-V4.1-Flash"), "deepseek-v4.1-flash")
  assert.equal(modelFamily("deepseek-v4-pro:free"), "deepseek-v4-pro")
  assert.equal(modelFamily("deepseek-v4-pro-20260910"), "deepseek-v4-pro")
  assert.equal(modelFamily("deepseek-v4.1-flash-1017"), "deepseek-v4.1-flash")
  assert.equal(modelFamily("deepseek-v4-flash"), "deepseek-v4-flash")
})

test("matches only DeepSeek families on known providers", () => {
  assert.equal(resolveProfile("ollama-cloud", "deepseek-v4.1-flash")?.label, "Ollama Cloud")
  assert.equal(resolveProfile("opencode-go", "deepseek-v4-pro")?.label, "OpenCode Go")
  assert.equal(resolveProfile("OPENCODE-GO", "DeepSeek-V4.1-Flash:free")?.label, "OpenCode Go")
  assert.equal(resolveProfile("opencode-go", "grok-4.7"), undefined)
  assert.equal(resolveProfile("unknown", "deepseek-v4-pro"), undefined)
  assert.equal(resolveProfile(undefined, "deepseek-v4-pro"), undefined)
  assert.equal(resolveProfile("ollama-cloud", undefined), undefined)
})
