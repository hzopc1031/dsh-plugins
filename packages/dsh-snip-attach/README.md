# 桌面截图附件 · dsh-snip-attach

版本 **0.1.0**，MIT。**尚未发布到 npm**。仅针对官方 **DSH Desktop 0.2.1-rc.5 + Windows**；客户端每次操作会校验 `__DSH_BOOT__.release.version` 和桌面页面地址，其他版本或网页环境禁用按钮。`dsh.client.platform: web` 表示桌面壳中的 Web Client，并不表示支持普通浏览器。

在输入框底部左侧工具栏点击 **相机按钮「截图并添加附件」**，用 Windows `ms-screenclip:` 框选截图。检测到新的剪贴板图片后，图片通过 DSH 自己的文件 intake 加入当前会话的待发送附件，提示「截图已加入待发送消息」，**不会自动发送**。按钮位于「+」右侧的左侧扩展区，权限/计划控件可能在两者之间。

命令为 **`/screenshot`**，不接受参数。相机按钮调用该宿主命令并取回图片；**手工输入命令只启动截图并返回一次性取图 URL，不自动添加附件**，完成后可以 Ctrl+V。不要把取图 URL 复制给他人。正在截图时拒绝第二次截图，避免多个 PowerShell 进程抢同一个剪贴板。输入处于非 plain 阶段、已移除会话或子代理会话时禁用按钮。

## 安装

先完全退出桌面 DSH（含托盘），使用 git 安装，无需 npm 发布：

```powershell
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-snip-attach"
```

如果 PATH 中的独立 CLI 提示 desktop profile 只能由 Electron 管理，使用桌面捆绑 CLI：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-snip-attach"
```

也可在 **插件 → 添加插件** 中输入：

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-snip-attach
```

安装后重启桌面 DSH。将 `main` 换成提交哈希可固定版本。包包含预构建 `lib/`、类型声明、`capture.ps1`、Cordis patch、locale 和自绘 SVG；没有安装脚本。不要与另一个占用 `/screenshot` 的插件同时启用，Cordis 不保证命令冲突时选中本包。

卸载：`dsh plugin --profile desktop remove dsh-snip-attach`，然后重启 DSH。

## 工作流程与安全边界

1. 宿主 `inject: ['commands']`，在 apply 中监听随机本机端口，注册 `screenshot` 命令。只绑定 **127.0.0.1**，不是 `0.0.0.0`。
2. 每次命令生成 `randomUUID()`，只写 `os.tmpdir()/dsh-shot-<token>.png`，不接受请求路径、命令参数提供的外部文件名。PowerShell 通过固定 argv 启动：`powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File <包内 capture.ps1> -OutFile <生成路径>`，`windowsHide: true`、`stdio: ignore`、`shell: false`。
3. PS1 加载 Forms/Drawing，读取现有图片的宽×高与 3×3 ARGB 采样签名，启动 `ms-screenclip:`，启动失败时尝试 `explorer.exe ms-screenclip:`。每 200ms 检查剪贴板；签名变化才保存 PNG。默认 120 秒等待，退出码 0=成功、2=超时/取消/初始化失败、6=保存失败。
4. `GET /shot/<token>` 等待子进程完成：成功为 200 `image/png` + Content-Length；取消、失败、超时、图片不存在或非 PNG 为 204。未知/重复 token 为 404；已知 token 的 OPTIONS 为 204，不消费 token；其他方法为 405。不支持查询参数、任意文件路径、重定向或重试取图。
5. **只有 `Origin: dsh-app://app` 被允许**；缺失、null 和外来 Origin 均为 403，不消费 token。不使用 `*`；响应带 `Cache-Control: no-store` 与 `Vary: Origin`。GET 在等待之前就独占 token，第二次并行请求不能取图。
6. GET 完成或断开、TTL 到期、插件卸载时清理文件/token；子进程 150 秒 watchdog，token 最长存活 10 分钟。被杀进程如果在退出前刚写完图片，会在 close 时补清理。客户端等待上限为 160 秒，会话切换/卸载会中止后续注入。固定错误事件写入 **`%TEMP%\dsh-screenshot.log`**，不记录 token、截图内容或子进程输出。
7. 客户端只接受严格匹配的回环 URL；fetch 不携带凭据、不跟随重定向。Blob 转 PNG File，通过当前按钮所在 `[data-composer-card]` 中唯一的 `input[type="file"][hidden][multiple]` 派发 change。复用宿主的阶段检查、图片数量/大小限制和附件预览。确认新附件 ID 出现才报成功；DOM、DataTransfer 或 intake 失败提示「图片已在剪贴板，可按 Ctrl+V」。

