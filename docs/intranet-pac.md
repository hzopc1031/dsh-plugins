# Windows PAC、官方重定向与超时范围

仅三个插件直接由 Node 请求公网，新增同样的 `intranet-http.ts` / `system-proxy.ts`；`scripts/check-compat.mjs` 同时核对这两组文件逐字节一致。其余包未改代码或版本。HTML 导出的可选浏览器联网单列，避免把它误称为完全本地。

| 包 | 需要新增插件 PAC | 依据及本次改动 |
| --- | --- | --- |
| dsh-advisory-impact | 是 | Node 请求 Apache 官方公告、GitHub raw XML、OSV；新增系统 PAC / 静态代理、检测命令、白名单重定向和 30 秒可调超时。 |
| dsh-apache-radar | 是 | Node 请求 Apache 清单、JIRA、cwiki、公告和 OSV；共享 PAC、检测/应用/清空界面、安全重定向、新 cwiki 地址、30 秒可调超时。 |
| dsh-content-evidence | 否 | 保存用户提供的本地材料、草稿和导出；URL 是证据文本，不会抓取；不改。 |
| dsh-dll-doctor | 否 | Windows 本地 PE / DLL / 进程检查；不改。 |
| dsh-draft-rescue | 否 | 本地输入草稿及宿主状态保存/恢复；不改。 |
| dsh-file-holder | 否 | Windows 本地进程与文件占用查询；不改。 |
| dsh-file-ref-copy | 否 | 宿主已完成消息内的本地路径、引用和剪贴板；不改。 |
| dsh-github-triage | 是 | Node 固定 api.github.com 请求；共享 PAC、页面/命令检测与诊断、30 秒可调超时；带令牌 API 继续禁止重定向。模型调用使用宿主已有模型服务，插件不替换其网络层。 |
| dsh-heartbeat-monitor | 否 | 宿主会话运行状态和本机通知，不请求远程 HTTP；不改。 |
| dsh-html-deck-export | 否（已有浏览器路径） | 默认拒绝网络；显式 allowNetwork:true 时独立 Chromium 可加载 HTTP(S) 图片/字体等 GET/HEAD 资源，主文档仍为本地文件。保留 Chromium 原生 Windows 系统代理/PAC 行为，不加入 Node dispatcher 或检测设置；未实测 Windows。 |
| dsh-instruction-conflicts | 否 | 本地指令文件盘点与冲突分析；不改。 |
| dsh-invoice-gate | 否 | 本地发票文件读取、校验及导出；不改。 |
| dsh-permission-doctor | 否 | 宿主权限配置、路径和能力诊断；不改。 |
| dsh-plugin-combo-lab | 否 | 本地协作练习、计划与状态存储；不改。 |
| dsh-snip-attach | 否 | 仅 dsh-app://app 桌面允许截图；shotUrl 严格匹配 http://127.0.0.1:<port>/shot/<UUID>，为本机截图服务器；不改。 |
| dsh-source-impact | 否 | 本地源码、Git 快照与影响分析；不改。 |
| dsh-task-review | 否 | 本地任务、检查及会话状态，不请求外部源；不改。 |

