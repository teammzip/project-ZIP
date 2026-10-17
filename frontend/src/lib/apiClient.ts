import axios, { isAxiosError } from 'axios'

/* 모든 서버 요청은 이 apiClient 로 보냅니다.
 * - 로그인 토큰을 Authorization 헤더에 자동으로 붙임
 * - 401(로그인 만료)이 오면 onUnauthorized 를 불러 로그아웃 처리
 * 토큰을 어디서 읽을지는 app/setupApi.ts 에서 bindAuth() 로 연결합니다. (lib 가 features 를 몰라도 되게) */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
})

let getToken: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function bindAuth(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = opts.getToken
  onUnauthorized = opts.onUnauthorized
}

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (isAxiosError(error) && error.response?.status === 401) onUnauthorized()
    return Promise.reject(error)
  },
)

/* 에러를 화면에 보여줄 한 줄 문장으로 바꿈.
 * 백엔드는 실패 응답을 { "message": "..." } 형태로 주기로 맞추면 그 문장이 그대로 보입니다. */
export function getErrorMessage(error: unknown, fallback = '잠시 후 다시 시도해 주세요.'): string {
  if (isAxiosError<{ message?: string }>(error)) {
    if (error.response?.data?.message) return error.response.data.message
    if (!error.response) return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