**本插件会执行 PowerShell（ExecutionPolicy Bypass）、开放本机端口、读取剪贴板、写临时图片与错误日志。** 框选操作通常会由 Windows 更新剪贴板；本插件不恢复原剪贴板。截图可能含敏感内容，发送前请检查附件。其他应用在等待期间复制的新图片也可能被识别为截图；3×3 签名是变化检测而不是可信来源验证，相同尺寸/采样值的重复截图可能等到超时。Esc 不能直接通知 PS1，因此取消后可能继续等待至 120 秒；不会复用旧图。

Origin/CORS 不是本机进程的身份验证。本机程序能伪造 Origin；拿到 URL 的程序可抢先消费 token。DSH 的命令结果可能保留在会话记录中，但 token 会消费或过期。主机被强制终止、断电、文件被占用时不能保证清理；可能留下 `%TEMP%\dsh-shot-<token>.png` 和日志，需用户自行核对后清理。插件不扫描或删除其他临时文件。清理失败写固定日志，不声称安全擦除磁盘数据。

## 与设计文档的差异

以下适配以 Liu《DSH 桌面端截图插件 - 设计实现文档》的文字为输入，不依赖截图、附件或外部图片。核实对象为官方标签 **`dsh-v0.2.1-rc.5`**，commit **`b830ec950faba0a46dda564be3e2d854afed94f1`**。

