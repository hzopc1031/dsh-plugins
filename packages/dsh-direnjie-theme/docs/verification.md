# 验证记录

## 0.1.1（2026-11-10）

Windows、DESKTOP-NTRMANG。改名「神探狄仁杰」、换原创狄仁杰插画背景（webp 内联）。

- npm ci、npm run typecheck、npm test（9 项）、npm run verify-pack 全部通过，详见提交说明。
- verify-pack 新增检查：两种语言标题含「神探狄仁杰」、client 中不再含旧名、背景以 webp data URI 内联、包内无旧 SVG 背景。
- 离线预览：用无头 Chromium 把构建出的 CSS 套在模拟聊天面板上截图（浅色/深色），仅用于看大致效果，不等于真实 DSH 渲染。

## 0.1.0（2026-11-10）

Windows、Node v24.20.0、npm 11.19.0。

- npm run typecheck：通过，strict TypeScript，声明生成；针对官方 rc.5 npm 类型编译。
- npm test：9 项通过，实际预构建 client bundle 由 ModuleLoader 格式执行、DOM 控件、启用/禁用、文件选择、Blob URL 释放、卸载与重新挂载、自动播放拒绝与错误提示、主题层清理；配置/脚本转义/Range 解析；真实 Cordis scope 的注入/路由卸载；本地 HTTP GET/HEAD/Range/错误/超限与固定文件选择。
- HTTP 测试只用临时目录自动生成的短字节内容，不使用或打包受保护音频；它不验证音频解码。
- npm run verify-pack：通过，23 个包内文件，预编译入口完整，无音频、研究副本、测试或依赖目录。

未测：真实桌面 DSH 的安装、启动、渲染、音频解码/声音、实际自主播放策略、不同 DPI/窗口尺寸、与其他主题共存、桌面卸载/重启恢复。jsdom 只证明 DOM 生命周期，不证明布局及 Electron 解码。未修改 DSH 源码或配置。
