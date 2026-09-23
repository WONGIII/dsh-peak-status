# dsh-peak-status

[English](README.en.md) | 中文

在 DeepSeek Harness 的输入框左侧挂一条状态行，显示**北京时间**、**当前是高峰还是空闲**，以及**距离下一次切换还剩多久**：

```
● 高峰 14:23:45 · 剩余 03:36:15
● 空闲 12:30:01 · 剩余 01:29:59
```

高峰用红点、空闲用绿点。配色跟随 DSH 自己的 `--dsw-alias-*` 设计变量，深浅主题都适配。

## 峰谷规则

DeepSeek API 的优惠时段以**北京时间**（UTC+8）计算，本插件按同一套规则判断：

| 时间 | 状态 |
| --- | --- |
| 周一至周五 09:00–12:00 | 高峰 |
| 周一至周五 14:00–18:00 | 高峰 |
| 周一至周五其余时间 | 空闲 |
| 周六、周日全天 | 空闲 |

周末的空闲倒计时指向**下一个工作日的 09:00**（周六和周日都指向周一），不会把倒计时指向周末里的某个时刻。

## 安装

从 GitHub 安装（仓库自带已构建的 `lib/`，且刻意**不声明 `prepare` 脚本**，所以 pnpm 不会要求你放行构建授权）：

```bash
dsh plugin --profile web add github:WONGIII/dsh-peak-status
```

从本地 checkout 安装：

```bash
git clone https://github.com/WONGIII/dsh-peak-status.git
dsh plugin --profile web add ./dsh-peak-status
```

安装后**重启 DSH**（`dsh web` 或桌面端）。插件行是 host 侧的 Loader 行，浏览器半由它对外提供，所以要等 DSH 重新组合一次配置才生效；只刷新页面不够。

装上以后可以在侧栏 **Plugins → Installed** 里看到 `@dsh-external/dsh-peak-status`，展开即可单独开关 `dsh-peak-status` 这一行。关掉开关并刷新页面，状态行消失。

卸载：

```bash
dsh plugin --profile web remove @dsh-external/dsh-peak-status
```

## 开发

```
src/client/index.tsx   浏览器半：读时间、渲染状态行、注册到输入框槽位
src/client/loader.d.ts 浏览器半的运行环境契约（见下）
src/index.js           host 半（可省略，构建脚本会生成等价的空实现）
scripts/build.mjs      把 src/ 编译成 lib/ 下的发布产物
```

```bash
pnpm install
pnpm run build       # 写出 lib/，并提交它（发布产物随仓库分发）
pnpm run typecheck   # tsc --noEmit
pnpm run check       # 确认 lib/ 与 src/ 一致
```

构建刻意做得很薄：用 TypeScript 自己的 `transpileModule` 擦掉类型和 JSX，再把结果包进 `window.__ModuleLoader__.load({ id, factory })`——**没有打包器，也不内联任何依赖**。

## 工作原理

这个包同时是**组合包**和**client 插件**，两个身份各由一段 manifest 承担：

- `dsh.bundle.patch` 指向 [`cordis.patch.yml`](./cordis.patch.yml)，在 profile 的层栈里插入一行 `dsh-peak-status`。这是它能出现在 Plugins 页、能被开关的原因。
- `dsh.client.platform: "web"` 配合 `exports["./client"]`，让 `dsh-client-modules` 把 `lib/client.js` 当作该行的浏览器半送到页面上执行。

host 半（`lib/index.js`）是**空的 `apply`**：它存在的唯一意义是让这个包在 Loader 里占一行，而那一行正是浏览器半的载体。所以“关掉插件”不是卸载某个 host 服务，而是让浏览器半不再被投递。

浏览器半不 import React，而是从 loader 注入的 `require` 里取：

```js
var React = require("react");
```

client 插件不进 bundle——它由宿主的模块系统在页面里求值，`react` 解析到宿主那一份。`src/client/loader.d.ts` 就是这份契约的声明（React、`JSX`、`window`，以及用到的 `ctx.slots` / `ctx.effect` 表面），源码因此能类型检查而不必真的 import 这些模块。

状态行注册进 `conversation.input.left`——输入框左侧、与发送按钮同一条工具栏里的 list 槽位，`order: 100`：

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

一行 `<style>` 和一个槽位贡献都挂在插件 fiber 上：`slots.inject` 在槽位被声明或收起时重跑回调，`ctx.effect` 的清理函数负责撤掉两者。

## 已知限制

- **只在 web 端生效**。`dsh.client.platform` 是 `web`，TUI / headless profile 不加载浏览器半。
- **峰谷时段是硬编码的**：周一至周五 09:00–12:00、14:00–18:00，周末全天空闲。DeepSeek 若调整规则需改源码里的 `PEAK_WINDOWS`。
- **同一个 profile 里不要重复挂载**：两行同 id 会让插件管理器无法唯一定位该行，Plugins 页的开关会被判定为不可寻址而锁死。
- **时区固定为 `Asia/Shanghai`**，与本机时区无关，这样在任何地方看到的都是同一套官方时段。

## 参考

- 插件与组合包机制：[打包与安装插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)
- 显示元数据（本仓库的 `locale/*.json`）：[Cookbook: adding a workspace package](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-package.md)

## 许可证

[MIT](./LICENSE) © 2026 WONGIII
