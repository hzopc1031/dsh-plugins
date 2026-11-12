# 公司内网访问与离线快照

Apache 雷达、官方公告影响核对和 GitHub 研判会显示网络错误代码及中文排查提示，帮助区分代理、DNS、连接和公司证书问题。雷达与公告面板把相同原因合并显示，保留失败来源数量；失败不等于没有公告或动态。

## Windows 公司电脑怎么配置

1. **先用系统检测。** 大公司常用 PAC 为不同网站分配代理。无显式代理时，三个 Node 联网插件默认读取当前用户 Windows 系统 PAC / 静态代理；雷达点击「从系统检测代理」，公告运行 `/advisory-impact detect-proxy`，GitHub 页面点击同名按钮或运行 `/triage-detect-proxy`。PAC / 系统代理缓存 30 分钟，重新检测可清缓存。雷达只有点击「应用到插件设置」才保存到已有 `httpsProxy`，清空恢复自动；不自动改 `.env` 或进程环境。无系统代理、DIRECT 或读取/获取/求值失败沿用原路径，显式代理配置始终优先且不会运行检测；`systemProxy: "off"` 关闭功能。仅支持无凭据 HTTP(S) PAC URL，不支持 file:// 或 SOCKS（会给出中文诊断并沿用原路径）。如果需要手动配置，再检查「设置 → 网络和 Internet → 代理」或 `netsh winhttp show proxy`，注意 WinHTTP 与用户代理可能不同。
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

三个 Node 联网插件各自提供以下设置；没有系统代理、PAC 返回 DIRECT 或关闭系统检测时沿用宿主网络策略。

| 配置键 | 用途 |
| --- | --- |
| `systemProxy` | 默认 `auto`，无显式代理时读取 Windows 系统 PAC / 静态代理；`off` 关闭。 |
| `timeoutSeconds` | 默认 30 秒，限制 10–120；非数值或非有限值回到默认。诊断展示有效值。 |
| `httpsProxy` | 可选 HTTP 代理 URL，形如 `http://host:port`，用于 HTTPS 请求；遵守绕过列表。 |
| `noProxy` | 可选绕过列表，逗号或空白分隔，支持域名后缀、可选端口及 `*`；显式空字符串清空环境中的绕过规则，回环仍直连。 |
| `caBundlePath` | 公司根证书 PEM 的绝对路径；与 Node 内置根证书、`NODE_EXTRA_CA_CERTS` 合并。 |
| `insecureSkipTlsVerify` | 默认 `false`。**不安全 / insecure**：跳过 TLS 验证。 |
| `offlineOnly` | 雷达及公告插件提供，默认 `false`；开启后刷新也只使用缓存/快照，不发起来源 HTTP。 |

没有系统代理（或 PAC DIRECT / 检测失败 / systemProxy off）且没有插件覆盖或代理 / CA 环境变量时直接使用 `globalThis.fetch`，沿用 DSH 已安装的代理 dispatcher。有插件覆盖或代理 / CA 环境变量时，插件按请求使用自己的 undici dispatcher，并在卸载时关闭；不会调用 `setGlobalDispatcher`。构造自己的 dispatcher 时仍遵守 `http_proxy` / `https_proxy` / `no_proxy` / `all_proxy`（小写优先、大写回退），插件对应设置优先，且读取 `NODE_EXTRA_CA_CERTS`。HTTPS 请求依次检查 `HTTPS_PROXY`、`HTTP_PROXY`、`ALL_PROXY`，保留原 GitHub 客户端仅设 `HTTP_PROXY` 时的回退行为。DSH 0.2.2-rc.1 将用户 `.env` 中解析出的代理策略发布到进程环境，因而 CA 覆盖仍能保留该代理。回环地址始终绕过代理。

## 诊断与快照入口

雷达：点击「从系统检测代理」查看来源、脱敏 PAC URL、Apache 示例代理、时间及 TTL；「重新检测」清缓存；仅点击「应用到插件设置」或「清空插件代理」才修改本插件设置。选择项目目录后点击「网络诊断」，检查一个官方 URL（默认 chooser.json）的 DNS、TCP、TLS 授权/错误代码及代理来源。代理只显示变量名或 `plugin setting`，不会显示带凭据的地址。使用代理时 DNS/TCP 检查代理端，TLS 通过代理请求目标；直连时检查目标本身。直接探测与 fetch 被拦截可能产生不同结果，不能据此推断所有来源都可达。

