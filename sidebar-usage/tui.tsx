// TUI plugin: adds cumulative token, cache, and cost rows to the session sidebar.
import { Plugin } from "@opencode/plugin/tui"
import { createMemo, Show } from "solid-js"
import { summarize, usageIDs } from "./usage.ts"

const number = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function SidebarUsage(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const state = createMemo(() => {
    const session = props.context.data.session.get(props.sessionID)
    if (!session) return
    // Cost already aggregates a root session's family, so aggregate its tokens the same way.
    const family = props.context.data.session.family(session.id)
    const usages = usageIDs(session.id, session.parentID, family).flatMap((id) => {
      const usage = props.context.data.session.get(id)?.tokens
      return usage ? [usage] : []
    })
    return summarize(usages, props.context.data.session.cost(props.sessionID))
  })

  return (
    <Show when={state()}>
      {(value) => (
        <box>
          <text fg={theme.text.base}>
            <b>Usage</b>
          </text>
          <Row theme={theme} label="total tokens" value={number.format(value().total)} />
          <Row theme={theme} label="input" value={number.format(value().input)} />
          <Row theme={theme} label="output" value={number.format(value().output)} />
          <Row theme={theme} label="reasoning" value={number.format(value().reasoning)} />
          <Row theme={theme} label="cache read" value={number.format(value().read)} />
          <Show when={value().write > 0}>
            <Row theme={theme} label="cache write" value={number.format(value().write)} />
          </Show>
          <Show when={value().hit !== undefined}>
            <Row theme={theme} label="cache hit" value={`${value().hit}%`} />
          </Show>
          <Show when={value().cost > 0}>
            <Row theme={theme} label="cost" value={money.format(value().cost)} />
          </Show>
        </box>
      )}
    </Show>
  )
}

function Row(props: { theme: Plugin.Context["theme"]; label: string; value: string }) {
  return (
    <box flexDirection="row" justifyContent="space-between" gap={1} minWidth={0}>
      <text fg={props.theme.text.muted} wrapMode="none" truncate flexShrink={1}>
        {props.label}
      </text>
      <text fg={props.theme.text.base} wrapMode="none" flexShrink={0}>
        {props.value}
      </text>
    </box>
  )
}

export default Plugin.define({
  id: "sidebar-usage",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarUsage context={context} sessionID={props.sessionID} />,
    })
  },
})
