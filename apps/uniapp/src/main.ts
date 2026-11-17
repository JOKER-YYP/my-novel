import { Buffer } from 'buffer'
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 小程序/部分运行时无 Buffer，供 iconv-lite 解码 GBK 页
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  return {
    app,
  }
}
