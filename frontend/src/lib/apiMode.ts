/* 가짜 API 모드인지 (VITE_USE_MOCK=false 로 바꾸기 전까지는 가짜 API). 모든 기능이 이 값 하나만 봐요.
 * 기능 모듈끼리 서로 가져오지 않아도 되게 lib 에 둠 (auth/api 는 이 값을 다시 내보냄) */
export const isMockApi = import.meta.env.VITE_USE_MOCK !== 'false'
