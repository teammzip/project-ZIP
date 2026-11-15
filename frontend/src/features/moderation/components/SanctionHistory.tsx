import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { fmtAt, isActive, banLabel, toSanctionEntry } from '../rules'
import { useBanStore, type SanctionEntry } from '../store'
import styles from './Moderation.module.css'

type ServerSanction = { id: string; type: 'WARNING' | 'SUSPEND' | 'BAN'; days: number | null; reason: string; at: string; revoked: boolean }

/** 내가 받은 경고 · 정지 내역 창 (내 정보 화면). 최근 것이 위로.
 * 가짜 API 모드는 이 브라우저 기록, 서버 모드는 GET /api/me/sanctions */
export function SanctionHistoryDialog({ nick, open, onClose }: { nick?: string; open: boolean; onClose: () => void }) {
  return isMockApi ? <LocalHistory nick={nick} open={open} onClose={onClose} /> : <ServerHistory open={open} onClose={onClose} />
}

function ServerHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const list = useQuery({
    queryKey: ['me', 'sanctions', user?.id],
    queryFn: async () => (await apiClient.get<ServerSanction[]>('/me/sanctions')).data,
    enabled: open && !!user,
  })
  const history = (list.data ?? []).map<SanctionEntry & { revoked?: boolean }>((s) => ({ ...toSanctionEntry(s, s.at), revoked: s.revoked }))
  return (
    <HistoryModal open={open} onClose={onClose} warns={user?.warnCount ?? 0} bans={user?.banCount ?? 0} active={null}
      history={history} note={list.isLoading ? '불러오는 중…' : list.isError ? '내역을 불러오지 못했어요.' : ''} />
  )
}

function LocalHistory({ nick, open, onClose }: { nick?: string; open: boolean; onClose: () => void }) {
  const record = useBanStore((s) => (nick ? s.records[nick] : undefined))
  const history = [...(record?.history ?? [])].sort((a, b) => b.at - a.at)
  return (
    <HistoryModal open={open} onClose={onClose} warns={record?.warns ?? 0} bans={record?.count ?? 0}
      active={isActive(record) ? banLabel(record) : null} history={history} note="" />
  )
}

function HistoryModal({ open, onClose, warns, bans, active, history, note }: {
  open: boolean
  onClose: () => void
  warns: number
  bans: number
  active: string | null
  history: Array<SanctionEntry & { revoked?: boolean }>
  note: string
}) {
  return (
    <Modal open={open} onClose={onClose} title="받은 경고 · 정지 내역">
      <div className={styles.history}>
        <h3>받은 경고 · 정지 내역</h3>
        <p className={styles.historySum}>
          경고 <b>{warns}회</b> · 정지 <b>{bans}회</b>
          {active && <em> · 지금 {active}</em>}
        </p>
        {note && <p className={styles.historyNote}>{note}</p>}
        <ul>
          {history.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span className={e.warn ? styles.tagWarn : styles.tagBan}>{e.warn ? '경고' : e.days ? `${e.days}일 정지` : '영구 정지'}</span>
              <span className={styles.historyMain}>
                <b>{e.reason || '운영 정책 위반'}</b>
                <small>
                  {fmtAt(e.at)}
                  {e.revoked && ' · 해제됨'}
                </small>
              </span>
            </li>
          ))}
          {!history.length && !note && <li className={styles.historyEmpty}>받은 경고나 정지가 없어요.</li>}
        </ul>
        <p className={styles.historyNote}>경고가 계속 쌓이면 이용이 정지될 수 있어요. 이의가 있으면 고객센터로 알려 주세요.</p>
      </div>
    </Modal>
  )
}
