# 第二阶段：让团队成员安装便利（交给 Codex）

背景：插件第一版已完成（提交 7887914），见 docs/handoff.md。Liu 马上要分享给团队很多人，要求安装便利、装上就能用。约定同 docs/00-task.md（禁令全部继续有效：不读 ..\_private、不改主 DSH 配置、不装进主 DSH、不建 GitHub 仓库、不 push、不 npm publish）。git 提交如果因沙箱失败，留给 Liu 处理，不要绕过。

## 要做的事
1. **版本兼容**：`engines.dsh` 不能写死 0.2.1-rc.5。在本机 0.2.1-rc.5 和 npm 上最新的 `@deepseek-ai/dsh` 0.2.2-rc.1（在 .tmp 下临时安装，不全局装、不升级用户的 DSH）都跑通 typecheck / test / test:profile，然后把 engines.dsh 和 peerDependencies 放宽为实测通过的范围（如 `>=0.2.1-rc.5 <0.3.0`），不能放宽到没测过的大版本。若 0.2.2-rc.1 有 API 变化，做兼容处理并写进文档。
2. **依赖精简**：逐个确认 10 个 `@deepseek-ai/*` peer 依赖是否随 DSH 宿主自带（查本机 DSH 安装目录）。宿主自带的保留为 peer；不必要的删掉；可选能力（如 workspace-changes）在宿主缺失时自动降级而不报错，并加测试覆盖。目标：用户安装时不需要额外下载任何 @deepseek-ai 包，也不触发构建。
3. **成品打包**：npm 包内含编译好的 lib/，无 prepare/install/postinstall；`npm pack` 后检查文件清单完整（patch、locale、icon、lib、README、LICENSE）且不含测试和 docs/00-task 之类内部文件。package.json 补 repository/homepage/bugs 占位（用 `TODO-GITHUB-OWNER` 占位并在 handoff 列出待填），author 留空待 Liu 填，private 不能为 true。
4. **干净安装模拟**：在临时 DSH profile（如 `task-review-clean`，DSH_HOME 指向 .tmp 下的临时目录，绝不碰 D:\AIInfra\DSHarness）里，用 `dsh plugin --profile ... add <tgz 路径>` 按团队成员的方式安装，`--dump-config` 确认插件加载、元数据（标题/描述/图标）正确，再卸载确认干净。如果 CLI 安装在沙箱里做不了，写清楚原因和 Liu 手动验证的命令。
5. **README 面向团队成员重写**（中文为主，附英文简版）：一句话介绍；安装（一条命令，tgz 方式和以后 npm 方式）；装完怎么确认生效；自动复盘何时触发、`/review` 用法、报告存在哪里、配置项表；隐私与权限声明（只读、不联网、不上传、参数脱敏）；卸载；支持的 DSH 版本与平台；常见问题（装不上、看不到卡片怎么办）。截图位置先留占位并在 handoff 列出。
6. 加 CHANGELOG.md，版本升到 0.1.1（或按改动合理定）。
7. 更新 docs/handoff.md：做了什么、两个 DSH 版本的测试结果、干净安装结果、还没测的（macOS/Linux、Web 界面目视）、待 Liu 决定/填写的事项。

## 最后输出
中文汇报：改动清单、两个 DSH 版本的测试命令与结果、最终 engines 范围、保留的依赖及理由、干净安装结果、产出的 tgz 路径、未完成项。