# 蓝海中文代理后端

抓取 [lanhaizw.com](https://www.lanhaizw.com/)，处理 GBK、JS 门禁与图片验证码会话。

## 启动

```bash
cd apps/server
npm install
npm run dev
```

默认 `http://0.0.0.0:8787`。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| GET | `/api/search?q=` | 搜索；若需验证码返回 `needCaptcha/ticket/imageBase64` |
| POST | `/api/search/verify` | `{ ticket, code }` 提交搜索验证码 |
| GET | `/api/books/:bookId` | 详情 |
| GET | `/api/books/:bookId/chapters` | 目录 |
| GET | `/api/chapters/:chapterId/content` | 正文；可能返回验证码挑战 |
| POST | `/api/chapters/verify` | `{ ticket, code }` 提交正文验证码 |
| GET | `/api/rank?path=` | 榜单/书库 |
| GET | `/api/categories/:id` | 分类 |

本站对搜索/正文有图片验证码，前端需展示验证码图并回传 4 位数字。
