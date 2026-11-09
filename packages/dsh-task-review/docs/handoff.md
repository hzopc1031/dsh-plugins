# 交接：dsh-task-review 0.1.1（第二阶段）

日期：2026-11-09。第二阶段实现及 Windows 验收完成。基础提交为 `7887914`；本轮 `git add` 因 `.git/index.lock: Permission denied` 失败，未绕过沙箱，待 Liu 本地提交。没有创建远端、push、npm publish，没有升级或安装进用户主 DSH，没有读取 _private、edge-cookies 或账户凭据。

## 本轮改动

- 升级 0.1.1，新增 CHANGELOG；npm files 白名单只含 15 个分发文件，预编译 lib，无 prepare/install/postinstall，无 dependencies，无内部 docs、src、test、scripts。
- engines.dsh 和 DSH peers 改为 `>=0.2.1-rc.5 <0.3.0`。Cordis `>=4.0.5 <4.2.0`，Schemastery `>=3.18.5 <3.20.0`。范围内其他版本未逐一测试，不声明 0.3 或其他大版本兼容。
- 10 个原 peer 全部确认随本机宿主自带；保留 7 个，去掉 3 个只用于开发验证的 peer（devDependencies 仍保留）。全部分发 peer 标 optional，防止 npm/pnpm 自动下载另一套宿主实例；这不代表运行时可以缺少 commands/tools/sessions。必需服务仍由 inject 声明，DSH 的 profile resolver 提供包。
- 新增 workspaceChanges 缺失时的集成测试：存在 workspace/changes 历史但服务缺失，仍能观察工具、自动复盘并存档，无异常。该包仅 type import，编译运行时没有静态导入，可缺包降级。
- 修复 locale/en.json、zh.json 的 UTF-8 BOM：真实安装后的官方元数据读取曾报 JSON 解析错误，移除 BOM 后两个版本读取均通过。
- 团队 README 改为中文为主、英文简版，含 tgz/未来 npm 一条命令、验证、触发、配置表、权限隐私、卸载、版本平台及 FAQ；截图留占位。
- 新增 prepare-compat、tool-fixture、verify-installed、verify-pack 脚本；扩展原 profile 冒烟。安装缓存 .pnpm-store/ 已忽略。

## 双版本验证

Windows，Node v24.20.0，TypeScript 5.9.3。npm view 确认 latest/next 为 0.2.2-rc.1。新版仅安装在本工作区 `.tmp/dsh-0.2.2`，带 `--ignore-scripts`，没有全局安装或用户 DSH 升级。

```powershell
npm view @deepseek-ai/dsh dist-tags version --json --cache .tmp/npm-cache
npm install --prefix .tmp/dsh-0.2.2 --ignore-scripts --no-audit --no-fund --cache .tmp/npm-cache @deepseek-ai/dsh@0.2.2-rc.1 typescript@5.9.3 @types/node@22

node scripts/prepare-compat.mjs D:/AIInfra/dsh-app/node_modules
npm --prefix .tmp/compat-0.2.1-rc.5 run typecheck
npm --prefix .tmp/compat-0.2.1-rc.5 test
npm --prefix .tmp/compat-0.2.1-rc.5 run test:profile

node scripts/prepare-compat.mjs .tmp/dsh-0.2.2/node_modules
npm --prefix .tmp/compat-0.2.2-rc.1 run typecheck
npm --prefix .tmp/compat-0.2.2-rc.1 test
npm --prefix .tmp/compat-0.2.2-rc.1 run test:profile
```

prepare-compat 复制源码/测试/构建产物到独立目录，以 junction 指向指定宿主的完整 node_modules；避免仅更换 CLI 而实际测试仍使用旧依赖。各自 host-inventory.json 记录真实解析版本。

| 宿主 | typecheck | test | test:profile |
| --- | --- | --- | --- |
| 本机 0.2.1-rc.5 | PASS | 12/12 | PASS |
| 临时 npm 0.2.2-rc.1 | PASS | 12/12 | PASS |

profile 冒烟使用唯一临时 DSH_HOME、官方组合/Loader、真实工具流水线、/review 与 Markdown 断言，finally dispose 并清理。Node test 使用 --test-isolation=none；默认子进程隔离曾受环境限制。

### 新版 API 差异

0.2.2-rc.1 的 dsh-tools 从单调用 execute(input) 改为 executor 驱动的批量 execute({calls,...})，测试最初报 TOOL_EXECUTOR_UNAVAILABLE。依据新版 dsh-tools README 与 executor 类型，测试夹具检测 setExecutor，挂载宿主随附的 dsh-tool-executor-native，发送原生 tool-call 批次并取单项结果。旧版仍走单调用。不吞掉缺包错误，不把新 executor 加进插件的分发依赖。插件只观察 tools/pre-execute/result，事件与会话/命令 API 两版兼容，无需改运行代码。

## 10 个依赖的逐项核对

下表路径均为 `D:/AIInfra/dsh-app/node_modules/@deepseek-ai/<包名>/package.json`；新版对应 `.tmp/dsh-0.2.2/node_modules/@deepseek-ai/`。

