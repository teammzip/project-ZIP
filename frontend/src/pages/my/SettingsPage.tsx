import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Modal } from '@/components/ui'
import { useChatStore } from '@/features/ai'
import { useAuthStore, useLogout, useUpdateMe, useWithdraw } from '@/features/auth'
import { useCommunityStore } from '@/features/community'
import { LegalLinks } from '@/features/legal'
import { SettingsForm, useLifeStore } from '@/features/life'
import { getErrorMessage } from '@/lib/apiClient'
import { remove } from '@/lib/storage'
import common from '@/styles/common.module.css'
import styles from './SettingsPage.module.css'

/** 이 기기에 저장된 앱 기록(일정·할 일·가계부·알림·커뮤니티 글·AI 대화·설정)을 처음 상태로 */
function resetAppData() {
  useLifeStore.getState().reset()
  useCommunityStore.getState().reset()
  useChatStore.getState().reset()
}

/* 내 정보: 설정 저장, 데이터 초기화, 회원 탈퇴 */
export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const updateMe = useUpdateMe()
  const logout = useLogout()
  const [confirmReset, setConfirmReset] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  return (
    <Card title="내 정보 · 설정" className={common.narrow}>
      <SettingsForm name={user?.nickname ?? ''} onSaveName={(nickname) => updateMe.mutate({ nickname })} />
      {updateMe.isError && <p className={styles.error}>{getErrorMessage(updateMe.error)}</p>}

      <hr className={styles.hr} />
      <div className={styles.account}>
        <p className={styles.desc}>
          <b>{user?.email}</b> 로 로그인했어요.
        </p>
        <Button variant="line" onClick={() => logout.mutate()} loading={logout.isPending}>
          로그아웃
        </Button>
      </div>

      <hr className={styles.hr} />
      <p className={styles.desc}>일정, 할 일, 가계부, 알림 읽음 상태, 커뮤니티 글, AI 대화, 설정을 이 기기에서 처음 상태로 되돌립니다.</p>
      {confirmReset ? (
        <div className={common.actions}>
          <Button
            variant="danger"
            onClick={() => {
              resetAppData()
              setConfirmReset(false)
            }}
          >
            정말 초기화하기
          </Button>
          <Button variant="line" onClick={() => setConfirmReset(false)}>
            취소
          </Button>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirmReset(true)}>
          모든 데이터 초기화
        </Button>
      )}

      <hr className={styles.hr} />
      <p className={styles.desc}>회원 탈퇴를 하면 계정과 이 기기에 저장된 모든 정보가 삭제되고, 처음 화면으로 돌아가요.</p>
      <Button variant="danger" onClick={() => setWithdrawOpen(true)}>
        회원 탈퇴
      </Button>
      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />

      <hr className={styles.hr} />
      <LegalLinks className={styles.desc} />
    </Card>
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
        for (const key of ['zip-life', 'zip-posts', 'zip-ai-chat']) remove(key)
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
            : '탈퇴하면 계정과 이 기기에 저장된 일정, 할 일, 가계부(수입·지출), 알림 상태, 커뮤니티 글, AI 대화, 설정이 모두 삭제되고 되돌릴 수 없어요.'}
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