雷达「导出快照」下载 JSON；在另一台机器点击「导入快照」选择该文件。只接收 JSON 内容，复用缓存 URL、时间、状态和大小校验；不接收任意目标路径。最多 32 MiB，总体保留原始来源时间。数据写入所选项目已有的 `.apache-radar-feed-cache.json`，会替换快照中同 URL 的缓存，未包含的缓存保留。开启 `offlineOnly` 后也可查看概览、动态和生成周报。

公告插件在项目会话运行：

```text
/advisory-impact detect-proxy
/advisory-impact redetect-proxy
/advisory-impact diagnose
/advisory-impact snapshot-export
/advisory-impact snapshot-import
```

导出把官方来源缓存写到当前项目固定文件 `.advisory-impact-snapshot.json`；拷贝文件到目标项目同名位置，再运行导入命令。导入校验全部条目后写入插件缓存，以「本地快照」标记；同请求缓存被替换，其余保留。官方快照不包含 OSV 的独立缓存；离线缺失的第二来源仍显示不可用，不能当成无漏洞。GitHub 研判继续使用其既有本地状态，不增加 Apache 快照入口。

## 验证边界与依据

本次在 Linux 的 DSH **0.2.2-rc.1** 实际加载并回放故障；本地 CONNECT 代理 + 自签名 HTTPS 服务验证自定义 CA、缺失 CA 的具名 TLS 错误、代理环境变量及绕过规则。Windows Desktop / Electron 的代理继承、证书部署、剪贴板和截图尚未实机验证。见[兼容矩阵](compat-matrix.md)。

宿主行为以官方 `dsh-v0.2.2-rc.1` / `66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db` 为准：[网络代理指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.2-rc.1/docs/user/guide/network-proxy.zh.md)、[HTTP proxy 实现](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.2.2-rc.1/packages/util/http-proxy)。这些说明没有把 Windows/macOS 系统代理或 PAC 解析当成已支持能力。


## PAC 求值与验证边界

系统注册表读取以当前用户 HKCU 为范围，使用无 shell、2 秒限制的 reg.exe。AutoConfigURL 即使 ProxyEnable=0 也会识别；静态代理处理协议映射和 ProxyOverride / <local>。非 Windows 不读取系统设置，不实现 WPAD。PAC 通过原生 HTTP(S) DIRECT 获取，不附加登录凭据、不跟随跳转，最多 1 MiB / 3 秒。每次目标求值使用全新 vm 上下文，运行及 FindProxyForURL / 字符串转换各限制 1 秒，禁止动态字符串代码和 wasm；只提供序列化原始值与上下文内的 Netscape 函数，不传入宿主函数/对象。DNS 仅异步预解析请求目标 IPv4（1 秒），同步函数只使用该答案，其他域名返回 null / false；myIpAddress 为本机非内部 IPv4 或 127.0.0.1。

PAC 是公司网络提供的代码，vm **不是对抗蓄意攻击者的安全边界**。大小限制约束编译输入，vm timeout 约束顶层运行及调用/输出转换，以上措施仅降低风险。返回值只解释 PROXY / HTTP / HTTPS / DIRECT / SOCKS* 列表，按序选第一个可用 HTTP(S) 代理或 DIRECT；SOCKS-only 显示不支持并回到原路径。代理凭据不进入展示或磁盘代理 URL；PAC URL 展示/缓存省略 userinfo、query 和 fragment。脚本只缓存于内存；已有独立缓存目录的公告插件保存小型脱敏设置缓存，带凭据的设置不复用于磁盘缓存。

注册表、PAC 和安全边界用模拟单元测试验证，实际界面采用 Linux DSH 0.2.2-rc.1 回放。未验证真实 Windows 注册表、公司 PAC、企业认证代理或 Windows Desktop。宿主 rc.1 未公开给插件系统 resolveProxy API，本次使用插件侧实现。更多盘点与重定向白名单见 [PAC 范围矩阵](intranet-pac.md)。
