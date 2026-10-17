import { apiClient } from '@/lib/apiClient'
import type { AuthApi, AuthResponse, User } from '../types'

/* 실제 백엔드 API. 주소(엔드포인트)는 백엔드와 정한 뒤 여기만 고치면 됩니다. */
export const realAuthApi: AuthApi = {
  async login(req) {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', req)
    return data
  },

  async signup(req) {
    const { data } = await apiClient.post<AuthResponse>('/auth/signup', req)
    return data
  },

  async me() {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  async logout() {
    await apiClient.post('/auth/logout')
  },

  async startSocialLogin(provider) {
    // 백엔드가 소셜 로그인 후 /oauth/callback?token=... 으로 돌려보내 주면 OAuthCallbackPage 가 마무리합니다.
    const base = import.meta.env.VITE_API_BASE_URL || '/api'
    window.location.href = `${base}/oauth2/authorization/${provider}`
  },
}
