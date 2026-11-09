# GitHub 推送方法

本仓库目标为 `https://github.com/hzopc1031/dsh-plugins`，默认分支为 `main`。

HTTPS 的 Git Credential Manager（GCM）当前认证为 `lurnagao-dahua`，向 `hzopc1031` 仓库推送会遇到 403（Permission denied）。使用 HTTPS fetch 和 SSH push：

```powershell
git remote add origin https://github.com/hzopc1031/dsh-plugins.git
git remote set-url --push origin git@github.com:hzopc1031/dsh-plugins.git
git push -u origin main
```

如果 origin 已存在，先核对，再按任务要求移除并重新添加。现有 SSH 配置使用 `id_ed25519_gh2`，将 `github.com` 映射到 `ssh.github.com:443`，并启用 `IdentitiesOnly yes`。推送不需要 gh CLI。成功先例是 2026-11-08 的 DSH-Go SSH pushurl 推送。

本仓库父目录下的 `_private\gh-token.txt` 中的 fine-grained PAT 认证账号为 `hzopc1031`，但没有创建仓库的权限：`POST /user/repos` 已返回 `403 Resource not accessible by personal access token`。不要使用该 token 创建仓库。

`hzopc1031` 名下的新公开空仓库通过共享电脑浏览器创建，浏览器须登录为 `hzopc1031`；不要自动初始化 README、license 或 gitignore。本仓库已通过该浏览器创建于 `https://github.com/hzopc1031/dsh-plugins`，可直接使用上述 SSH pushurl 推送。

仅在 Liu 明确授权后，为 topics API 调用读取上述 token 到 `$token`，使用 `Invoke-RestMethod` 调用 `PUT https://api.github.com/repos/hzopc1031/dsh-plugins/topics`，请求体为 `{"names":["dsh-plugin","deepseek-harness"]}`；使用 `Authorization = ('Bearer ' + $token)` 和 `Accept: application/vnd.github+json` 请求头。若返回 403，记录并跳过，不阻塞发布。本次发布的 topics 请求返回 HTTP 403，已跳过。

绝不输出、记录或提交 token 值，调用完成后清除 `$token` 和请求头。不得读取其他 `_private` 文件、触碰 `_tools`、借用其他账号凭据或将任何 token、密码、私钥写入仓库。SSH 推送认证不能代替 REST API 认证。

推送保持上述 HTTPS fetch + SSH pushurl 配置，并确认 `git rev-parse HEAD` 与 `git rev-parse origin/main` 一致。密钥扫描为可选检查；扫描命令失败不得阻塞发布。不得提交任何凭据。不执行 npm publish，不向 awesome-dsh-plugin 开 PR，不修改 DSH 全局配置。
