// TUI plugin: shows DeepSeek off-peak pricing periods for Ollama Cloud and OpenCode Go.
import { Plugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, Show } from "solid-js"
import { formatNext, nextChange, nextTickDelay, periodInfo, resolveProfile } from "./schedule.ts"

export function PricingBlock(props: { context: Plugin.Context; sessionID: string; now: () => Date }) {
  const theme = props.context.theme
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
            <text fg={theme.text.base}>
              <b>DeepSeek off-peak</b>
              <span style={{ fg: theme.text.muted }}> · UTC</span>
            </text>
            <box flexDirection="row" gap={1} minWidth={0}>
              <text fg={theme.text.muted} flexShrink={0}>
                •
              </text>
              <text fg={theme.text.base} wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0}>
                <b>{active().label}</b>
              </text>
              <box flexDirection="row" gap={1} flexShrink={0}>
                <text fg={info === "peak" ? theme.text.base : theme.text.muted} wrapMode="none">
                  {info}
                </text>
                <Show when={next}>
                  {(transition) => (
                    <text fg={theme.text.muted} wrapMode="none">
                      {transition().kind === "peakEnd" ? "▼" : "▲"}{" "}
                      {formatNext(transition().at, props.now())}
                    </text>
                  )}
                </Show>
              </box>
            </box>
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
