# Magic-Internet

准备搞个魔法网络优化配置集合（内容精简版），目前Loon插件取自fmz200，精简后只保留自用插件。

> PS: 为了目录干净，该分支仅展示可订阅内容，源码请移步另一分支。

## 目录结构
- **[LoonPlugins](./LoonPlugins)**: 自动精简与同步的 Loon 广告屏蔽插件。
- **[Rules](./Rules)**: 分流规则工作目录。

## 百度地图去广告（App Store 官方版）

在 Loon 的插件页面添加以下 Raw URL：

<https://raw.githubusercontent.com/coffeecodetea/Magic-Internet/main/LoonPlugins/BaiduMap_RemoveAds.plugin>

需要 Loon 3.5.1(978) 或更新版本，开启 MitM 并安装、信任其证书。继续使用支持 CarPlay 的官方 App，无需重签或修改 IPA。

规则作者为 [ddgksf2013](https://github.com/ddgksf2013)，[原始来源](https://ddgksf2013.top/scripts/bdmap.ads.js)用于署名追溯；转换基准为用户提供且已实测可用的 Script Hub → Loon 结果。Hpxo 仅整理为 Loon 原生语法，完整保留 9 条 Rewrite：首页信息流、HTTPDNS、我的页面、搜索热词、`qt=hw` 推广、开屏广告、商业推广、动态与 TIPS；保留全部 MITM 项，包括 `180.76.76.200`。

4 条 jq 表达式、正则与顺序沿用原规则；5 条 `reject-200` 按 [Loon 官方文档](https://nsloon.app/docs/Rewrite/rewrite_v2/)转换为 `reject(200)`，返回 HTTP 200 空响应。原生语法文件仍需在设备上导入确认。

插件在 `source` 分支手工维护，现有 GitHub Actions 将其原样发布到 `main`，不依赖远程 JS。
