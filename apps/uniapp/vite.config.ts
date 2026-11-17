import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      buffer: 'buffer/',
      string_decoder: 'string_decoder/',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'iconv-lite', 'string_decoder'],
  },
  define: {
    global: 'globalThis',
  },
})
