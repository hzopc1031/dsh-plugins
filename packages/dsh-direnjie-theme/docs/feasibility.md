# 神探狄仁杰主题可行性

调研：2026-11-09 至 2026-11-10，目标 Windows DSH 0.2.1-rc.5。先完成调研再实施。

## 证据来源

官方仓库 https://github.com/deepseek-ai/deepseek-harness ，本次 clone HEAD `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`，存于 `.research/upstream`，以下上游行号相对此提交。

本机 `D:\AIInfra\DSHarness\profiles\node_modules\@deepseek-ai\dsh-client-ui-theme` 是失效的缓存 junction，未修改它。改为只读查看 `D:\AIInfra\DSHarness\backups\app.asar.D-20261108-121727.orig`，提取选定源码到 `.research/local-asar`。下文 ASAR 路径是该备份内部路径，行号为提取后的原文行号。`ASAR:/package.json:4` 和 `ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/package.json:4` 均为 rc.5。备份不能证明运行实例完全一致，桌面加载仍待实测。

## 能力逐项结论

| 能力 | 结论 | 文件路径和行号 |
| --- | --- | --- |
| 配色 | 可行，theme.overrideTokens 支持 light/dark 双值，返回卸载 disposer | ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js:1835；上游 packages/client/ui-theme/src/client/index.ts:388 |
| 背景图/CSS | 可行，有 client DOM/style 注入，没有独立壁纸 API；mainPanel 的模块类名后缀属内部契约，有版本风险 | ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js:1447；ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js:73；上游 packages/client/ui-layout/src/client/AppFrame.tsx:48 |
| 字体 | 可行，正文/代码/终端字体分离；只改正文 fallback，不打包字体 | ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js:524；上游 packages/client/ui-theme/README.md:34-35 |
| 面板 | 有 slots 设置项注册，亦可由 client 生命周期挂自有 DOM；本次提供可折叠音乐控件 | ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js:2022、2030 后；上游 packages/client/ui-theme/src/client/index.ts 的 apply |
| Webview | 主窗口允许 webview（webviewTag:primary），其他 guest/窗口受隔离策略限制；音频无需 webview | ASAR:/lib/main.js:11935、11960-11966（主窗口设置）、10543（guest attachment 策略）、10561（guest 的 webviewTag:false） |
| 音频 | 可用 HTMLAudioElement，无专用音乐服务 API。网页不能直接读任意磁盘路径，需 Host 精确路由或文件选择器 | ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:571（index 注入）；ASAR:/dsh/node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js:326、384（handler） |
| Bundle | patch + Host entry + locale + icon，增加 ./client export 与 dsh.client.platform:web | 本工作区 dsh-plugins/packages/dsh-task-review/cordis.patch.yml:1、package.json；ASAR:/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/package.json:20-48 |

[官方主题文档](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-theme/README.md) 第 9-10、36-40、59 行说明主题/字体/插件样式机制。master webServer 有 resource 路由，本机 rc.5 仅 handler，实现使用后者。不需要修改宿主文件。task-review 后端结构本身不足以改 UI，需 client bundle。

## 社区

直接核对 [orxz/deepseek-harness-themes](https://github.com/orxz/deepseek-harness-themes) README：已有官方 ctx.theme 上的主题集合，含 @dshthemes/core、@dshthemes/ui 与设置项。本项目不复制其素材；其当前实现不代表 rc.5 已验证。

## 歌曲核实

主题/片头曲确定为 **《长歌一曲》，腾格尔演唱**。[央视节目页](https://tv.cctv.com/2009/10/14/VIDE1372319319376470.shtml) 确认曲名和 2004 年剧集关联；[酷狗曲目](https://www.kugou.com/mixsong/h3jg0c9.html?share=1) 检索结果列腾格尔与《神探狄仁杰》专辑（直接打开超时）；[豆瓣唱片条目](https://music.douban.com/subject/35942895/) 可读，列腾格尔、程大兆作曲、高建民/钱雁秋作词。记忆对应“每次听到你，总是大风起”，“看到”混合了下一行。未下载音频。

**片尾音乐的独立正式曲名与演唱者未能可靠核实。** 搜索“神探狄仁杰 片尾曲 程大兆 纯音乐”“神探狄仁杰 片尾曲 长歌一曲 演唱者”后，[民间片头片尾视频](https://www.bilibili.com/video/BV11E41187Y7/) 与 [民间原声整理](https://www.bilibili.com/video/BV1Ns411G7nx/) 仅提供“片尾曲经典音乐版本一”等描述，不能据此断言正式歌名、歌手，更不能直接命名为《长歌一曲》或《无字碑》。本次未逐集观看字幕，系列/台播版/前传/少年版可能不同，保留待核实，不编造。

## 实施及验证边界

原创长安城阙、水墨远山、大理寺 SVG；宣纸/墨夜 token；本机宋体 fallback。音乐 enabled、musicPath、volume、loop、autoplay(false)，不内置音乐。Host 随机 capability 路由仅供应配置的单个本机文件，不接受 URL 传路径，支持 Range/HEAD，限制扩展及大小。默认空路径不读音乐；另提供浏览器文件选择。配置修改后重启 Host/刷新。自动播放即使启用也可能被 Chromium 拦截，提供手动播放。

仅写本项目，不安装 DSH、不改其配置、不推送、不建远程、不发布 npm、不读 _private、不碰 _tools。桌面加载、真实音频解码及分辨率视觉效果未测，独立 DOM 测试不冒充宿主实测。
