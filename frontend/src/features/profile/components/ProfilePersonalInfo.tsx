import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { authApi, isMockApi } from '@/features/auth/api'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { apiClient, getErrorMessage } from '@/lib/apiClient'
import { useAge } from '@/lib/useAge'
import common from '@/styles/common.module.css'
import styles from './Profile.module.css'

type ProfileInfo = { nickname: string | null; birth: string | null; email: string | null; username: string | null }

/** 편집 창을 열 때 서버의 본인 등록 정보를 조회한다. */
export function ProfilePersonalInfo({ onNicknameSaved }: { onNicknameSaved?: (name: string) => void }) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const survey = useHousingSurveyStore((s) => s.survey)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  const [birth, setBirth] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [today] = useState(() => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10))
  const query = useQuery({
    queryKey: ['profile-info', user?.id, token],
    enabled: !!user && !!token && !isMockApi,
    queryFn: async ({ signal }) => (await apiClient.get<ProfileInfo>('/me/profile-info', { signal })).data,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
  const info = isMockApi ? {
    birth: user?.birth !== undefined ? user.birth : user?.id && survey?.userId === user.id ? survey.birth : null,
    nickname: user?.nickname, email: user?.email, username: user?.username,
  } : query.data
  const { age } = useAge(editing ? birth : info?.birth ?? '')
  const save = async () => {
    if (pending || !user || !token) return
    const name = nickname.trim()
    if ([...name].length < 2 || [...name].length > 12) return setError('닉네임은 2~12자로 입력해 주세요.')
    if (birth) {
      const date = new Date(`${birth}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birth || birth < '0001-01-01' || birth > today) return setError('생년월일은 미래가 아닌 올바른 날짜로 입력해 주세요.')
    }
    setPending(true); setError(''); setMessage('')
    try {
      const saved = isMockApi
        ? { ...(await authApi.updateMe({ nickname: name })), birth: birth || null }
        : (await apiClient.patch<ProfileInfo>('/me/profile-info', { nickname: name, birth })).data
      const current = useAuthStore.getState()
      if (current.token !== token || current.user?.id !== user.id) return
      current.updateUser({ ...current.user, nickname: saved.nickname ?? name, birth: saved.birth })
      if (!isMockApi) queryClient.setQueryData(['profile-info', user.id, token], saved)
      onNicknameSaved?.(saved.nickname ?? name)
      setEditing(false); setMessage('개인 정보를 저장했어요.')
    } catch (cause) { setError(getErrorMessage(cause, '개인 정보를 저장하지 못했어요.')) }
    finally { setPending(false) }
  }
  return <section className={styles.personalInfo} aria-label="내 개인 정보">
    <div className={styles.personalInfoHeader}>
      <h4>내 개인 정보</h4>
      {info && !editing && <button className={styles.personalInfoEdit} type="button" aria-label="내 개인 정보 수정" onClick={() => { setNickname(info.nickname ?? ''); setBirth(info.birth ?? ''); setError(''); setMessage(''); setEditing(true) }}>수정</button>}
    </div>
    <p className={common.note}>등록된 이름과 생년월일, 계정 정보를 확인할 수 있어요.</p>
    {!isMockApi && query.isPending && <p role="status">등록 정보를 불러오는 중이에요.</p>}
    {query.isError && <p className={common.formError} role="alert">{getErrorMessage(query.error, '등록 정보를 불러오지 못했어요.')} <button type="button" onClick={() => void query.refetch()}>다시 시도</button></p>}
    {info && <dl>
      <dt><label htmlFor="personal-nickname">이름(닉네임)</label></dt>
      <dd>{editing ? <input id="personal-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} disabled={pending} autoFocus /> : info.nickname || '미등록'}</dd>
      <dt><label htmlFor="personal-birth">생년월일</label></dt>
      <dd>{editing ? <input id="personal-birth" type="date" value={birth} onChange={(e) => setBirth(e.target.value)} min="0001-01-01" max={today} disabled={pending} /> : info.birth || '미등록'}</dd>
      <dt>나이</dt><dd>{age === null ? '생년월일 미등록 또는 확인 필요' : `만 ${age}세`}</dd>
      <dt>이메일</dt><dd>{info.email || '미등록'}</dd>
      <dt>아이디</dt><dd>{info.username || '소셜 로그인 계정'}</dd>
    </dl>}
    {editing && <div>
      <p className={common.note}>생년월일을 비우면 미등록으로 저장돼요. 가입 이메일과 아이디는 변경할 수 없어요.</p>
      <div className={styles.personalInfoActions}>
        <button className={styles.personalInfoSave} type="button" onClick={save} disabled={pending} aria-busy={pending}>저장</button>
        <button className={styles.personalInfoCancel} type="button" onClick={() => { setEditing(false); setError('') }} disabled={pending}>취소</button>
      </div>
    </div>}
    {error && <p className={common.formError} role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>
}
