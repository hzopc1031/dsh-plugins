# 更新记录

## 0.2.1 - 2026-11-11

- 修正 DSH 版本声明为 `>=0.2.1-rc.5 <0.3.0-0`，采用官方包含预发布版本的校验规则，并排除 0.3.0 预发布版本。
- 放宽 DSH peer 范围，显式覆盖 rc.5 / rc.1 的标准 npm semver 安装校验；开发依赖保持原版本。
- 同步锁文件自身版本、打包断言及当前版本标识；兼容性声明不等于逐版本功能验证。

## 0.2.0 — 2026-11-10

每次 scan 内按来源复用文件 SHA-256、CSV/行解析与相同定位结果；缓存不跨 scan，plan 仍重新读取全部来源并核对 scanId。scanId 的输入与完整 JSON 明细语义保持一致。/impact check 默认最多显示 20 条状态摘要；/impact check json 查看完整引用、结论、产出和摘录。模型工具 source_impact_check 默认返回最多 20 条简要状态（含 total/affectedCount/truncated），details:true 才返回完整结构。操作使用 workingDirectory.get(session)，服务缺失时回退 header.cwd；/cd 后读取新目录的独立 registry，不移动原登记。成功的命令结果会写明使用的是当前执行目录还是回退的原始项目目录。新增 `/impact accept <scanId> [id...]`：重新核验 scanId 后原子接受已变化且可重新定位的引用基线，失败不改写原登记并保留上一版基线。会话标题栏“资料引用登记”提供登记和接受基线表单。模型工具 source_impact_check 仍只读。

- 新版本尚未 npm publish；预构建 lib、独立 lockfile 与回归测试同步。
- 验证范围为 rc.5 运行时与 headless/jsdom；Electron 人工验收仍待执行。

## 0.1.0

- 本地 Markdown / CSV 显式引用登记、版本与引用哈希比较、影响面和用户选择的重查任务。
- Cordis bundle、`/impact` 命令、只读 `source_impact_check` 工具和预构建产物。
