import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth'
import { isMockApi } from '@/features/auth/api'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import common from '@/styles/common.module.css'
import styles from './Profile.module.css'

type ProfileInfo = { birth: string | null; address: string | null; email: string | null; username: string | null }

/** 편집 창을 열 때 서버의 본인 등록 정보를 조회한다. */
export function ProfilePersonalInfo() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const survey = useHousingSurveyStore((s) => s.survey)
  const query = useQuery({
    queryKey: ['profile-info', user?.id, token],
    enabled: !!user && !!token && !isMockApi,
    queryFn: async ({ signal }) => (await apiClient.get<ProfileInfo>('/me/profile-info', { signal })).data,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const info = isMockApi ? {
    birth: user?.id && survey?.userId === user.id ? survey.birth : null,
    address: user?.address, email: user?.email, username: user?.username,
  } : query.data
  return <section className={styles.personalInfo} aria-label="내 등록 정보">
    <h4>내 등록 정보</h4>
    <p className={common.note}>등록된 정보를 확인할 수 있어요. 현재 거주하는 집의 계약 정보는 내 집 정보에서 확인해 주세요.</p>
    {!isMockApi && query.isPending && <p role="status">등록 정보를 불러오는 중이에요.</p>}
    {query.isError && <p className={common.formError} role="alert">{getErrorMessage(query.error, '등록 정보를 불러오지 못했어요.')} <button type="button" onClick={() => void query.refetch()}>다시 시도</button></p>}
    {info && <dl>
      <dt>생년월일</dt><dd>{info.birth || '미등록'}</dd>
      <dt>등록 주소</dt><dd>{info.address || '미등록'}</dd>
      <dt>이메일</dt><dd>{info.email || '미등록'}</dd>
      <dt>아이디</dt><dd>{info.username || '소셜 로그인 계정'}</dd>
    </dl>}
  </section>
}