Chromium 系统代理机制见[官方代理说明](https://chromium.googlesource.com/chromium/src/+/main/net/docs/proxy.md)。本次未给 HTML 导出新增联网权限，也未改变其截图等待超时。

## 检测与不影响原访问的边界

1. 先检查插件 httpsProxy 与环境 HTTPS_PROXY / HTTP_PROXY / ALL_PROXY（大小写均识别，小写优先的既有规则保持）；任一配置存在就完全跳过系统检测。绕过列表、TLS / CA、自有或宿主 dispatcher 路径保持。
2. systemProxy 默认 auto；off 跳过。非 Windows 无系统代理。Windows 通过 execFile 无 shell、2 秒 timeout 读取 HKCU Internet Settings 的 AutoConfigURL / ProxyEnable / ProxyServer / ProxyOverride；ProxyEnable=0 也识别 PAC。未暴露给插件的 Electron API 不作为接口使用：rc.1 仅查到内部环境代理策略实现，没有公开系统 resolveProxy 服务。
3. AutoConfigURL 仅 HTTP(S)、无 userinfo；使用原生 http(s).request DIRECT 获取，3 秒 / 1 MiB，不跟随重定向、不附加凭据。不支持 file://，诊断提示失败并保留原访问路径。
4. 每个 URL 的目标 IPv4 在 vm 外异步预解析（1 秒），只把序列化字符串/数字/null 交给新上下文。上下文内部实现 12 个 Netscape 函数；其他域名的 DNS 返回 null / false；myIpAddress 取非内部 IPv4 或回退 127.0.0.1。1 MiB 限制约束编译输入；顶层运行和 FindProxyForURL（含输出 String 转换）各有 1 秒 vm timeout，禁字符串动态代码与 wasm。
5. 按列表顺序选第一个可用 PROXY / HTTP / HTTPS 或 DIRECT；跳过 SOCKS*，仅 SOCKS 时明确中文提示不支持并回原路径。系统静态代理支持 http= / https= 映射、ProxyOverride 通配符和 <local>。
6. 未检测到、DIRECT、读取/获取/解析失败都使用原 fetch options / 原 dispatcher，不创建新 agent；仅 PAC / 系统代理命中的 URL 使用新 dispatcher，重定向每跳重新判断。自动代理连接抛错时尝试原路径，显式代理失败不自动重试。重试仍遵守原 signal 的总时限，不绕过用户取消或延长预算。
7. 设置与脚本进程内缓存 30 分钟，逐请求目标求值；重检清缓存。公告已有独立缓存目录，另外保存至多 64 KiB 的脱敏设置缓存，静态无凭据设置可复用；脚本只存内存，不把潜在 PAC 内的凭据写盘。雷达仅有项目缓存文件、GitHub 只有宿主 storageDomain，未创建额外缓存目录。展示/磁盘代理 URL 无 userinfo，PAC URL 省略 query/fragment。雷达应用按钮通过宿主 configEditor 编辑当前插件条目，保留其他设置；自动使用仅在内存，不写环境。

PAC 是网络提供的代码。**Node vm 不是对抗蓄意攻击者的安全边界**；不传宿主对象/函数、禁动态生成、限大小/时间与输出转字符串只是缓解。请只使用可信系统 PAC。真实 Windows 注册表、公司 PAC / 代理认证与 Windows Desktop 未实测；注册表逻辑使用模拟值单元测试，宿主界面只在 Linux 回放。

## 来源与重定向

雷达原有主机集保持：projects.apache.org、whimsy.apache.org、attic.apache.org、incubator.apache.org、kafka.apache.org、svn.apache.org、issues.apache.org、cwiki.apache.org、release-catalog.apache.org、www.apache.org、apache.org；同时保留已经允许的公告来源主机 hadoop.apache.org、flink.apache.org、security.apache.org、raw.githubusercontent.com 和 api.osv.dev。不放宽为任意 *.apache.org。reporter.apache.org 仍禁止。

公告来源跳转仅允许原 SOURCES 的 kafka.apache.org、hadoop.apache.org、security.apache.org、flink.apache.org、raw.githubusercontent.com；OSV 独立路径仅 api.osv.dev。初始地址仍为既有精确来源/OSV id 校验。GitHub 令牌 API 固定 api.github.com，继续 redirect:error；诊断 HEAD 可保留该选项。

匿名官方来源手动跟随最多 5 次 301/302/303/307/308，逐跳校验 HTTPS、固定主机集、无 userinfo、无非默认端口、非 IP，拒绝循环和超限。错误为 REDIRECT_BLOCKED / REDIRECT_LOOP / REDIRECT_LIMIT，并附中文说明。原地址仍用于响应身份和缓存，不因跳转改变解析器的原文域名边界。

KIP 改为 https://cwiki.apache.org/confluence/spaces/KAFKA/pages/50859233/Kafka+Improvement+Proposals；FLIP 改为 https://cwiki.apache.org/confluence/spaces/FLINK/pages/65145551/Flink+Improvement+Proposals。2026-11-12 Linux curl -I 确认旧地址均 302、新地址均 200；全量 GET 均 200，解析得到 KIP 1176 / FLIP 104 条（无日期仍作为参考，不计本周新增）。新裁剪夹具记录 URL、实际抓取时间、原始/裁剪 SHA-256；历史夹具的来源信息保留。全部官方 URL 的状态与时间见本次外部验收汇总及 url-head-results.json；OSV 对 HEAD 返回 405，不是业务 GET/POST 失败。

默认请求时限统一为 **30 000 ms**；timeoutSeconds 的有限数值限制 10–120 秒，其他输入用 30 秒，诊断显示有效值。未改变模型服务超时或本地截图超时。

## 弱证书密钥与 TLS 跳过范围

出现 `CA certificate key too weak`、`CA_KEY_TOO_SMALL` 或 OpenSSL 校验错误 67，表示证书密钥强度不足，与「证书不受信任」不同；OpenSSL 3 的默认安全级别通常要求 RSA 密钥至少 2048 位，报错本身不代表已测得实际位数。`caBundlePath` / `NODE_EXTRA_CA_CERTS` 只能补充信任，不能修复弱密钥。可在插件管理中打开目标插件条目的「配置」，开启「不安全：仅跳过 OSV / GitHub API 证书校验」（`insecureSkipTlsVerifyHosts`，默认 `false`），仅对精确主机 `api.osv.dev` / `api.github.com` 跳过校验；Apache、npm、其他主机、PAC 获取和 HTTPS 代理自身仍校验。跳过会失去目标证书身份保护，请仅在接受风险时开启；优先让网络管理员更新拦截证书。原有 `insecureSkipTlsVerify` 默认也为 `false`，开启会跳过该网络客户端所有目标和 HTTPS 代理的证书校验，范围更大。

CONNECT 后的目标 TLS 与 HTTPS 代理自身的 TLS 分开配置；按主机开关只影响前者。每次跳转重新按目标主机选择校验策略，子域名和相似域名不会命中。更多错误提示与诊断字段见[内网配置](intranet-network.md#证书密钥太短)。
