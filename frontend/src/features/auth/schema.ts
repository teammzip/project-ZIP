import { z } from 'zod'

/* 로그인·회원가입·계정 찾기 입력 검사 규칙.
 * 백엔드도 같은 규칙으로 검사하도록 맞춰 주세요. */

const email = z
  .string()
  .trim()
  .min(1, '이메일을 입력해 주세요.')
  .pipe(z.email('이메일 형식을 확인해 주세요.'))

/** 새 비밀번호 규칙: 가입 · 비밀번호 찾기 · 비밀번호 변경이 같이 씀 */
const newPassword = z
  .string()
  .min(8, '비밀번호는 8~16자로 입력해 주세요.')
  .max(16, '비밀번호는 8~16자로 입력해 주세요.')
  .regex(/[A-Za-z]/, '비밀번호에 영문을 넣어 주세요.')
  .regex(/\d/, '비밀번호에 숫자를 넣어 주세요.')
  .regex(/[^A-Za-z0-9]/, '비밀번호에 특수 문자를 넣어 주세요.')

const samePassword = { message: '비밀번호가 서로 달라요.', path: ['passwordConfirm'] }

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, '아이디 또는 이메일을 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
  remember: z.boolean(),
})

export const signupSchema = z
  .object({
    username: z.string().trim().regex(/^[a-z0-9]{6,16}$/, '아이디는 6~16자 영문 소문자, 숫자만 쓸 수 있어요.'),
    password: newPassword,
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
    nickname: z.string().trim().min(2, '닉네임은 2~12자로 입력해 주세요.').max(12, '닉네임은 2~12자로 입력해 주세요.'),
    /** 010- 뒤 8자리 (0000-0000) */
    phone: z.string().regex(/^\d{4}-\d{4}$/, '휴대전화 번호를 확인해 주세요. (010-0000-0000)'),
    phoneToken: z.string().min(1, '휴대전화 인증을 해 주세요.'),
    email,
    address: z.string().trim().min(1, '주소를 입력해 주세요.'),
    agreeTerms: z.boolean().refine((v) => v, '서비스 이용약관에 동의해 주세요.'),
    agreePrivacy: z.boolean().refine((v) => v, '개인정보 처리방침 안내를 확인해 주세요.'),
    agreePolicy: z.boolean().refine((v) => v, '커뮤니티·AI 운영 정책에 동의해 주세요.'),
    ageOver14: z.boolean().refine((v) => v, '만 14세 이상만 가입할 수 있어요.'),
  })
  .refine((d) => d.password === d.passwordConfirm, samePassword)

/** 비밀번호 찾기 2단계 · 비밀번호 변경의 새 비밀번호 */
export const newPasswordSchema = z
  .object({ password: newPassword, passwordConfirm: z.string().min(1, '새 비밀번호를 한 번 더 입력해 주세요.') })
  .refine((d) => d.password === d.passwordConfirm, samePassword)

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해 주세요.'),
    password: newPassword,
    passwordConfirm: z.string().min(1, '새 비밀번호를 한 번 더 입력해 주세요.'),
  })
  .refine((d) => d.password === d.passwordConfirm, samePassword)
  .refine((d) => d.password !== d.currentPassword, { message: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.', path: ['password'] })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
export type NewPasswordValues = z.infer<typeof newPasswordSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
