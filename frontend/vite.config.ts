import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      // import '@/components/ui' 처럼 src 기준 경로로 불러오기
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 3000,
      // 개발 중 /api 요청은 백엔드 서버로 넘김 (CORS 걱정 없이 개발)
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true },
      },
    },
  }
})
