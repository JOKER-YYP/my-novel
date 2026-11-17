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
npm run dev:mp-weixin
```

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
- 红薯：触屏站 `g.hongshu.com/Bookajax/search`；免费章可读，VIP 章会提示
- 布谷：`/search/?searchkey=`（需简易 clearance）；详情/目录/正文直连 HTML
- 800小说：`POST /search.html`（字段 `s`，需动态 `waf_challenge`）；目录 `/book_{id}/ml{n}.html`；正文 `#txt`
- 书城榜单/分类当前仍以红薯为主
- `apps/server` 仅为旧代理实现，小程序直连模式下可不启动
