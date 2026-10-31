import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Modal } from '@/components/ui'
import { useChatStore } from '@/features/ai'
import { LoginBadge, LoginMethod, PasswordChangeForm, useAuthStore, useLogout, useUpdateMe, useWithdraw } from '@/features/auth'
import { useCommunityStore } from '@/features/community'
import { LegalLinks } from '@/features/legal'
import { BudgetSummaryCard, LifeInfoForm, LifeStats, NotiSwitch, RegionVerifyDialog, useLifeStore, useLifeSummary, useRegionVerify } from '@/features/life'
import { useMapStore } from '@/features/map'
import { useMemoStore } from '@/features/memo'
import { useHousingSurveyStore } from '@/features/onboarding'
import { useAge } from '@/lib/useAge'
import { ProfileEditor, ProfileHero, useProfileStore } from '@/features/profile'
import { getErrorMessage } from '@/lib/apiClient'
import { remove } from '@/lib/storage'
import common from '@/styles/common.module.css'
import styles from './SettingsPage.module.css'

/** 이 기기에 저장된 앱 기록(일정·가계부·알림·커뮤니티 글·AI 대화·메모·프로필·설정)을 처음 상태로 */
function resetAppData() {
  useLifeStore.getState().reset()
  useCommunityStore.getState().reset()
  useChatStore.getState().reset()
  useMemoStore.getState().reset()
  useProfileStore.getState().reset()
  useMapStore.getState().resetAll()
}

const TILES = [
  { to: '/my/calendar', ico: '📅', label: '일정' },
  { to: '/my/budget', ico: '💰', label: '가계부' },
  { to: '/my/memo', ico: '📝', label: '메모' },
  { to: '/community', ico: '💬', label: '동네 이야기' },
]

type Sheet = 'profile' | 'life' | 'verify' | 'password' | 'reset' | 'withdraw' | null

/* 내 정보
 * - PC(1100px 이상): 왼쪽 = 프로필 · 수입·지출 카드 / 오른쪽 = 이번 달 요약 · 바로 가기 · 계정·설정
 * - 모바일: 위에서부터 한 줄로
 * 프로필 편집 · 동네 인증 · 생활 정보 · 비밀번호 변경은 창으로 열고, 로그아웃 · 초기화 · 탈퇴는 카드 밖 맨 아래 작은 글씨 */
