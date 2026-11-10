# dsh-content-evidence

开发骨架，功能与文档尚未完成。当前仅提供 `/content-evidence` 帮助命令，不会自动发布内容。

Development scaffold; functionality and documentation are incomplete. Version `0.1.0` currently provides only the `/content-evidence` help command. Nothing is published automatically.

Requires Node.js `>=22` and DSH `>=0.2.1-rc.5 <0.3.0`. APIs were checked against DSH `0.2.2-rc.1`, source commit `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`. Development dependencies also build and test the scaffold against the sibling packages' `0.2.1-rc.5` command API baseline.

## Current data flow / 当前数据流

`/content-evidence` returns static help through DSH's command registry without invoking a model or any tool. This scaffold creates no user files and performs no network requests. DSH owns command history; this command disables recording its arguments.

Planned storage for later tasks is `$DSH_HOME/content-evidence`, or `~/.dsh/content-evidence` when `DSH_HOME` is unset. User work must stay outside the installed package and survive plugin restart, upgrade and uninstall. Storage is not implemented in this scaffold.

后续任务将实现材料与实验记录、证据表、X / 小红书 / 抖音 / 视频号草稿、合规检查和本地导出。当前尚不支持这些功能。用户数据将存放在包目录之外，插件安装、升级与卸载不得删除用户作品。

## Local development / 本地开发

This is an independent package with its own lockfile and committed `lib/` output. From this directory:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run verify-pack
```

The bundle patch inserts the `content-evidence` plugin. Prebuilt artifacts are shipped without install lifecycle hooks. No client entry, tool or remote endpoint is registered yet.

MIT © 2026 hzopc1031.
