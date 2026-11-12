// Pure DeepSeek pricing-schedule helpers.
// Kept free of Solid and OpenCode imports so `node --test` can import this file directly.
export interface PeakWindow {
  /** UTC weekdays, 0 = Sunday. */
  readonly days: readonly number[]
  /** Minutes after UTC midnight. Windows never cross midnight. */
  readonly start: number
  readonly end: number
}

export type Period = "peak" | "off-peak"

export interface Profile {
  readonly label: string
  readonly providerID: string
  readonly windows: readonly PeakWindow[]
}

export interface Transition {
  readonly kind: "peakStart" | "peakEnd"
  readonly at: Date
}

const WEEKDAYS = [1, 2, 3, 4, 5] as const
const DEEPSEEK_MODELS: readonly string[] = ["deepseek-v4.1-flash", "deepseek-v4-pro"]
// Longest quiet stretch is Friday's last peak end to Monday's first peak start.
// A week of slack keeps the scan bounded if the profiles gain longer gaps.
const TRANSITION_HORIZON_DAYS = 8
export const MINUTE_MS = 60_000
// All schedule boundaries fall on whole hours, so a 5-minute tick still lands on every transition.
export const REFRESH_MS = 5 * MINUTE_MS
const DAY_MS = 24 * 60 * MINUTE_MS

export const PROFILES: readonly Profile[] = [
  {
    label: "Ollama Cloud",
    providerID: "ollama-cloud",
    // Off-peak outside 12:00-18:00 UTC on weekdays and all day on weekends.
    windows: [{ days: WEEKDAYS, start: 12 * 60, end: 18 * 60 }],
  },
  {
    label: "OpenCode Go",
    providerID: "opencode-go",
    // Peak 01:00-04:00 and 06:00-10:00 UTC, Monday-Friday. The published Go
    // schedule has no holiday carve-out, so weekends alone are all-day off-peak.
    windows: [
      { days: WEEKDAYS, start: 60, end: 240 },
      { days: WEEKDAYS, start: 360, end: 600 },
    ],
  },
]

export function modelFamily(modelID: string) {
  return modelID
    .toLowerCase()
    .replace(/:.*$/, "")
    .replace(/-\d{4,8}$/, "")
}

export function resolveProfile(providerID: string | undefined, modelID: string | undefined) {
  if (!providerID || !modelID) return
  if (!DEEPSEEK_MODELS.includes(modelFamily(modelID))) return
  const provider = providerID.toLowerCase()
  return PROFILES.find((profile) => profile.providerID === provider)
}

export function periodInfo(profile: Profile, date: Date): Period {
  const weekday = date.getUTCDay()
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
  for (const window of profile.windows) {
    if (window.days.includes(weekday) && minutes >= window.start && minutes < window.end) {
      return "peak"
    }
  }
  return "off-peak"
}

export function nextChange(profile: Profile, from: Date): Transition | undefined {
  const current = periodInfo(profile, from)
  const fromTime = from.getTime()
  const dayStart = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  for (let offset = 0; offset <= TRANSITION_HORIZON_DAYS; offset += 1) {
    const day = dayStart + offset * DAY_MS
    const weekday = new Date(day).getUTCDay()
    const boundaries = profile.windows
      .filter((window) => window.days.includes(weekday))
      .flatMap((window) => [window.start, window.end])
      .map((minutes) => day + minutes * MINUTE_MS)
      .sort((left, right) => left - right)
    for (const at of boundaries) {
      if (at <= fromTime) continue
      const date = new Date(at)
      if (periodInfo(profile, date) !== current) {
        return { kind: current === "peak" ? "peakEnd" : "peakStart", at: date }
      }
    }
  }
}

/** Formats minutes after UTC midnight. Callers pass 0..1440. */
export function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

/** IANA time zone of the machine running the TUI. */
export function systemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Short display name for an IANA zone id: "Europe/Berlin" -> "Berlin". */
export function zoneLabel(timeZone: string) {
  return timeZone.split("/").pop()!.replace(/_/g, " ")
}

const zoneFormatters = new Map<string, Intl.DateTimeFormat>()

function zoneFormatter(timeZone: string) {
  let formatter = zoneFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    zoneFormatters.set(timeZone, formatter)
  }
  return formatter
}

/** Minutes after local midnight and the local calendar day, resolved in `timeZone`. */
function zoneClock(date: Date, timeZone: string) {
  const parts = new Map(zoneFormatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]))
  const year = Number(parts.get("year"))
  const month = Number(parts.get("month"))
  const day = Number(parts.get("day"))
  return {
    minutes: Number(parts.get("hour")) * 60 + Number(parts.get("minute")),
    dayNumber: Math.round(Date.UTC(year, month - 1, day) / DAY_MS),
  }
}

/**
 * Formats the next transition in `timeZone` (default UTC), with a day prefix
 * when it falls on a later calendar day there. Named zones carry their own DST
 * rules, so no manual offset math is needed.
 */
export function formatNext(at: Date, now: Date, timeZone = "UTC") {
  const clock = hhmm(zoneClock(at, timeZone).minutes)
  const days = zoneClock(at, timeZone).dayNumber - zoneClock(now, timeZone).dayNumber
  if (days === 0) return clock
  const format =
    days < 7
      ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone })
      : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone })
  return `${format.format(at)} ${clock}`
}

/** UTC clock first, then the same transition in `timeZone`: "18:00 UTC · 19:00". */
export function formatNextPair(at: Date, now: Date, timeZone: string) {
  const utc = formatNext(at, now)
  if (timeZone === "UTC") return `${utc} UTC`
  return `${utc} UTC · ${formatNext(at, now, timeZone)}`
}

/** Milliseconds until the next refresh tick, aligned to whole REFRESH_MS intervals. */
export function nextTickDelay(now: Date) {
  return REFRESH_MS - (now.getTime() % REFRESH_MS)
}
