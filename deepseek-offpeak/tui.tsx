// TUI plugin: shows DeepSeek off-peak pricing periods for Ollama Cloud and OpenCode Go.
import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, Show } from "solid-js"
import { formatNextPair, nextChange, nextTickDelay, periodInfo, resolveProfile, systemTimeZone, zoneLabel } from "./schedule.ts"

export function PricingBlock(props: { context: Plugin.Context; sessionID: string; now: () => Date }) {
  const theme = props.context.theme
  const timeZone = systemTimeZone()
  const profile = createMemo(() => {
    const live = props.context.ui.model.current()
    if (live) return resolveProfile(live.providerID, live.modelID)
    const stored = props.context.data.session.get(props.sessionID)?.model
    return resolveProfile(stored?.providerID, stored?.id)
  })

  return (
    <Show when={profile()}>
      {(active) => {
        const now = props.now()
        const info = periodInfo(active(), now)
        const next = nextChange(active(), now)
        return (
          <box>
            <box flexDirection="row" gap={1} minWidth={0}>
              <text fg={theme.text.base} wrapMode="none" flexShrink={0}>
                <b>DeepSeek</b>
              </text>
              <text fg={theme.text.muted} wrapMode="none" flexShrink={0}>
                ·
              </text>
              <text fg={info === "peak" ? theme.text.base : theme.text.muted} wrapMode="none" flexShrink={0}>
                <b>{info}</b>
              </text>
              <text fg={theme.text.muted} wrapMode="none" flexShrink={0}>
                · {zoneLabel(timeZone)}
              </text>
            </box>
            <Show when={next}>
              {(transition) => (
                <box flexDirection="row" gap={1} minWidth={0}>
                  <text fg={info === "peak" ? theme.text.base : theme.text.muted} wrapMode="none" flexShrink={0}>
                    {transition().kind === "peakEnd" ? "▼" : "▲"}
                  </text>
                  <text fg={theme.text.muted} wrapMode="none">
                    {formatNextPair(transition().at, props.now(), timeZone)}
                  </text>
                </box>
              )}
            </Show>
          </box>
        )
      }}
    </Show>
  )
}

export default Plugin.define({
  id: "deepseek-offpeak",
  setup(context) {
    const [now, setNow] = createSignal(new Date())
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const current = new Date()
      setNow(current)
      timer = setTimeout(tick, nextTickDelay(current))
    }
    timer = setTimeout(tick, nextTickDelay(now()))
    const unregister = context.ui.slot({
      append: "sidebar.content",
      render: (props) => <PricingBlock context={context} sessionID={props.sessionID} now={now} />,
    })
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      unregister()
    }
  },
})
