# dsh-peak-status

English | [中文](README.md)

A status row for the DeepSeek Harness composer showing **Beijing time**, whether the API is currently in its **peak or off-peak window**, and a live **countdown to the next switch**:

```
● 高峰 14:23:45 · 剩余 03:36:15      (peak, 3h36m left)
● 空闲 12:30:01 · 剩余 01:29:59      (off-peak, 1h30m left)
```

A red dot marks peak, a green dot marks off-peak. Colors come from DSH's own `--dsw-alias-*` design tokens, so both dark and light themes work.

## Peak schedule

DeepSeek's discount windows are defined in **Beijing time** (UTC+8), and this plugin classifies them the same way:

| Time | Status |
| --- | --- |
| Monday–Friday 09:00–12:00 | peak |
| Monday–Friday 14:00–18:00 | peak |
| Monday–Friday, any other time | off-peak |
| Saturday and Sunday, all day | off-peak |

On a weekend the off-peak countdown targets **the next weekday's 09:00** (Saturday and Sunday both point at Monday), so the timer never points inside a weekend.

## Install

From GitHub (the repository ships the built `lib/` and deliberately declares **no `prepare` script**, so pnpm never asks you to allowlist a build):

```bash
dsh plugin --profile web add github:WONGIII/dsh-peak-status
```

From a local checkout:

```bash
git clone https://github.com/WONGIII/dsh-peak-status.git
dsh plugin --profile web add ./dsh-peak-status
```

**Restart DSH** afterwards (`dsh web` or the desktop app). The plugin row is a host-side Loader row and the browser half is served from it, so the profile has to recompose before the row exists; reloading the page alone is not enough.

Once installed, the sidebar's **Plugins → Installed** group shows `@dsh-external/dsh-peak-status`; expanding it lets you switch the single `dsh-peak-status` row on or off. Switch it off and reload the page to remove the status row.

Uninstall:

```bash
dsh plugin --profile web remove @dsh-external/dsh-peak-status
```

## Development

```
src/client/index.tsx   browser half: reads the clock, renders the row, registers the slot
src/client/loader.d.ts the browser half's runtime contract (see below)
src/index.js           host half (optional; the build emits an equivalent empty one)
scripts/build.mjs      compiles src/ into the published artifacts under lib/
```

```bash
pnpm install
pnpm run build       # writes lib/, which is committed (artifacts ship with the repo)
pnpm run typecheck   # tsc --noEmit
pnpm run check       # asserts lib/ is up to date with src/
```

The build is deliberately thin: it erases types and JSX with TypeScript's own `transpileModule` and wraps the result in `window.__ModuleLoader__.load({ id, factory })`. **No bundler, and no dependency is inlined.**

## How it works

The package is both a **DSH bundle** and a **client plugin**, one manifest field each:

- `dsh.bundle.patch` points at [`cordis.patch.yml`](./cordis.patch.yml), which inserts a `dsh-peak-status` row into the profile's layer stack. That is what makes it appear on the Plugins page and gives it a switch.
- `dsh.client.platform: "web"` plus `exports["./client"]` make `dsh-client-modules` treat `lib/client.js` as that row's browser half and serve it to the page.

The host half (`lib/index.js`) is an **empty `apply`**: its only job is to hold the Loader row the browser half is delivered from. So switching the plugin off does not tear down a host service — it stops the browser half from being delivered.

The browser half does not import React; it takes it from the `require` the loader injects:

```js
var React = require("react");
```

Client plugins are not bundled — the host's module system evaluates them in the page, so `react` resolves to the host's copy. `src/client/loader.d.ts` declares that contract (React, `JSX`, `window`, and the `ctx.slots` / `ctx.effect` surface the plugin uses), which is why the source type-checks without importing those modules.

The row registers into `conversation.input.left` — the list slot on the left of the composer, on the same toolbar row as the send button — at `order: 100`:

```tsx
ctx.effect(() => {
  const style = document.createElement('style')
  style.textContent = styles
  document.head.appendChild(style)
  const disposeSlot = ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register(
      { name: 'conversation.input.left', id: 'dsh-peak-status', order: 100 }, PeakStatusDock))
  return () => { style.remove(); disposeSlot() }
}, '@dsh-external/dsh-peak-status: input left')
```

Both the `<style>` element and the slot contribution hang off the plugin fiber: `slots.inject` re-runs its callback when the slot is declared or collapsed, and `ctx.effect`'s cleanup removes both.

## Known limitations

- **Web only.** `dsh.client.platform` is `web`; TUI and headless profiles never load the browser half.
- **The peak schedule is hard-coded**: Monday–Friday 09:00–12:00 and 14:00–18:00, weekends fully off-peak. A schedule change by DeepSeek needs an edit to `PEAK_WINDOWS`.
- **Mount it once per profile.** Two rows sharing one entry id make the row unaddressable to the plugin manager, which locks its switch on the Plugins page.
- **The time zone is fixed to `Asia/Shanghai`**, independent of the local machine, so everyone sees the same official windows.

## References

- Plugin and bundle mechanics: [Packaging and installing a plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
- Display metadata (this repo's `locale/*.json`): [Cookbook: adding a workspace package](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)

## License

[MIT](./LICENSE) © 2026 WONGIII