export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const survey = useHousingSurveyStore((s) => s.survey)
  const birth = survey?.userId === user?.id ? survey?.birth ?? '' : ''
  const { age } = useAge(birth)
  const { region, verified, left } = useRegionVerify()
  const postCount = useCommunityStore((s) => s.posts.filter((p) => p.mine).length)
  const lifeSummary = useLifeSummary()
  const updateMe = useUpdateMe()
  const logout = useLogout()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState('')
  const name = user?.nickname ?? '자취생'
  const close = () => setSheet(null)
  const notify = (text: string) => {
    setToast(text)
    setTimeout(() => setToast((t) => (t === text ? '' : t)), 1800)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.side}>
        <ProfileHero name={name} region={region} regionVerified={verified} badge={<LoginBadge />} onEdit={() => setSheet('profile')} />
        <BudgetSummaryCard />
      </div>

      <div className={styles.main}>
        <LifeStats postCount={postCount} />

        <Card title="나의 자취 관리">
          <div className={styles.tiles}>
            {TILES.map((t) => (
              <Link key={t.to} to={t.to} className={styles.tile}>
                <span aria-hidden="true">{t.ico}</span>
                {t.label}
              </Link>
            ))}
          </div>
        </Card>

        <Card title="계정 · 설정">
          <ul className={styles.list}>
            {age !== null && <li>
              <div className={styles.row}>
                <span className={styles.ico}>🎂</span>
                <span className={styles.grow}>만 {age}세<small>생년월일 {birth} · 생일에 자동 갱신</small></span>
              </div>
            </li>}
            <li>
              <LoginMethod />
            </li>
            {user?.provider === 'email' && (
              <li>
                <button type="button" className={styles.row} onClick={() => setSheet('password')}>
                  <span className={styles.ico}>🔒</span>
                  <span className={styles.grow}>비밀번호 변경</span>
                  <i className={styles.chev} aria-hidden="true" />
                </button>
              </li>
            )}
            <li>
              <button type="button" className={styles.row} onClick={() => setSheet('verify')}>
                <span className={styles.ico}>📍</span>
                <span className={styles.grow}>
                  동네 인증<small>{verified ? `${region} · ${left}일 남음` : region ? `${region} · 인증하면 동네생활에 글을 쓸 수 있어요` : '우리 동네를 먼저 정해 주세요'}</small>
                </span>
                {verified ? <span className={styles.okTag}>인증 완료</span> : <span className={styles.needTag}>인증하기</span>}
              </button>
            </li>
            <li>
              <button type="button" className={styles.row} onClick={() => setSheet('life')}>
                <span className={styles.ico}>🏠</span>
                <span className={styles.grow}>
                  생활 정보<small>{lifeSummary}</small>
                </span>
                <i className={styles.chev} aria-hidden="true" />
              </button>
            </li>
            <li>
              <label className={styles.row}>
                <span className={styles.ico}>🔔</span>
                <span className={styles.grow}>
                  알림 받기<small>일정 · 쓰레기 배출 · 월세 알림</small>
                </span>
                <NotiSwitch onChange={(on) => notify(on ? '알림을 켰어요.' : '알림을 껐어요.')} />
              </label>
            </li>
          </ul>
          {updateMe.isError && <p className={styles.error}>{getErrorMessage(updateMe.error)}</p>}
        </Card>

        <Card title="고객센터">
          <Link to="/my/settings/support" className={styles.row}>
            <span className={styles.ico}>🎧</span>
            <span className={styles.grow}>문의하기 · 내 문의 내역<small>문의 내용과 답변을 확인할 수 있어요.</small></span>
            <i className={styles.chev} aria-hidden="true" />
          </Link>
        </Card>

        {/* 카드 밖 맨 아래 작은 글씨 */}
        <div className={styles.bottom}>
          <div className={styles.foot}>
            <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
              로그아웃
            </button>
            <button type="button" onClick={() => setSheet('reset')} title="이 기기에 저장된 기록을 처음 상태로">
              데이터 초기화
            </button>
            <button type="button" className={styles.danger} onClick={() => setSheet('withdraw')}>
              회원 탈퇴
            </button>
          </div>
          <LegalLinks className={styles.legal} />
        </div>
      </div>

      <ProfileEditor open={sheet === 'profile'} onClose={close} name={name} onSaveName={(nickname) => updateMe.mutate({ nickname })} onSaved={() => notify('프로필을 바꿨어요.')} />

      <Modal open={sheet === 'life'} onClose={close} title="생활 정보">
        <h3 className={styles.sheetTitle}>생활 정보</h3>
        <LifeInfoForm
          onSaved={() => {
            close()
            notify('저장됐어요.')
          }}
        />
      </Modal>

      <RegionVerifyDialog open={sheet === 'verify'} onClose={close} onVerified={() => notify('동네 인증을 마쳤어요.')} />

      <Modal open={sheet === 'password'} onClose={close} title="비밀번호 변경">
        <h3 className={styles.sheetTitle}>비밀번호 변경</h3>
        <PasswordChangeForm />
      </Modal>

      <Modal open={sheet === 'reset'} onClose={close} title="데이터 초기화">
        <div className={styles.dialog}>
          <h3>모든 데이터를 초기화할까요?</h3>
          <p>일정, 가계부, 알림 읽음 상태, 커뮤니티 글, AI 대화, 메모, 프로필, 설정을 이 기기에서 처음 상태로 되돌려요.</p>
          <div className={styles.dialogActions}>
            <Button variant="line" onClick={close}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetAppData()
                close()
                notify('처음 상태로 되돌렸어요.')
              }}
            >
              초기화하기
            </Button>
          </div>
        </div>
      </Modal>

      <WithdrawDialog open={sheet === 'withdraw'} onClose={close} />

      {toast && (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

/** 회원 탈퇴 확인 창: 동의에 체크해야 "탈퇴하기"가 눌림. 끝나면 닫을 수 없고 처음 화면으로만 갈 수 있음 */
function WithdrawDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const withdraw = useWithdraw()
  const [agree, setAgree] = useState(false)
  const done = withdraw.isSuccess

  const confirm = () =>
    withdraw.mutate(undefined, {
      onSuccess: () => {
        resetAppData()
        for (const key of ['zip-life', 'zip-posts', 'zip-ai-chat', 'zip-memos', 'zip-profile', 'zip-map']) remove(key)
      },
    })
  const finish = () => {
    clearAuth()
    navigate('/start', { replace: true })
  }
  const close = () => {
    setAgree(false)
    withdraw.reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title={done ? '탈퇴 완료' : '회원 탈퇴 확인'} dismissible={!done}>
      <div className={styles.dialog}>
        <h3>{done ? '탈퇴가 완료됐어요' : '정말 탈퇴할까요?'}</h3>
        <p>
          {done
            ? '이용해 주셔서 감사합니다. 저장된 정보를 모두 삭제했어요. 언제든 다시 가입할 수 있어요.'
            : '탈퇴하면 계정과 이 기기에 저장된 일정, 가계부(수입·지출), 알림 상태, 커뮤니티 글, AI 대화, 메모, 프로필, 설정이 모두 삭제되고 되돌릴 수 없어요.'}
        </p>
        {!done && (
          <label className={styles.agree}>
            <input type="checkbox" className={common.checkbox} checked={agree} onChange={(e) => setAgree(e.target.checked)} />위 내용을 확인했고, 탈퇴에 동의해요
          </label>
        )}
        {withdraw.isError && <p className={styles.error}>{getErrorMessage(withdraw.error)}</p>}
        <div className={styles.dialogActions}>
          {done ? (
            <Button onClick={finish}>처음 화면으로</Button>
          ) : (
            <>
              <Button variant="line" onClick={close}>
                취소
              </Button>
              <Button className={styles.solidDanger} disabled={!agree} loading={withdraw.isPending} onClick={confirm}>
                탈퇴하기
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
