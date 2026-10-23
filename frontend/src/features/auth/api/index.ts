import { ADMIN_ACCOUNT, DEMO_ACCOUNT, mockAuthApi } from './mockAuthApi'
import { realAuthApi } from './realAuthApi'

/* VITE_USE_MOCK=false 로 바꾸기 전까지는 가짜 API 를 씁니다. 화면 코드는 어느 쪽인지 몰라도 됩니다. */
export const isMockApi = import.meta.env.VITE_USE_MOCK !== 'false'
export const authApi = isMockApi ? mockAuthApi : realAuthApi
/** 가짜 API 모드일 때만 데모 계정 정보가 있음 */
export const demoAccount = isMockApi ? DEMO_ACCOUNT : null
/** 가짜 API 모드일 때만 관리자 데모 계정이 있음 */
export const demoAdmin = isMockApi ? ADMIN_ACCOUNT : null
