# GitHub 推送方法

本仓库目标为 `https://github.com/hzopc1031/dsh-plugins`，默认分支为 `main`。

HTTPS 的 Git Credential Manager（GCM）当前认证为 `lurnagao-dahua`，向 `hzopc1031` 仓库推送会遇到 403（Permission denied）。使用 HTTPS fetch 和 SSH push：

```powershell
git remote add origin https://github.com/hzopc1031/dsh-plugins.git
git remote set-url --push origin git@github.com:hzopc1031/dsh-plugins.git
git push -u origin main
```

如果 origin 已存在，先核对，再按任务要求移除并重新添加。现有 SSH 配置使用 `id_ed25519_gh2`，将 `github.com` 映射到 `ssh.github.com:443`，并启用 `IdentitiesOnly yes`。推送不需要 gh CLI。成功先例是 2026-11-08 的 DSH-Go SSH pushurl 推送。

创建新仓库需要以 `hzopc1031` 认证的 API token；SSH 推送认证不能代替 REST API 认证。文档记录的位置为本仓库父目录下的 `_private\gh-token.txt`，除非 Liu 在当前会话明确授权该路径，否则代理不得读取。不得读取 `_tools`、借用其他账号凭据或将任何 token、密码、私钥写入仓库。

首次发布时，先公开 GET `https://api.github.com/repos/hzopc1031/dsh-plugins`。若已存在则跳过创建；否则，仅在具备允许使用的 hzopc1031 API 认证时创建公开空仓库，描述必须为 `DeepSeek Harness (DSH) plugins by hzopc1031.`，不要自动初始化 README、license 或 gitignore。没有允许的认证方式时，记录阻塞，不尝试推送到不存在的仓库。

topics 应通过 GitHub API PUT 替换为 `dsh-plugin` 和 `deepseek-harness`；没有允许的 hzopc1031 API 认证则记录未设置。发布前检查所有待推送历史和跟踪文件中的疑似密钥。不执行 npm publish，不向 awesome-dsh-plugin 开 PR，不修改 DSH 全局配置。
