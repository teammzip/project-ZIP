/* 가입 약관 동의 값 (모두 필수): 서비스 이용약관 · 개인정보 처리방침 확인 · 커뮤니티·AI 운영 정책 · 만 14세 이상 */
export type Consent = { terms: boolean; privacy: boolean; policy: boolean; age: boolean }
export type ConsentErrors = Partial<Record<keyof Consent, string>>

export const EMPTY_CONSENT: Consent = { terms: false, privacy: false, policy: false, age: false }
