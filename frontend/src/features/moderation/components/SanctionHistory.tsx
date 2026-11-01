import { Modal } from '@/components/ui'
import { fmtAt, isActive, banLabel } from '../rules'
import { useBanStore } from '../store'
import styles from './Moderation.module.css'

/** 내가 받은 경고 · 정지 내역 창 (내 정보 화면). 최근 것이 위로 */
export function SanctionHistoryDialog({ nick, open, onClose }: { nick?: string; open: boolean; onClose: () => void }) {
  const record = useBanStore((s) => (nick ? s.records[nick] : undefined))
  const history = [...(record?.history ?? [])].sort((a, b) => b.at - a.at)
  return (
    <Modal open={open} onClose={onClose} title="받은 경고 · 정지 내역">
      <div className={styles.history}>
        <h3>받은 경고 · 정지 내역</h3>
        <p className={styles.historySum}>
          경고 <b>{record?.warns ?? 0}회</b> · 정지 <b>{record?.count ?? 0}회</b>
          {isActive(record) && <em> · 지금 {banLabel(record)}</em>}
        </p>
        <ul>
          {history.map((e) => (
            <li key={e.at}>
              <span className={e.warn ? styles.tagWarn : styles.tagBan}>{e.warn ? '경고' : e.days ? `${e.days}일 정지` : '영구 정지'}</span>
              <span className={styles.historyMain}>
                <b>{e.reason || '운영 정책 위반'}</b>
                <small>{fmtAt(e.at)}</small>
              </span>
            </li>
          ))}
          {!history.length && <li className={styles.historyEmpty}>받은 경고나 정지가 없어요.</li>}
        </ul>
        <p className={styles.historyNote}>경고가 계속 쌓이면 이용이 정지될 수 있어요. 이의가 있으면 고객센터로 알려 주세요.</p>
      </div>
    </Modal>
  )
}

