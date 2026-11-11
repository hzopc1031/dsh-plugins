# 更新记录

## 0.2.1 (2026-11-11)

- 修复 DSH 0.2.2-rc.1 加载兼容声明；Linux 加载验证，Windows / Electron 功能未实测。


## 0.2.0 — 2026-11-10

重复命令可复用相同日志对象及 assembly 证据下的 canonical fold 结果；surface 替换、投影、正文、其他日志或 assembly 变化会使缓存失效。文件 resolve/stat 每次重读，磁盘状态不缓存。默认摘要最多 20 个来源、10 项冲突、20 段正文，每段最多 3000 字符；json/history-json 获取完整结构，history 获取完整历史正文。完整证据与冲突判断不因显示裁剪而删除。engines.dsh 与精确 rc.5 peer 对齐为 0.2.1-rc.5。

- 新版本尚未 npm publish；预构建 lib、独立 lockfile 与回归测试同步。
- 验证范围为 rc.5 运行时与 headless/jsdom；Electron 人工验收仍待执行。

## 0.1.0 — 2026-11-10

- 首版：规则正文疑似冲突、独立三种状态、注入历史版本与保留状态解释。
- 官方命令 /instruction-conflicts；支持 history 与 JSON。
- rc.5 Session Query、canonical surface fold 与只读 assembly 观察。
- TypeScript、预构建 lib、51 项测试、精确安装包校验与中文说明。

