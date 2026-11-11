# OpenCode TUI plugins

Small, standalone TUI plugins. Each directory is a self-contained plugin and can be copied into an OpenCode plugins directory.

- `deepseek-offpeak` - DeepSeek peak/off-peak pricing indicator for Ollama Cloud and OpenCode Go.
- `sidebar-usage` - Cumulative token, cache, and cost rows in the session sidebar.

Run the helper tests with:

```sh
node --test deepseek-offpeak/schedule.test.ts sidebar-usage/usage.test.ts
```
