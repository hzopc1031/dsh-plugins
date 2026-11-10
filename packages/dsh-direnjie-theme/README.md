# 长安听雨 · dsh-direnjie-theme

面向 Windows DSH Desktop **0.2.1-rc.5** 的 Cordis 主题 bundle，以《神探狄仁杰》的古装探案气氛为灵感。原创长安城阙、水墨远山、大理寺意象，非官方联名、非剧照、非历史建筑复原。

## 功能与边界

- 聊天区原创 SVG 背景、宣纸/墨夜双色 token，跟随宿主浅深色；正文宋体 fallback，代码字体保留宿主设置。
- 右下角“长安听雨 · 乐”可折叠原生播放器，展开后播放/暂停、进度、音量；支持本机文件选择。
- `musicPath` 由 Host 供应单个配置文件，支持 Range/HEAD；不使用 renderer 的 file://，不接受请求参数传入文件路径。默认空路径不读取音频。随机路由随 Host 重启变化，仅向可读取该应用页面的客户端提供地址，不是独立的用户鉴权系统。
- 不内置、下载或分发任何音频，不包含剧照或字体文件。用户自行选择有权使用的本机文件。
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

完全退出并重新打开桌面 DSH，必要时刷新页面。应看到浅色宣纸/深色墨绿配色、聊天背景，以及右下角折叠的“长安听雨 · 乐”。修改配置时先关闭 DSH，再编辑 desktop profile 中本插件 **已有 id** 的 config；不要重复插入相同 id。也可使用插件管理器显示的该插件配置入口（是否暴露普通 Config 编辑器依宿主界面而定）。

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
| musicPath | string / 空 | Windows 本机绝对路径；支持 mp3/wav/ogg/m4a/flac，最大 128 MiB；不接受 UNC；空值可用文件选择器 |
| volume | number / 0.35 | 初始音量，0..1 |
| loop | boolean / true | 循环播放 |
| autoplay | boolean / false | 显式开启后尝试自动播放，Chromium 仍可能要求手动点击 |

文件选择仅作用于当前页面，不上传到 Host，也不保存路径；刷新后需重选。原生控件音量调整同样不写配置。musicPath 的格式能否解码取决于 Electron；报错时可选其他格式，或由用户在 Windows 资源管理器中打开系统播放器，插件不启动外部进程。

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

人工验收：分别选择宿主浅/深色，检查正文与代码可读；展开音乐面板选择自有音频并拖动进度/调音量；检查默认不自动播放；设置 musicPath 后重启播放；禁用及卸载后检查清理。桌面加载及真实声音尚未实测。

## 文件

`src/` 类型完整的 Host/client/音乐服务/配色；`assets/changan.svg` 原创背景；`lib/` 预构建 JS 与声明；`scripts/` 构建及 verify-pack；`test/` 测试；`locale/` 元信息；`cordis.patch.yml` bundle；`index.js` 入口；`docs/` 调研/验证/交接；`icon.svg` 原创图标。

MIT，见 LICENSE；本许可仅覆盖本项目原创代码和素材。
