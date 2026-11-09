# GitHub 推送方法

本仓库目标为 `https://github.com/hzopc1031/dsh-plugins`，默认分支为 `main`。

HTTPS 的 Git Credential Manager（GCM）当前认证为 `lurnagao-dahua`，向 `hzopc1031` 仓库推送会遇到 403（Permission denied）。使用 HTTPS fetch 和 SSH push：

```powershell
git remote add origin https://github.com/hzopc1031/dsh-plugins.git
git remote set-url --push origin git@github.com:hzopc1031/dsh-plugins.git
git push -u origin main
```

如果 origin 已存在，先核对，再按任务要求移除并重新添加。现有 SSH 配置使用 `id_ed25519_gh2`，将 `github.com` 映射到 `ssh.github.com:443`，并启用 `IdentitiesOnly yes`。推送不需要 gh CLI。成功先例是 2026-11-08 的 DSH-Go SSH pushurl 推送。

创建仓库和设置 topics 使用 GitHub REST API，以 `hzopc1031` 认证的 API token 调用；SSH 推送认证不能代替 REST API 认证。仅在 Liu 明确授权后，从本仓库父目录下的 `_private\gh-token.txt` 读取到 `$token`，使用 `('Bearer ' + $token)` 构造 Authorization 请求头，并设置 `Accept: application/vnd.github+json`。先 GET `https://api.github.com/user` 确认登录为 `hzopc1031`。绝不输出、记录或提交 token 值，调用完成后清除 `$token` 和请求头。不得读取其他 `_private` 文件、触碰 `_tools`、借用其他账号凭据或将任何 token、密码、私钥写入仓库。

首次发布时，先公开 GET `https://api.github.com/repos/hzopc1031/dsh-plugins`。若已存在则核对 owner 为 `hzopc1031` 且 html_url 为 `https://github.com/hzopc1031/dsh-plugins`；404 时 POST `https://api.github.com/user/repos`，请求体为 `{"name":"dsh-plugins","description":"DeepSeek Harness (DSH) plugins by hzopc1031.","private":false,"auto_init":false}`。不要自动初始化 README、license 或 gitignore。若 API 返回权限错误，记录具体状态和 GitHub 错误消息，不输出凭据；不尝试推送到不存在的仓库。

推送后，PUT `https://api.github.com/repos/hzopc1031/dsh-plugins/topics`，请求体为 `{"names":["dsh-plugin","deepseek-harness"]}`，将 topics 替换为这两个值。推送保持上述 HTTPS fetch + SSH pushurl 配置，并确认 `git rev-parse HEAD` 与 `git rev-parse origin/main` 一致。密钥扫描为可选检查；扫描命令失败不得阻塞创建仓库或推送。不得提交任何凭据。不执行 npm publish，不向 awesome-dsh-plugin 开 PR，不修改 DSH 全局配置。
