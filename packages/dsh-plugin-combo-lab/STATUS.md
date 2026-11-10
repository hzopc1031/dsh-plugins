# 开发状态

- 包名：dsh-plugin-combo-lab
- 版本：0.1.0
- 日期：2026-11-10
- 最终目录：dsh-plugins/packages/dsh-plugin-combo-lab
- 状态：已收录在 GitHub 仓库，尚未发布 npm；可从仓库子目录安装。
- 用途：协助检查多个 DSH 插件一起安装时是否抢命令名、界面位置，或在提示词、工具拦截上互相干扰；当前每次检查两个插件，依据人工记录定位，新装或升级后可重新检查。

## 已完成

- 官方 Cordis bundle、cordis.patch.yml、命令 /combo-lab、预构建 lib/ 与完整类型声明。
- 两个不同插件与精确 SemVer，Windows 官方桌面环境约束。
- 空白、A、B、AB、BA 五轮 50 步，覆盖输入框、侧栏、会话菜单。
- 工具/命令重复、快捷键抢占、面板覆盖、配置重启持久化的操作说明与人工记录。
- 证据历史及环境、版本、启用集、顺序和重启前后值校验。
- 明确区分待桌面验证、无法自动验证、受阻、桌面人工和非桌面证据。
- 逐步缩小至单插件或最小双插件，附下一步及精确复现清单。
- 升级前后独立快照、可比条件校验和独立 comparison JSON 报告。
- 本地存档恢复、原子更新、串行写入、UUID 路径限制和大小检查。
- 中文 README、MIT、locale、原创 SVG、Windows shell verify-pack。

## 测试记录

以下命令从工作根目录执行：

1. npm.cmd view dsh-plugin-combo-lab version --registry=https://registry.npmjs.org
   - E404 / Not Found；本次检查时包名未被占用。退出码 1 为预期不存在结果。
2. npm.cmd ci --prefix dsh-plugins/packages/dsh-plugin-combo-lab --ignore-scripts --no-audit --no-fund
   - 成功，21 个开发/测试依赖；验收后清理最终目录中的依赖。
3. npm.cmd run typecheck --prefix dsh-plugins/packages/dsh-plugin-combo-lab
   - strict 类型检查通过。
4. npm.cmd test --prefix dsh-plugins/packages/dsh-plugin-combo-lab
   - 构建成功，45/45 通过，0 失败、0 跳过。
   - 包含纯核心、真实 Cordis/commands/sessions 集成、文件恢复、并发录入及对照报告保存。
5. npm.cmd run verify-pack --prefix dsh-plugins/packages/dsh-plugin-combo-lab
   - 通过，精确 15 发布文件，约 17.1 KB，无安装/构建钩子。
   - Node 24 对 shell:true 发 DEP0190 提示；参数均为脚本常量，无用户拼接。
6. npm.cmd pack ./dsh-plugins/packages/dsh-plugin-combo-lab --pack-destination ./_wip/plugin-combo --ignore-scripts --json
   - 成功，15 文件；tarball 只在 _wip。
7. node _wip/plugin-combo/smoke-packed.mjs
   - 1/1 通过：实际 tarball 预构建入口用真实 Cordis 加载、创建 50 步计划、卸载命令。
   - 使用 _wip 测试依赖，没有安装进 DSH，没有构建发布包。

## 未测及限制

- 未在真实官方 Windows DSH 桌面安装或运行；原生视觉、快捷键路由、面板覆盖、菜单渲染、完整重启后的行为均未实测。
- 所用公开命令接口不能自动验证这些行为。本版生成计划、保存人工证据；headless/static 永不成为桌面通过。
- 不自动安装、启停或卸载目标插件，不改 DSH profile 或全局配置。实际版本、启用集、配置基线由操作者核实。
- 最小集合只相对于记录的检查项、顺序及始终启用的官方必需插件和本插件成立；不能排除未声明外部因素。
- 不提供侧栏/菜单自定义 UI、跨平台或任意 N 插件缩小。
- 机器/工作区/配置标签是人工声明，不是自动获取或哈希；无法验证证据真实性。
- 不支持多个 DSH 进程共写目录；桌面崩溃时先外部记录、恢复后补录。
- 提示词与工具拦截的干扰需人工复现并记录，不会自动扫描或解释相关规则。

## 变更范围

初版开发只新增本包；本次仅调整本包介绍及根 README 对应行，没有读取禁止目录，没有接触用户 DSH 配置。
STATUS.md 保留源码，不进入发布 files；最终目录不保留 node_modules、tgz 或临时文件。