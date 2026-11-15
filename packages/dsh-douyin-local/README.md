# 抖音本机数据

在 DeepSeek Harness 中查看本机工具获取的抖音热榜、搜索指数和评论摘要，方便继续整理话题。

- 少切换页面：用 `/douyin-hotlist` 查看本机工具获取的榜单、热度和采集时间。
- 方便继续分析：也可让 DSH 在你要求时调用热榜工具。
- 按需更新和回看：热榜查询失败不自动重试，七天搜索指数缓存无需再次联网。
- 查看本机评论摘要：凭运行编号打开已生成的摘要，省去手动寻找文件。

示意输出：

```text
/douyin-hotlist
抖音热榜｜采集时间：2026-01-01T12:00:00+08:00
1. 示例话题（热度：123）
```

## 三步上手

1. **完全退出桌面 DSH。** 关闭所有窗口，并从系统托盘退出。
2. **安装插件。** 以下地址在此插件合并到仓库 `main` 后才可使用：

   ```powershell
   dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-douyin-local"
   ```

   在合并前需要试用开发版，可使用开发分支地址：

   ```powershell
   dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#codex-dsh-douyin-20261114&path:/packages/dsh-douyin-local"
   ```

3. **重新打开 DSH 并配置。** 在插件设置中将 `projectPath` 填为本机 `douyin-index-local` 项目的绝对路径；该项目需要 Python 3.12 虚拟环境和 `requirements-core.txt`。开发版需配套使用该项目的 `codex-local-portability-20261114` 分支。运行 `/douyin-hotlist` 查看结果，也可要求 DSH 查询抖音热榜。

## 补充说明

热榜会联网查询。`/douyin-open` 启动本机搜索指数窗口进程，需用户在窗口中自行登录和采集；进程启动不代表窗口或登录成功。`/douyin-index-cache 关键词 YYYY-MM-DD` 仅读取同一个关键词、同一个截止日、最近 24 小时内完整的七天缓存；先在桌面工具以**单个关键词**采集。没有匹配缓存时不会自动联网。搜索指数不是实际搜索次数。

`/douyin-comments 运行编号` 读取本机 `~/dyc-output/运行编号/summary.md`；也可以明确要求 DSH 读取指定编号的评论摘要。此操作会将评论摘要显示在 DSH 会话中，请仅在愿意向会话及模型提供这些评论时使用。目录和文件必须符合本机私有权限检查；Windows 读取摘要还需安装本地项目的评论工具依赖，Windows 本地评论采集目前仅提供实验性命令行入口，真实取数尚未验证。它不发起评论采集，也不读取完整 CSV。在线搜索指数、插件内评论采集、定时采集和自动发布尚未接入。

插件不读取登录 Cookie，在本机运行项目目录下 `.venv` 中的 Python 和 `local_cli.py`，请仅配置你信任的项目目录。

插件声明支持 DSH `>=0.2.1-rc.5 <0.3.0-0`。macOS 已在隔离的 DSH 0.2.2-rc.1 环境安装并启动宿主，插件代码已实测获取热榜、读取指数缓存和评论摘要；宿主中的完整命令交互仍待验证。Windows 的插件子进程已用合成数据自动测试，桌面宿主及真实取数仍待验证。
