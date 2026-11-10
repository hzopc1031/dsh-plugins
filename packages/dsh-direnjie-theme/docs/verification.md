# 验证记录

2026-11-10；Windows、Node v24.20.0、npm 11.19.0。

- npm run typecheck：通过，strict TypeScript，声明生成；针对官方 rc.5 npm 类型编译。
- npm test：9 项通过，实际预构建 client bundle 由 ModuleLoader 格式执行、DOM 控件、启用/禁用、文件选择、Blob URL 释放、卸载与重新挂载、自动播放拒绝与错误提示、主题层清理；配置/脚本转义/Range 解析；真实 Cordis scope 的注入/路由卸载；本地 HTTP GET/HEAD/Range/错误/超限与固定文件选择。
- HTTP 测试只用临时目录自动生成的短字节内容，不使用或打包受保护音频；它不验证音频解码。
- npm run verify-pack：通过，23 个包内文件，预编译入口完整，无音频、研究副本、测试或依赖目录。
- npm pack：生成 dsh-direnjie-theme-0.1.0.tgz；最终归档另以 tar 目录核对并解包导入 Host 入口。

未测：真实桌面 DSH 的安装、启动、渲染、音频解码/声音、实际自主播放策略、不同 DPI/窗口尺寸、与其他主题共存、桌面卸载/重启恢复。jsdom 只证明 DOM 生命周期，不证明布局及 Electron 解码。未修改 DSH 源码或配置。
