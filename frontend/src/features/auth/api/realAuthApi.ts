import { apiClient } from '@/lib/apiClient'
import type { AuthApi, AuthResponse, FindIdResponse, User } from '../types'

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

  async sendPhoneCode(phone, purpose) {
    await apiClient.post('/auth/phone/send', { phone, purpose })
  },

  async verifyPhoneCode(phone, code, purpose) {
    const { data } = await apiClient.post<{ verificationToken: string }>('/auth/phone/verify', { phone, code, purpose })
    return data
  },

  async findId(req) {
    const { data } = await apiClient.post<FindIdResponse>('/auth/find-id', req)
    return data
  },

  async verifyPasswordReset(req) {
    const { data } = await apiClient.post<{ resetToken: string }>('/auth/password-reset/verify', req)
    return data
  },

  async resetPassword(req) {
    await apiClient.post('/auth/password-reset', req)
  },

  async changePassword(req) {
    await apiClient.patch('/auth/me/password', req)
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

  async updateMe(req) {
    const { data } = await apiClient.patch<User>('/auth/me', req)
    return data
  },

  async withdraw() {
    await apiClient.delete('/auth/me')
  },
}
