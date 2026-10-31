/* 인증 관련 타입. 백엔드와 요청/응답 모양을 맞출 때 이 파일을 기준으로 이야기하면 됩니다. */

export type SocialProvider = 'kakao' | 'google' | 'naver'

/** 내 정보. 서버의 users 표 한 줄 (DB 의 BIGINT id 는 API 에서 문자열로 줌) */
export type User = {
  id: string
  /** 로그인 아이디 (6~16자 영문 소문자·숫자). 소셜 가입자는 없을 수 있음 */
  username?: string
  email: string
  nickname: string
  address: string
  /** 사는 동네 (DB users.region_id → regions). 주소에서 동네를 못 찾으면 없음 */
  region?: { id: string; name: string } | null
  /** 가입 경로 (DB users.signup_provider 의 소문자) */
  provider: 'email' | SocialProvider
  /** 권한. ADMIN 만 관리자 화면(/admin)에 들어갈 수 있음 (DB users.role) */
  role?: 'USER' | 'ADMIN'
  /** 이용 상태 (DB users.status). 정지된 계정은 로그인 자체가 막히므로 보통 ACTIVE */
  status?: 'ACTIVE' | 'SUSPENDED'
  /** 약관·개인정보 수집에 동의한 시각 (ISO). 소셜 로그인으로 처음 들어온 사람은 null → 동의 화면(/welcome)으로 보냄 */
  agreedAt?: string | null
  /** 가입 후 처음 로그인이면 true → 앱이 "우리 집 설문" 창을 한 번 띄움. 서버는 users.last_login_at 이 NULL 이었는지로 판단 */
  firstLogin?: boolean
}

/** POST /auth/login — loginId 는 아이디 또는 이메일 */
export type LoginRequest = {
  loginId: string
  password: string
  /** "로그인 유지" 체크 (DB auth_sessions.remember). 켜면 세션 만료가 길어짐 */
  remember?: boolean
}

/** 가입 약관 동의 (모두 필수) */
export type ConsentRequest = {
  agreeTerms: boolean
  agreePrivacy: boolean
  agreePolicy: boolean
  ageOver14: boolean
  /** 동의한 약관 버전 (features/legal 의 LEGAL_VERSION) */
  termsVersion: string
}

/** POST /auth/signup */
export type SignupRequest = ConsentRequest & {
  username: string
  password: string
  nickname: string
  /** 010-0000-0000 */
  phone: string
  /** 휴대전화 인증을 마치고 받은 값 (POST /auth/phone/verify 응답) */
  phoneVerificationToken: string
  email: string
  address: string
}

/** PATCH /auth/me — 닉네임 수정, 또는 소셜 첫 가입 때 주소·동의 받기 */
export type UpdateMeRequest = Partial<ConsentRequest> & {
  nickname?: string
  address?: string
}

/** 휴대전화 인증 목적 (DB phone_verifications.purpose 와 같음) */
export type PhonePurpose = 'SIGNUP' | 'FIND_ID' | 'RESET_PASSWORD'

/** POST /auth/find-id — 닉네임 + 휴대전화 인증 */
export type FindIdRequest = { nickname: string; phone: string; phoneVerificationToken: string }
export type FindIdResponse = { username: string }

/** POST /auth/password-reset/verify — 아이디 + 휴대전화 인증이 맞으면 재설정 토큰을 줌 */
export type PasswordResetVerifyRequest = { username: string; phone: string; phoneVerificationToken: string }
/** POST /auth/password-reset — 재설정 토큰으로 새 비밀번호 저장 (토큰은 한 번만 쓸 수 있음) */
export type PasswordResetRequest = { resetToken: string; newPassword: string }

/** PATCH /auth/me/password — 내 정보에서 비밀번호 변경 */
export type ChangePasswordRequest = { currentPassword: string; newPassword: string }

/** 로그인·회원가입 성공 응답 */
export type AuthResponse = {
  accessToken: string
  user: User
}

/** 실제 API 와 가짜(mock) API 가 똑같이 지켜야 하는 약속 */
export interface AuthApi {
  login(req: LoginRequest): Promise<AuthResponse>
  signup(req: SignupRequest): Promise<AuthResponse>
  /** POST /auth/phone/send — 휴대전화로 인증번호 보내기 */
  sendPhoneCode(phone: string, purpose: PhonePurpose): Promise<void>
  /** POST /auth/phone/verify — 인증번호 확인. 맞으면 다음 요청에 함께 보낼 값을 줌 */
  verifyPhoneCode(phone: string, code: string, purpose: PhonePurpose): Promise<{ verificationToken: string }>
  findId(req: FindIdRequest): Promise<FindIdResponse>
  verifyPasswordReset(req: PasswordResetVerifyRequest): Promise<{ resetToken: string }>
  resetPassword(req: PasswordResetRequest): Promise<void>
  changePassword(req: ChangePasswordRequest): Promise<void>
  /** GET /auth/me — 토큰으로 내 정보 조회 (소셜 로그인 콜백에서 사용) */
  me(): Promise<User>
  logout(): Promise<void>
  /** 소셜 로그인 시작. 실제 API 는 소셜 로그인 페이지로 이동하므로 값을 돌려주지 않음 */
  startSocialLogin(provider: SocialProvider): Promise<AuthResponse | void>
  /** PATCH /auth/me — 내 정보 수정 */
  updateMe(req: UpdateMeRequest): Promise<User>
  /** DELETE /auth/me — 회원 탈퇴 (서버에 저장된 내 정보 삭제) */
  withdraw(): Promise<void>
}
