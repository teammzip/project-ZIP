import { useAuthStore } from '@/features/auth'
import { useRegionVerify } from '@/features/life'

/** 화면 여러 곳에서 쓰는 "나" 정보: 닉네임(로그인 정보) + 우리 동네(내 정보 설정) */
export function useProfile() {
  const name = useAuthStore((s) => s.user?.nickname) ?? '자취생'
  const { region } = useRegionVerify()
  return { name, region }
}