| 设计项 | rc.5 核实与本包实现 | 判断依据 |
| --- | --- | --- |
| 「+」右侧相机，`conversation.input.left` | 槽位存在且为 session list；按官方顺序在「+」与权限/计划控件之后，不能保证紧邻「+」。使用 `slots.inject` + `slots.register`，不调整宿主 DOM 布局。 | [contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/slots.ts)、[InputBar.tsx](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx)、[slots.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/slots.md) |
| `remote.commands.execute('/screenshot')` | 实际调用 `ctx.remote.commands.execute(sessionId, '/screenshot', [])`；先检查 `RemoteResult.ok`，再读取 `value.result.kind/text`，不是直接读取根级 kind。 | [ui-commands service.ts 的 execute](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-commands/src/client/service.ts)、[api-remotes/client](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/api/remotes/src/client/index.ts) |
| 宿主注册 `/screenshot` | `ctx.commands.register` 的 name 是 **`screenshot`，无斜杠**；配置唯一 `CommandDefinitionId('dsh-snip-attach')`、`recordInput: false`，使用 effect 随插件注销。命令显示拼写仍为 `/screenshot`。 | [interaction/commands/src/index.ts 的 register/execute](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/commands/src/index.ts) |
| 无 addFiles，只能复用文件 intake | 左侧槽位的公共 InputActions 有 `addAttachments(ids)`，但它只接收已存在的浏览器附件 ID，不能接收 File；公共 IConversation 不提供 `createDrafts`。`ComposerBarInjected.addFiles` 属于 bar 私有注入；`onAddFiles` 只给单占 attachments 槽位。本包不取代附件栏或调用内部类方法，保留隐藏 input 方案，限定在本 composer 中且必须唯一。 | [contract/input.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/input.ts)、[IConversation 与内部 createDrafts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/service.ts)、[contract/slots.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/contract/slots.ts)、[apply.ts 的 addFiles](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/apply.ts) |
| 隐藏 input 选择器未具体写出 | rc.5 的 `InputBar.tsx` 使用 `data-composer-card`、隐藏 multiple file input；`onPickFiles` 清空 value 后调用 `intakeFiles`。本包按此限定选择器，并核对新附件 ID，避免被阶段/图片限制拒绝时误报成功。 | [InputBar.tsx 的 onPickFiles、intakeFiles、工具栏 JSX](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx) |
| origin `dsh-app://app` | 与 rc.5 一致。只准该 Origin，且客户端校验 protocol/hostname；不使用标准 URL 对自定义协议可能返回的 `origin: null` 来放宽访问。 | [desktop/ipc.ts 的 SCHEME](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/src/ipc.ts)、[desktop/main.ts 的 applicationUrl、scheme privileges 与 Origin 检查](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/src/main.ts) |
| 桌面壳禁用 getDisplayMedia | rc.5 **内嵌浏览器**明确用空 callback 拒绝 display media；主应用的媒体权限代码只允许 audio，没有安装屏幕来源选择 handler。源码不支持把“主页面显式覆写/禁用 getDisplayMedia”当成已验证结论。本包按无可用屏幕捕获桥处理，采用设计的 Windows URI；未实际调用 getDisplayMedia 检查运行时错误。 | [browser-guests.ts 的 configureSession](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/src/browser-guests.ts)、[microphone-permissions.ts](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/src/microphone-permissions.ts)、[其官方测试](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/tests/microphone-permissions.spec.ts)、[preload-app.ts 暴露的桥](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/apps/desktop/src/preload-app.ts) |
| `__ModuleLoader__.load({id,factory})` | 保持该 factory 格式，React 由宿主提供；依照已有包预构建 CJS factory，并声明 rc.5 client 包依赖。新增精确版本/桌面检查；只声明 `platform: web` 不足以判定桌面。 | [client-modules.md 的 WebBootGraph.release 与包扫描](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/docs/subsystems/client-modules.md)、本仓库 `dsh-draft-rescue/scripts/build-client.mjs` |
| 并发、注入成功和失败处理 | 额外拒绝并发捕获、拒绝非桌面/其他版本、会话切换后停止注入、GET 原子消费 token、检查 PNG 文件头；204 明示未完成。PS1 基线读取失败会重试后退出，避免把旧剪贴板当新截图。 | 设计的单一全局剪贴板和一次性 token 约束；rc.5 InputBar 的 busy/图片限制与 session 作用域 |

仓库基线 `64d6bb3` 没有根 `AGENTS.md` 或 `_template`；实际遵循根 README、`dsh-draft-rescue`、`dsh-file-ref-copy` 的独立 lockfile、TS、预构建产物、测试和精确 verify-pack 白名单惯例。未读取 `_private`、`_tools`，未改 `app.asar`、已安装资源或 DSH 全局配置。

## 与现有截图包的区别

本包 npm 名为 **`dsh-snip-attach`**，没有占用已有名称。仅只读查看过 npm 元数据，没有下载或复制它们的实现代码：

