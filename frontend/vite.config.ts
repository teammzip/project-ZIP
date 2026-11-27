import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // 배포용 빌드(npm run build)는 항상 실제 서버 API를 써요. .env.local 에 VITE_USE_MOCK=true 가 있어도 빌드에는 쓰지 않아요.
  // 명령에서 직접 준 값(VITE_USE_MOCK=true npm run build)은 존중해서 데모용 모의 빌드도 만들 수 있어요.
  // Vite 는 이미 process.env 에 있는 값을 .env 파일보다 우선해요. npm run dev 는 그대로 .env 파일을 따라요.
  if (command === 'build' && process.env.VITE_USE_MOCK === undefined) process.env.VITE_USE_MOCK = 'false'
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
