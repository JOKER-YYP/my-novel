# 听书匣

UniApp 小说阅读 / TTS 听书（无登录）。支持**多源并行搜索**：

- [红薯中文网](https://www.hongshu.com/)
- [布谷小说网](https://www.buguxs.com/)
- [800小说网](https://www.800xs.org/)

微信小程序直连，无需自建后端。

## 运行

```bash
cd apps/uniapp
npm install
npm run dev:mp-weixin          # 微信小程序（不能用系统语音）
npm run dev:app-android        # Android App 真机（系统语音 / 小米 TTS）
```

系统听书请用 **HBuilderX → 运行 → 运行到手机或模拟器 → Android**，并确保 manifest 已勾选 Speech 模块。

### 真机搜不到 / request:fail

开发者工具里「不校验合法域名」**只对模拟器有效**；预览到手机仍会校验。

临时：手机打开小程序后 → 右上角 `···` → **打开调试**，再搜一次。

正式：微信公众平台 → 开发 → 开发设置 → **服务器域名**，将下列域名加入 `request` 合法域名（需 HTTPS + ICP 备案），改完后删除手机上的开发版/体验版再扫码进入：

- `www.hongshu.com`、`g.hongshu.com`、`img2.hongshu.com`
- `www.buguxs.com`
- `www.800xs.org`

封面图还需配置对应 `downloadFile` 合法域名。

## 说明

- 搜索会并行请求已启用书源，结果合并去重
- 听书对齐 Fanqie-novel-Downloader 产品模型：
  - 三路来源：系统语音（默认，Android 原生 TextToSpeech / 小米自带引擎） / AI 音色（百度） / 真人有声
  - **系统语音仅 App 真机可用**；微信小程序无法调用手机 TTS，请用 HBuilderX 运行到 Android 手机
  - 小米请先开启：设置 → 更多设置 → 无障碍 → 文字转语音（TTS）输出
  - 阅读进度与听书进度分离；跨章续听可选「接着上次听」或「从当前章节听」
  - 阅读器内听书面板支持边听边读、自动跟随章节；播放中约每 10 秒落盘
- 阅读器对齐番茄小说交互：
  - 羊皮纸/竹影背景、手写楷体、大行距；点屏唤出顶栏/底栏
  - 底栏：上一章·进度条·下一章；目录 / 夜间 / 设置 / 听书
  - 设置：字号、字体、颜色圆点、背景缩略图、翻页模式（上下滚动）
  - 目录半屏抽屉；听书句级高亮 + 底部「暂停/继续播放」胶囊
- 红薯：触屏站 `g.hongshu.com/Bookajax/search`；免费章可读，VIP 章会提示
- 布谷：`/search/?searchkey=`（需简易 clearance）；详情/目录/正文直连 HTML
- 800小说：`POST /search.html`（字段 `s`，需动态 `waf_challenge`）；目录 `/book_{id}/ml{n}.html`；正文 `#txt`
- 书城榜单/分类当前仍以红薯为主
- `apps/server` 仅为旧代理实现，小程序直连模式下可不启动