| 包 | 本机版本 | 新版宿主版本 | 分发处理与原因 |
| --- | --- | --- | --- |
| cordis | 4.0.5 | 4.1.0 | 保留 peer：宿主 Context 类型与共享生命周期 |
| dsh-agent | 0.2.1-rc.5 | 0.2.2-rc.1 | 保留 peer：Agent/idle 事件类型 |
| dsh-commands | 同上 | 同上 | 保留 peer：命令注册与 CommandDefinitionId |
| dsh-session | 同上 | 同上 | 保留 peer：Session 与插件记录运行 API |
| dsh-tools | 同上 | 同上 | 保留 peer：工具事件/执行 token 类型 |
| dsh-workspace-changes | 同上 | 同上 | 保留可选 peer：变更服务类型，缺少自动降级 |
| schemastery | 3.18.5 | 3.19.0 | 保留 peer：运行时 Config schema |
| dsh-app-boot | 0.2.1-rc.5 | 0.2.2-rc.1 | 移出 peer：仅开发 profile 冒烟 |
| dsh-llm | 同上 | 同上 | 移出 peer：仅测试创建 fixture 消息 |
| dsh-system-prompt | 同上 | 同上 | 移出 peer：仅测试加载工具服务的前置服务 |

## 打包与干净安装

```powershell
npm run build
npm pack --ignore-scripts --cache .tmp/npm-cache --json | Set-Content -Encoding utf8 .tmp/pack-manifest.json
node scripts/verify-pack.mjs
```

PASS：15 文件，包含 patch、两个 locale、icon、index、lib 的三个 JS/三个 d.ts、README、CHANGELOG、LICENSE、package.json；不含内部文档、测试、源码或构建脚本。分发包在项目根 `dsh-task-review-0.1.1.tgz`。最终 SHA256：`1E2AAF4901BAD16B1907A598832E11A3A37EB2A45F9791736FE05E89144F2E62`。npm SHA1：`1b7f68efaa411ee764fef660c81bb24e00aad16d`。

真实 CLI 验收使用临时 pnpm 11.28.11（`.tmp/tooling`），两个版本分别采用 `.tmp/clean-final-old/home`、`.tmp/clean-final-new/home` 作为 DSH_HOME，profile 都叫 task-review-clean。DSH_HOME 从未指向 `D:/AIInfra/DSHarness`。

两个版本均完成以下流程：

1. `dsh plugin --profile task-review-clean add <最终 tgz 绝对路径>`：exit 0，Packages +1，仅插件自身；downloaded 0，无安装脚本/构建提示。
2. `dsh --profile task-review-clean --dump-config`：exit 0，含 task-review 插件行。
3. `node scripts/verify-installed.mjs <宿主 node_modules> <临时 profile 目录>`：官方 Loader 加载实际安装的 tgz；readPluginMeta 返回中英标题/描述和内嵌 SVG，无 error；/review 可执行。没有用源码 junction 代替此次成品验收。
4. `dsh plugin --profile task-review-clean remove dsh-task-review`：exit 0。断言依赖声明、bundle 选择、node_modules 包链接、卸载后的 dump 均不再包含插件。

证据保留在 `.tmp/clean-final-{old,new}/`：dump.yml、installed-lock.yaml、removed.yml，以及 profile 内的 CLI 日志。安装锁文件只有插件条目，autoInstallPeers:false，无任何额外 @deepseek-ai 包。卸载不删除 profile 本身、缓存及安装诊断日志，这是宿主正常行为。

环境问题已处理：最初缺少 pnpm，临时安装后完成；期间切换 pnpm store 导致过 UNEXPECTED_STORE，最终在全新 home 中按一致默认 store 完成。pnpm 11 本环境忽略预写的 profile .npmrc（初始化会覆盖），最终缓存位于本工作区 `.pnpm-store/`，未修改全局配置。保留缓存便于复验。

Liu 可用普通终端复验（先确保 pnpm 可用，并把包路径改为实际绝对路径；会创建独立临时 home）：

```powershell
$savedDshHome = $env:DSH_HOME
try {
  $env:DSH_HOME = Join-Path (Get-Location) '.tmp/liu-clean/home'
  dsh plugin --profile task-review-clean add (Join-Path (Get-Location) 'dsh-task-review-0.1.1.tgz')
  dsh --profile task-review-clean --dump-config
  dsh plugin --profile task-review-clean remove dsh-task-review
  dsh --profile task-review-clean --dump-config
} finally { $env:DSH_HOME = $savedDshHome }
Get-FileHash ./dsh-task-review-0.1.1.tgz -Algorithm SHA256
```

## 未验证、限制与 Liu 待办

- macOS/Linux 未测试；Web 插件行、图标和卡片未浏览器目视验证。元数据读取和官方 Loader 已通过，不等同于视觉验收。
- README 的截图占位待补：插件页；卡片折叠摘要/展开报告。
- package.json 的 repository/homepage/bugs 中 TODO-GITHUB-OWNER 待替换；author 留空待 Liu 填。未创建 GitHub 仓库、未发布 npm。
- 正式团队 profile 名称及报告目录（项目默认目录或 DSH_HOME 绝对目录）待 Liu 决定。
- 未跑真实模型/付费请求、完整 agent loop 或模型驱动 PTC；workspaceChanges 真实 git/shell 捕获未测；JSONL 跨进程恢复未测，已测 Session seed 重放。
- 自由文本秘密不能保证全识别，插件不改宿主原始日志；最终 assistant/message 之外的用量及费用不估算；文件与会话持久化非跨资源事务，崩溃窗口可能重复报告。
- Git 本轮 add 被沙箱拒绝，未生成新提交。Liu 可运行：

```powershell
git add .gitignore README.md CHANGELOG.md package.json package-lock.json locale scripts test docs/01-distribution.md docs/handoff.md docs/api.md
git commit -m "feat: prepare task review 0.1.1 for team distribution"
```
