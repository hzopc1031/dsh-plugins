# 来源、版本与第三方插件适用范围

核对日期：2026-11-12。本文是本地入口的范围说明，不修改或替代上游技术规范。

## 收录内容与许可证

| 来源 | 固定提交 | 原始路径 | 本地收录 |
| --- | --- | --- | --- |
| 官方 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | `e8f7b93a344964de3dca1ace9e72b6e4d6de87cb`（master 快照） | `.agents/skills/dsh-client-ui-ux/` | 整目录，含 alignment、icons、spacing 三份 references |
| 同上 | 同上 | `.agents/skills/dsh-responsive-ui/` | 整目录 |
| 同上 | 同上 | `.agents/skills/cordis-styling-nitpicking/` | 整目录；职责是 Cordis 生命周期审查 |
| 社区 [w2112515/dsh-plugin-development](https://github.com/w2112515/dsh-plugin-development) | `4dab80cbeb86f706aa6fa9cc8269049aa809ccc9` | `skills/dsh-plugin-development/` | 整目录，含 references、agents 元数据及原有静态检查脚本；仅收录，不执行 |

官方根 [LICENSE（固定提交）](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/LICENSE) 已联网核对，并与本地副本核对一致：MIT，版权为 `Copyright (c) 2026 DeepSeek`。许可允许复制、修改和再分发，要求在副本或实质部分中保留版权及许可声明。

社区根 [LICENSE（固定提交）](https://github.com/w2112515/dsh-plugin-development/blob/4dab80cbeb86f706aa6fa9cc8269049aa809ccc9/LICENSE) 也已联网核对：MIT，版权为 `Copyright (c) 2026 dsh-plugin-development contributors`，保留声明要求相同。收录它是为了区分插件模式、核对 Client Slots 接入与验证依据，不把社区资料标成官方规范。

四个上游目录中的原有文件均逐字节保留；每个目录新增 `SOURCE.md` 记录来源，并附上游根 `LICENSE` 全文（含版权、授权条件及免责条款）。复制或再分发时一起保留。入口 `dsh-plugin-ui` 是本地编写的路由与范围说明。

## 第三方插件怎样采用官方条款

| 内容 | 对第三方插件的处理 |
| --- | --- |
| UI workflow、alignment、spacing、icons、响应式、交互、可访问性与渲染证据 | 采用原文中适用于变更的规则；按官方变更影响范围检查，不据此扩大成全产品审查 |
| primitives、主题 token、圆角、图标变体与现有控件 | 使用官方原文定位规则所有者；API、导出与可用值须核对目标版本，不把此 master 快照当作旧版 API 清单 |
| Cordis 状态归属、注册、副作用和资源释放 | 涉及插件生命周期时采用；检查实际目标版本 Cordis，实现细节和 workaround 不能跨版本照搬 |
| `packages/client/...`、`docs/...`、`vendor/cordis/...`、宿主 AGENTS | 是官方仓库中的源码/规则定位，不是第三方仓库的本地路径，也不是要求修改宿主；需要时查固定提交或目标版本原文 |
| workspace compiler aggregates、package invariants、宿主 CSS Modules/测试构建链 | 仅在官方 workspace 或第三方仓库明确采用时适用；外部插件按自己的构建与打包约定，不迁移宿主工程来满足内部条款 |
| 内部 designer/product 审批名册、GUI PR GIF、Agent Notes 与宿主提交流程 | 属于官方团队/仓库流程，不自动要求第三方请求这些内部人员审批；按目标仓库、用户要求安排审阅和提交，不能声称获得了未发生的审批 |
| 官方插件 artwork、官方页面及其他 skill 的引用 | 按职责和需要查原文，不因读取 UI skill 就获得官方身份、品牌素材许可或额外操作权限 |
| 社区 runtime/workspace/installable-bundle 三种模式 | 按真实加载/分发方式选择；外部可安装插件不因目录名叫 `packages` 变成 DSH workspace；动态 inspect/define/run 也不能套给所有插件 |

原文要求的界面验证仍适用；只有仓库内部流程不自动迁移。遇到版本事实与规范冲突，先说明冲突和证据，不能用内部条款不适用为由跳过组件复用或真实检查。

## 原文相对链接与未附带的宿主资料

收录目录不是完整 DSH checkout。原文件保持原文，相对链接中仍有宿主 `docs/`、`packages/`、其他 skill 等路径；这些未一并复制。不要把移出官方目录后碰巧存在的本地文件当作链接目标。

解析方法：先从该目录 `SOURCE.md` 取得文件的原始仓库路径，在原始位置解析相对链接（保留锚点），再加上对应仓库的 `blob/<固定完整提交>/` 前缀。例如 `dsh-client-ui-ux/SKILL.md` 中 `../../../docs/web-styling.md` 指向下表第一项。核对目标运行版本 API 时，另换成该版本经确认的 tag/commit；记录依据，不修改留存的上游快照。

| 官方规则所有者 | 固定提交原文 |
| --- | --- |
| Web styling / tokens | [docs/web-styling.md](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/docs/web-styling.md) |
| Radius / materials | [docs/ui-radius.md](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/docs/ui-radius.md) |
| Primitives catalog / controls / settings form | [packages/client/ui-primitives/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/client/ui-primitives/README.md) |
| Review cases / baseline | [docs/ui-design-review-cases.md](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/docs/ui-design-review-cases.md) |
| Comprehensive review cookbook（仅在需要时） | [docs/cookbook/reviewing-ui-design.md](https://github.com/deepseek-ai/deepseek-harness/blob/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/docs/cookbook/reviewing-ui-design.md) |

## 本机发现与副本维护

- 统一权威目录：`C:\Users\Mayn\.dsh\skills\`。每个 skill 直接位于这一层，不再套多层仓库目录。
- 已只读核对 `DSH_HOME=D:\AIInfra\DSHarness`，其 home 层 `cordis.patch.yml` 中 `skill-filesystem` 的 `dshHome` 为 `C:/Users/Mayn/.dsh`，因此扫描统一目录。新增 skill 要由 DSH 后续扫描/HMR 或重启后发现；本次不改配置、不操作运行中的 DSH。
- 已只读核对 `C:\Users\Mayn\.agents\skills` 是指向统一目录的 junction；Codex 全局 `C:\Users\Mayn\.codex\AGENTS.md` 要求先读统一目录索引。新增条目供后续 skill 发现使用，不声称当前已开始的会话会自动刷新列表。
- 仓库若在 `.agents/skills/` 保留入口与四个上游目录的副本，须逐文件保持一致，并在 `AGENTS.md` 要求以统一目录为准。副本仅供仓库内阅读；更新时人工保持一致，不创建同步脚本或第二个权威目录。没有副本时直接读取统一目录，不假定副本已存在。

只读采用记录：本仓库 `packages/dsh-github-triage/STATUS.md` 的 0.4.4 及“实际阅读的资料与采用范围”记录了上述官方/社区资料的采用与边界，可作为检索线索，不能替代官方原文。

本机历史核对样本位于 `D:\Ai Infra Tools\DeepSeek Harness\插件开发\dsh-plugins-wt-github-triage\packages\dsh-github-triage\node_modules\@deepseek-ai\dsh-client-ui-primitives\lib\types\`：已读取 `index.d.ts`、`Modal.d.ts`，可看到真实导出与 props。它只证明该已安装包的声明，不代表所有 DSH 版本都支持同样组件。

运行任何收录的第三方脚本或 npm / pip install 前须先得到 Liu 同意；阅读 skill 不授权执行这些步骤、填写凭据、操作已登录 Chrome、安装插件或修改全局配置。单纯维护本知识入口无需运行社区检查脚本。
