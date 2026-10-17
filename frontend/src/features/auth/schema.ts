import { z } from 'zod'

/* 로그인·회원가입 입력 검사 규칙. 백엔드도 같은 규칙으로 검사하도록 맞춰 주세요. */

const email = z
  .string()
  .trim()
  .min(1, '이메일을 입력해 주세요.')
  .pipe(z.email('이메일 형식을 확인해 주세요.'))

export const loginSchema = z.object({
  email,
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
  remember: z.boolean(),
})

export const signupSchema = z
  .object({
    nickname: z
      .string()
      .trim()
      .min(2, '닉네임은 2자 이상이어야 해요.')
      .max(12, '닉네임은 12자까지 쓸 수 있어요.'),
    email,
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 해요.')
      .max(64, '비밀번호는 64자까지 쓸 수 있어요.')
      .regex(/[A-Za-z]/, '비밀번호에 영문을 넣어 주세요.')
      .regex(/\d/, '비밀번호에 숫자를 넣어 주세요.'),
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
    address: z.string().trim().min(1, '주소를 입력해 주세요.'),
    agreeTerms: z.boolean().refine((v) => v, '약관에 동의해 주세요.'),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: '비밀번호가 서로 달라요.',
    path: ['passwordConfirm'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
