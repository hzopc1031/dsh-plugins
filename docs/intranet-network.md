# 公司内网访问与离线快照

Apache 雷达、官方公告影响核对和 GitHub 研判会显示网络错误代码及中文排查提示，帮助区分代理、DNS、连接和公司证书问题。雷达与公告面板把相同原因合并显示，保留失败来源数量；失败不等于没有公告或动态。

## Windows 公司电脑怎么配置

1. **找到 HTTP 代理地址。** 在 PowerShell / cmd 执行 `netsh winhttp show proxy`，也检查「设置 → 网络和 Internet → 代理」或公司代理软件。WinHTTP 与用户代理可能不同；Clash 等软件的“系统代理”开关不会自动被 DSH 的 Node fetch 读取。使用 HTTP 端口，例如 `http://127.0.0.1:7890`，不要使用 `socks5://`。不支持 SOCKS 或 PAC，不需要登录网站或打开 reporter.apache.org。
2. **优先写入用户级配置。** Start Menu / Electron 启动往往没有终端里的环境变量。在 `%USERPROFILE%\.dsh\.env`（例如 `C:\Users\<name>\.dsh\.env`）添加下面内容；自定义 `DSH_HOME` 时改用 `$DSH_HOME/.env`。不要写入项目 `.env`。已导出的环境变量优先于该文件；小写代理变量优先于大写。保存后完全退出 DSH，包括托盘，再重开。

   ```dotenv
   HTTPS_PROXY=http://127.0.0.1:7890
   HTTP_PROXY=http://127.0.0.1:7890
   NO_PROXY=localhost,127.0.0.1
   ```

3. **遇到公司 HTTPS 解密证书时，补充根证书。** 将公司提供的根证书保存为 PEM，在上述用户 `.env` 或系统环境中设置 `NODE_EXTRA_CA_CERTS=C:\certs\company-root.pem`，然后完全退出并重开 DSH。它必须在 Node 启动前生效；若桌面启动链仍未应用，使用插件设置 `caBundlePath`。不要把证书私钥、代理密码或令牌贴入日志。
4. **需要仅修改某个插件时，使用插件设置。** `httpsProxy`、`noProxy` 和 `caBundlePath` 不需要重启操作系统会话；保存后按 DSH 正常方式重新加载插件/配置。`insecureSkipTlsVerify` 只在你明确接受风险时作为最后手段开启：它会关闭 TLS 证书校验，存在中间人攻击风险。
5. **代理也无法访问 apache.org 时，传递本地快照。** 在能访问来源的机器导出 JSON，拷贝到公司电脑导入，或继续使用最后成功缓存。导入数据明确标为「本地快照」，保留原 URL 与抓取时间，不称为实时官方数据。

## 插件设置

三个联网插件各自提供以下设置；没有插件覆盖或代理 / CA 环境变量时沿用宿主网络策略。

| 配置键 | 用途 |
| --- | --- |
| `httpsProxy` | 可选 HTTP 代理 URL，形如 `http://host:port`，用于 HTTPS 请求；遵守绕过列表。 |
| `noProxy` | 可选绕过列表，逗号或空白分隔，支持域名后缀、可选端口及 `*`；显式空字符串清空环境中的绕过规则，回环仍直连。 |
| `caBundlePath` | 公司根证书 PEM 的绝对路径；与 Node 内置根证书、`NODE_EXTRA_CA_CERTS` 合并。 |
| `insecureSkipTlsVerify` | 默认 `false`。**不安全 / insecure**：跳过 TLS 验证。 |
| `offlineOnly` | 雷达及公告插件提供，默认 `false`；开启后刷新也只使用缓存/快照，不发起来源 HTTP。 |

没有插件覆盖或代理 / CA 环境变量时直接使用 `globalThis.fetch`，沿用 DSH 已安装的代理 dispatcher。有插件覆盖或代理 / CA 环境变量时，插件按请求使用自己的 undici dispatcher，并在卸载时关闭；不会调用 `setGlobalDispatcher`。构造自己的 dispatcher 时仍遵守 `http_proxy` / `https_proxy` / `no_proxy` / `all_proxy`（小写优先、大写回退），插件对应设置优先，且读取 `NODE_EXTRA_CA_CERTS`。HTTPS 请求依次检查 `HTTPS_PROXY`、`HTTP_PROXY`、`ALL_PROXY`，保留原 GitHub 客户端仅设 `HTTP_PROXY` 时的回退行为。DSH 0.2.2-rc.1 将用户 `.env` 中解析出的代理策略发布到进程环境，因而 CA 覆盖仍能保留该代理。回环地址始终绕过代理。

## 诊断与快照入口

雷达：选择项目目录后点击「网络诊断」，检查一个官方 URL（默认 chooser.json）的 DNS、TCP、TLS 授权/错误代码及代理来源。代理只显示变量名或 `plugin setting`，不会显示带凭据的地址。使用代理时 DNS/TCP 检查代理端，TLS 通过代理请求目标；直连时检查目标本身。直接探测与 fetch 被拦截可能产生不同结果，不能据此推断所有来源都可达。

雷达「导出快照」下载 JSON；在另一台机器点击「导入快照」选择该文件。只接收 JSON 内容，复用缓存 URL、时间、状态和大小校验；不接收任意目标路径。最多 32 MiB，总体保留原始来源时间。数据写入所选项目已有的 `.apache-radar-feed-cache.json`，会替换快照中同 URL 的缓存，未包含的缓存保留。开启 `offlineOnly` 后也可查看概览、动态和生成周报。

公告插件在项目会话运行：

```text
/advisory-impact diagnose
/advisory-impact snapshot-export
/advisory-impact snapshot-import
```

导出把官方来源缓存写到当前项目固定文件 `.advisory-impact-snapshot.json`；拷贝文件到目标项目同名位置，再运行导入命令。导入校验全部条目后写入插件缓存，以「本地快照」标记；同请求缓存被替换，其余保留。官方快照不包含 OSV 的独立缓存；离线缺失的第二来源仍显示不可用，不能当成无漏洞。GitHub 研判继续使用其既有本地状态，不增加 Apache 快照入口。

## 验证边界与依据

本次在 Linux 的 DSH **0.2.2-rc.1** 实际加载并回放故障；本地 CONNECT 代理 + 自签名 HTTPS 服务验证自定义 CA、缺失 CA 的具名 TLS 错误、代理环境变量及绕过规则。Windows Desktop / Electron 的代理继承、证书部署、剪贴板和截图尚未实机验证。见[兼容矩阵](compat-matrix.md)。

宿主行为以官方 `dsh-v0.2.2-rc.1` / `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db` 为准：[网络代理指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/docs/user/guide/network-proxy.zh.md)、[HTTP proxy 实现](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.1/packages/util/http-proxy)。这些说明没有把 Windows/macOS 系统代理或 PAC 解析当成已支持能力。
