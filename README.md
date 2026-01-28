# Magic-Internet

准备搞个魔法网络优化配置集合（内容精简版），目前Loon插件取自fmz200，精简后只保留自用插件。

## 目录结构
- **[LoonPlugins](./LoonPlugins)**: 自动精简与同步的 Loon 广告屏蔽插件。
- **[Rules](./Rules)**: 分流规则工作目录。

## 如何使用
1. **Loon 插件**: 修改 `LoonPlugins/fmz-sync.js` 中的 `KEEP_APPS` 即可。同步将由 GitHub Actions 自动完成 (由 `.github/workflows/sync.yml` 驱动)。
2. **分流规则**: 在 `Rules` 目录下进行配置并同步到远程。
