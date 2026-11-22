import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios'

const options = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10_000,
}
export const apiClient = axios.create(options)
export const publicAuthClient = axios.create({ ...options, withCredentials: true })

type Session = { key: string | null; token: string | null }
type AuthBinding = {
  getSession: () => Session
  refresh: (session: Session) => Promise<void>
  onUnauthorized: () => void
  onSuspended: (message: string) => void
}
type AuthRequest = InternalAxiosRequestConfig & { zipSession?: string; zipRetried?: boolean }

let auth: AuthBinding | undefined
let pending: { key: string; promise: Promise<void> } | undefined

export function bindAuth(binding: AuthBinding) {
  auth = binding
}

apiClient.interceptors.request.use((config: AuthRequest) => {
  const session = auth?.getSession()
  if (config.zipRetried && session?.key !== config.zipSession) throw new Error('로그인 상태가 변경됐어요.')
  if (session?.key && session.token) {
    config.zipSession = session.key
    config.headers.set('Authorization', `Bearer ${session.token}`)
  }
  return config
}, (error) => { throw error }, { synchronous: true })

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!auth || !isAxiosError<{ message?: string; code?: string }>(error)) throw error
    const binding = auth
    const request = error.config as AuthRequest | undefined
    const session = binding.getSession()
    if (!request || !session.key || !session.token || request.zipSession !== session.key) throw error
    const status = error.response?.status
    if (status === 403 && error.response?.data?.code === 'SUSPENDED') {
      binding.onSuspended(error.response.data.message ?? '이용이 정지된 계정이에요.')
    }
    // Spring Security rejects expired bearer tokens before the request reaches the handler.
    if (status !== 401 || !error.response?.headers['www-authenticate']) throw error
    const usedCurrentToken = request.headers.get('Authorization') === `Bearer ${session.token}`
    if (request.zipRetried) {
      if (usedCurrentToken) binding.onUnauthorized()
      throw error
    }
    if (usedCurrentToken) {
      const key = session.key
      if (pending?.key !== key) {
        const promise = binding.refresh(session).catch((failure: unknown) => {
          if (binding.getSession().key === key && isAxiosError<{ message?: string; code?: string }>(failure)) {
            if (failure.response?.status === 401) binding.onUnauthorized()
            if (failure.response?.status === 403 && failure.response.data?.code === 'SUSPENDED') {
              binding.onSuspended(failure.response.data.message ?? '이용이 정지된 계정이에요.')
            }
          }
          throw failure
        }).finally(() => { if (pending?.promise === promise) pending = undefined })
        pending = { key, promise }
      }
      await pending.promise
    }
    return apiClient.request({ ...request, zipRetried: true } as AuthRequest)
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
