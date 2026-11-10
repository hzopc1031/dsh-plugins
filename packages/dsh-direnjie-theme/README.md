# 神探狄仁杰 · dsh-direnjie-theme

面向 Windows DSH Desktop **0.2.1-rc.5** 的 Cordis 主题 bundle：聊天区换成原创的狄仁杰插画背景（唐代官袍、幞头、手持卷宗，长安夜色），配宣纸/墨夜双色配色、宋体正文，右下角带一个本机音乐播放器。

> **声明**：本插件是非官方的同人风格主题，与电视剧《神探狄仁杰》及其版权方、出品方、演员均无关联。背景是原创 AI 插画，不含剧照，也不模仿任何演员形象。插件不内置、不下载、不分发任何音频。

## 功能与边界

- 聊天区原创插画背景 `assets/direnjie.webp`（1280×720），左侧遮罩较浓留出阅读区域，人物在右侧；跟随宿主浅深色；正文宋体 fallback，代码字体保留宿主设置。
- 右下角“神探狄仁杰 · 乐”可折叠原生播放器，展开后播放/暂停、进度、音量；支持本机文件选择。
- **音乐需要你自己提供**：在配置项 `musicPath` 里填本机音频文件的绝对路径（例如自己有权使用的《长歌一曲》mp3），或者展开播放器临时选择一个本机文件。插件本身不带任何歌曲。
- `musicPath` 由 Host 供应单个配置文件，支持 Range/HEAD；不使用 renderer 的 file://，不接受请求参数传入文件路径。默认空路径不读取音频。随机路由随 Host 重启变化，仅向可读取该应用页面的客户端提供地址，不是独立的用户鉴权系统。
- 暂无宿主内置壁纸 API，背景选择器使用 rc.5 内部 `_mainPanel` 类后缀，未来版本可能需要适配。音乐面板为插件自有 DOM，不占用官方 sidebar。
- 禁用/卸载清除 DOM、样式、主题 token 层、音频源和 Blob URL；不写用户原主题/字体偏好。修改配置后需要重启 Host 并刷新，暂不提供热配置界面。

源码依据和歌曲来源见 [docs/feasibility.md](docs/feasibility.md)。主题曲为腾格尔《长歌一曲》，片尾音乐独立正式曲名/演唱者尚未可靠核实。

## 安装

只需要通过 npm 包名或 GitHub 地址安装，不用下载 tgz，也不用自己编译（`lib/` 已预编译并提交到仓库，没有安装脚本）。

**方式一：桌面 DSH 界面（推荐）**
插件 → 添加插件，输入 npm 包名：

```text
dsh-direnjie-theme
```

**方式二：命令行，npm 包名**（先完全退出桌面 DSH）

```powershell
dsh plugin --profile desktop add dsh-direnjie-theme
```

**方式三：命令行或界面，GitHub 地址**（从 monorepo 子目录安装）

```text
github:hzopc1031/dsh-plugins#main&path:/packages/dsh-direnjie-theme
```

```powershell
dsh plugin --profile desktop add "github:hzopc1031/dsh-plugins#main&path:/packages/dsh-direnjie-theme"
```

> **Windows 命令行提示**：如果 `dsh` 报 `profile "desktop" is managed exclusively by the Electron application`，说明 PATH 上的是独立安装的 dsh；请改用桌面版自带的 CLI（命令其余部分不变）：
>
> ```powershell
> & "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add <包名或 git 地址>
> ```
>
> git 安装走 HTTPS 克隆 github.com；如果 git 全局配置了 `http.proxy`，代理需要处于运行状态。

完全退出并重新打开桌面 DSH，必要时刷新页面。应看到狄仁杰插画背景、浅色宣纸/深色墨夜配色，以及右下角折叠的“神探狄仁杰 · 乐”。

## 升级（已装 0.1.0 的用户）

内部 id（`direnjie-theme`）、包名和配置键都没变，直接升级，原来的配置会保留。先完全退出桌面 DSH，再运行：

```powershell
dsh plugin --profile desktop add dsh-direnjie-theme@latest
```

`dsh plugin` 会把参数原样交给 pnpm，所以 `add <包名>@latest` 会把已装版本换成最新版。从 git 装的，重新执行一次上面的 git 地址 add 命令即可拉取 main 最新提交。完成后重新打开 DSH。

## 配置

修改配置时先关闭 DSH，再编辑 desktop profile 中本插件 **已有 id** 的 config；不要重复插入相同 id。也可使用插件管理器显示的该插件配置入口（是否暴露普通 Config 编辑器依宿主界面而定）。

```yaml
# profiles/desktop/cordis.patch.yml 的现有插件条目（安装后由用户修改）
- insert:
    - id: direnjie-theme
      name: dsh-direnjie-theme
      config:
        enabled: true
        musicPath: 'D:\Music\我的本机音乐.mp3'
        volume: 0.35
        loop: true
        autoplay: false
```

| 配置 | 类型/默认值 | 用途 |
| --- | --- | --- |
| enabled | boolean / true | 整体主题与播放器开关 |
| musicPath | string / 空 | 你自己的本机音频文件绝对路径；支持 mp3/wav/ogg/m4a/flac，最大 128 MiB；不接受 UNC；空值可用文件选择器 |
| volume | number / 0.35 | 初始音量，0..1 |
| loop | boolean / true | 循环播放 |
| autoplay | boolean / false | 显式开启后尝试自动播放，Chromium 仍可能要求手动点击 |

文件选择仅作用于当前页面，不上传到 Host，也不保存路径；刷新后需重选。原生控件音量调整同样不写配置。musicPath 的格式能否解码取决于 Electron；报错时可选其他格式。插件不启动外部进程。

卸载后重启/刷新；检查背景、字体和配色恢复原状态：

```powershell
dsh plugin --profile desktop remove dsh-direnjie-theme
```

## 开发验证

```powershell
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
npm pack --ignore-scripts
```

已通过的检查及未测项见 [docs/verification.md](docs/verification.md)。依赖只装在本项目。

## 文件

`src/` 类型完整的 Host/client/音乐服务/配色；`assets/direnjie.webp` 原创 AI 插画背景（构建时内联进 `lib/client.js`）；`lib/` 预构建 JS 与声明；`scripts/` 构建及 verify-pack；`test/` 测试；`locale/` 元信息；`cordis.patch.yml` bundle；`index.js` 入口；`docs/` 调研/验证/交接；`icon.svg` 原创图标。

MIT，见 LICENSE；本许可仅覆盖本项目原创代码和素材，不涉及剧集名称、角色或音乐的任何权利。