- [`dsh-plugin-screenshot@0.3.5`](https://www.npmjs.com/package/dsh-plugin-screenshot/v/0.3.5) 的描述包含隐藏/保留本窗口、窗口边缘吸附等功能。本包提供 rc.5 适配的 Windows 原生框选 → 待发送附件流程，不实现这些额外窗口/吸附控制。
- [`dsh-screenshot@0.0.1`](https://www.npmjs.com/package/dsh-screenshot/v/0.0.1) 的元数据描述为名称保留、首版开发中。本包是独立实现，包含宿主/客户端、PowerShell、一次性回环协议和可复现的包验证；这些说明不推断对方未公开的实现细节。

## 开发与验证

在本包目录执行，Node >=22（本次使用 **Node 24.20.0、npm 11.19.0、Windows PowerShell**）：

```powershell
npm ci --ignore-scripts
npm run typecheck
npm run build
npm test
npm run verify-pack
```

`npm test` 包含 build，`lib/` 与 lockfile 提交到 git。`verify-pack` 使用 `npm pack --dry-run --json --ignore-scripts`，精确检查 22 个文件、所有导出及声明、版本锁、factory 包装与无安装期钩子。仅开发依赖固定到 rc.5；运行时使用宿主 React/Cordis/commands，不打包这些依赖代码。

已测：**40/40 测试通过，0 失败、0 跳过**；typecheck、build、verify-pack 通过。测试包含真实 IPv4 回环 HTTP 的等待/200/204/403/404/405/OPTIONS、CORS、无 Origin、一次性并发 GET、随机 token/路径、单捕获拒绝、TTL、未取图清理、断连/卸载清理、PNG 错误；PS1 退出码到结果映射、固定 argv、spawn 错误、150 秒 watchdog 的加速模拟和迟到文件清理；实际预构建 browser factory 的 jsdom + React 注入、正确会话参数、PNG File/change、取消、错误、剪贴板 fallback、版本、输入状态、会话切换；真实 Cordis 的宿主加载/注册/卸载。长超时用缩短计时覆盖，没有实际等待 10 分钟。

本机已安全执行一次（使用随机临时目标）：

```powershell
$outFile = Join-Path ([IO.Path]::GetTempPath()) ('dsh-snip-dryrun-' + [guid]::NewGuid().ToString() + '.png')
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\capture.ps1 -OutFile $outFile -DryRun
$LASTEXITCODE
Test-Path -LiteralPath $outFile
```

实际结果：

```text
DryRun OK: STA assemblies loaded; no screenclip, clipboard access, or output file write.
DryRun exit code: 0
Output file exists: False
```

DryRun 在任何剪贴板读取、截图启动或图片写入之前退出，仅验证脚本参数与 Forms/Drawing 加载。**没有安装到 Liu 的 DSH，没有做真实截图或修改剪贴板。** jsdom 的 DataTransfer、fetch、输入 store 和文件 intake 是替身，不能证明 Electron 的真实 DataTransfer/文件 intake、CORS/本地网络策略、toast 布局、焦点、Windows 截图 URI、剪贴板锁竞争或 GitHub 安装流程通过；也未测其他 DSH 版本、系统、远程 Host 或脚本被安全软件拦截的情况。

本次 `npm audit --omit=dev` 报 0 项；包含 rc.5 开发依赖的全量 audit 报 **37 high**，来自 zod 公告及其依赖传播。未为消除审计数量升级官方 rc.5 依赖树，也未执行 `audit fix --force`；这不是对宿主 DSH 的安全审计。

## 安装后的手工验收（尚未执行）

1. 确认 DSH 版本为 0.2.1-rc.5，工具栏相机存在；输入含文字/已有图片时点击，框选后应保留文字和原附件，新增 PNG 预览且没有发送。
2. 再次截图，检查新图内容；超出 DSH 图片数量/大小限制时应有宿主拒绝提示，并显示 Ctrl+V fallback，不能误报成功。
3. Esc 取消，等待至 120 秒；应无旧图加入。截图等待期间切换会话，不能把图加到新会话。重复点击不能起多个捕获进程。
4. 检查剪贴板权限/忙碌、临时目录不可写、PowerShell 被拦截和 DataTransfer 不可用时的提示。完成截图后可手工 Ctrl+V 补入。
5. 插件卸载/禁用或正常退出后检查本机端口关闭、临时文件清理。查看 `%TEMP%\dsh-screenshot.log` 排查失败，日志不应含截图或取图 URL。

MIT，见 LICENSE。
