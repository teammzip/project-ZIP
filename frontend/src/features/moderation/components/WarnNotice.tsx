import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'
import { apiClient } from '@/lib/apiClient'
import { readJSON, writeJSON } from '@/lib/storage'
import { isMockApi } from '@/lib/apiMode'
import { useBanStore } from '../store'
import styles from './Moderation.module.css'

/* 경고 안내 창 (팀장님 시안 components/warn-notice.js): 운영자에게 경고를 받았으면 앱에 들어올 때 한 번 보여 줌.
 * - 가짜 API 모드: 확인한 경고 횟수를 'zipban-warn-seen' 에 남겨, 새 경고가 생겼을 때만 다시 뜸 (zip- 로 시작하지 않아 데이터 초기화로 안 지워짐)
 * - 서버 모드: GET /api/auth/me 의 unseenWarnings(아직 확인 안 한 경고)가 있으면 뜨고, "확인했어요"는 POST /api/me/warnings/seen
 * - 주소에 ?demo=warn 을 붙이면 예시 경고를 보여 줌 (시안의 "경고창" 예시 버튼과 같음)
 * - 정지는 이 창이 아니라 별도 화면(/suspended) */
const SEEN_KEY = 'zipban-warn-seen'

export function WarnNotice({ nick }: { nick?: string }) {
  return isMockApi ? <LocalWarnNotice nick={nick} /> : <ServerWarnNotice />
}

/** 서버 모드: 아직 확인 안 한 경고 */
function ServerWarnNotice() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [busy, setBusy] = useState(false)
  const unseen = user?.unseenWarnings ?? []
  if (!user || !unseen.length) return null
  const ok = async () => {
    setBusy(true)
    try {
      await apiClient.post('/me/warnings/seen', { ids: unseen.map((w) => w.id) })
    } catch {
      // 실패해도 이번에는 닫음 (다음 로그인 때 다시 뜸)
    }
    updateUser({ ...user, unseenWarnings: [] })
    setBusy(false)
  }
  return <WarnModal why={unseen.at(-1)?.reason || '운영 정책 위반'} count={user.warnCount ?? unseen.length} onOk={() => void ok()} busy={busy} />
}

function LocalWarnNotice({ nick }: { nick?: string }) {
  const record = useBanStore((s) => (nick ? s.records[nick] : undefined))
  const [params] = useSearchParams()
  const demo = params.get('demo') === 'warn'
  const [seen, setSeen] = useState(() => readJSON<Record<string, number>>(SEEN_KEY) ?? {})
  const [demoClosed, setDemoClosed] = useState(false)

  const warns = record?.warns ?? 0
  const real = !!nick && warns > (seen[nick] ?? 0)
  if (!real && !(demo && !demoClosed)) return null

  const lastWarn = record?.history.filter((e) => e.warn).at(-1)
  const why = real ? (lastWarn?.reason ?? '운영 정책 위반') : '커뮤니티 운영 정책 위반(욕설·비방)'
  const count = real ? warns : 2
  const ok = () => {
    if (real && nick) {
      const next = { ...seen, [nick]: warns }
      writeJSON(SEEN_KEY, next)
      setSeen(next)
    } else setDemoClosed(true)
  }
  return <WarnModal why={why} count={count} onOk={ok} />
}

function WarnModal({ why, count, onOk, busy }: { why: string; count: number; onOk: () => void; busy?: boolean }) {
  return (
    <Modal open onClose={onOk} title="운영 정책 경고" dismissible={false} className={styles.warnBox}>
      <div className={styles.warnIco} aria-hidden="true">
        ⚠️
      </div>
      <h3>운영 정책 경고를 받았어요</h3>
      <p>커뮤니티 운영 정책에 어긋나는 활동이 확인되어 경고가 부여되었어요.</p>
      <dl className={styles.list}>
        <div>
          <dt>사유</dt>
          <dd>{why}</dd>
        </div>
        <div>
          <dt>누적 경고</dt>
          <dd>{count}회</dd>
        </div>
      </dl>
      <p className={styles.warnNote}>경고가 계속 쌓이면 이용이 정지될 수 있어요.</p>
      <Button block onClick={onOk} disabled={busy}>
        확인했어요
      </Button>
    </Modal>
  )
}
