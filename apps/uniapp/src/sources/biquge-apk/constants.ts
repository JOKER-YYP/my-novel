/** 笔趣阁 APK = app.maoyankanshu.novel（猫眼看书同系），不含广告/登录/充值 */

export const SOURCE_ID = 'biquge-apk'
export const SOURCE_NAME = '笔趣阁'

export const CLIENT_NAME = 'app.maoyankanshu.novel'
export const CLIENT_VERSION = '2.3.0'
export const CLIENT_BRAND = 'Redmi'

export const TOKEN_KEY = 'biquge_apk_auth_token'
export const DEVICE_KEY = 'biquge_apk_client_device'
export const HOST_KEY = 'biquge_apk_active_host'

/**
 * 仅 HTTPS（抓包确认）。
 * 注意：多域名当前对部分网络返回 request_id=mock 空壳，属服务端侧问题。
 */
export const API_HOSTS = [
  'api.lfdapengu.com',
  'api.jxgtzxc.com',
  'api.jmlldsc.com',
  'api.lemiyigou.com',
  'api.myweipin.com',
] as const

export const REQ_TIMEOUT_MS = 9000
export const SEARCH_HOST_TRIES = 2

/** 书源抓包常见游客 token（非登录页；仅作请求头，不实现登录） */
export const FALLBACK_AUTH =
  'bearereyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOlwvXC9hcGkuanhndHp4Yy5jb21cL2F1dGhcL2xvZ2luYnltb2JpbGUiLCJpYXQiOjE3MzU2MTQ3NzEsImV4cCI6MTgyODkyNjc3MSwibmJmIjoxNzM1NjE0NzcxLCJqdGkiOiI1VEdjdXpoOHNSNVk5WlNjIiwic3ViIjo4MTEzMzQsInBydiI6ImExY2IwMzcxODAyOTZjNmExOTM4ZWYzMGI0Mzc5NDY3MmRkMDE2YzUifQ.-dT55vUMI-JJyfl3a9__Ii-DjxbyvnlOMoXWdG1c8JA'

export const AES_KEY_UTF8 = 'f041c49714d39908'
export const AES_IV_UTF8 = '0123456789abcdef'

export const RANK_TABS = [
  { id: 'must', title: '必读榜', type: 1 },
  { id: 'potential', title: '潜力榜', type: 5 },
  { id: 'finish', title: '完本榜', type: 2 },
  { id: 'update', title: '更新榜', type: 3 },
  { id: 'search', title: '搜索榜', type: 4 },
  { id: 'comment', title: '评论榜', type: 6 },
] as const

export const CATEGORIES = [
  { id: 'lejRej', title: '玄幻', channel: 1 },
  { id: 'nel5aK', title: '武侠', channel: 1 },
  { id: 'mbk5ez', title: '都市', channel: 1 },
  { id: 'vbmOeY', title: '仙侠', channel: 1 },
  { id: 'penRe7', title: '军事', channel: 1 },
  { id: 'xbojag', title: '历史', channel: 1 },
  { id: 'mep2bM', title: '游戏', channel: 1 },
  { id: 'zbq2dp', title: '科幻', channel: 1 },
  { id: 'YerEdO', title: '轻小说', channel: 1 },
  { id: '9avmeG', title: '现代言情', channel: 2 },
  { id: 'DdwRb1', title: '古代言情', channel: 2 },
  { id: '7ax9by', title: '幻想言情', channel: 2 },
  { id: 'Pdy7aQ', title: '青春校园', channel: 2 },
  { id: 'kazYeJ', title: '唯美纯爱', channel: 2 },
  { id: '9aAOdv', title: '同人衍生', channel: 2 },
] as const
