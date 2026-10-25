import { useState } from 'react'
import { Button } from '@/components/ui'
import { fmtAt } from '../rules'
import type { BanRecord } from '../store'
import styles from './Moderation.module.css'

const DAY = 86400000

type Props = {
  /** 정지 기록. 없으면 보여 주기용 예시(3일 정지) */
  record: BanRecord | null
  onLogout: () => void
  logoutPending?: boolean
}

/** 이용 정지 안내: 정지된 계정은 앱 대신 이 안내만 봄. 로그아웃 · 문의만 가능 */
export function SuspendedNotice({ record, onLogout, logoutPending }: Props) {
  const [now] = useState(() => Date.now())
  const bans = record?.history.filter((e) => !e.warn) ?? []
  const perm = record?.perm ?? false
  const until = record ? record.until : now + 3 * DAY
  const why = record ? (bans.at(-1)?.reason ?? '운영 정책 위반') : '커뮤니티 운영 정책 위반(욕설·비방)'
  const count = record ? record.count || bans.length || 1 : 2
  const term = perm || !until ? '영구 정지' : `${fmtAt(until)} 해제 (${Math.max(1, Math.ceil((until - now) / DAY))}일 남음)`

  return (
    <main className={styles.susp} role="alert">
      <div className={styles.suspIco} aria-hidden="true">
        🚫
      </div>
      <h1>이용이 정지된 계정이에요</h1>
      <p className={styles.lead}>
        운영 정책을 위반해 서비스 이용이 제한되었어요.
        <br />
        정지 기간 동안에는 로그인·글쓰기 등 모든 기능을 사용할 수 없어요.
      </p>
      <dl className={styles.list}>
        <div>
          <dt>정지 기간</dt>
          <dd className={styles.bad}>{term}</dd>
        </div>
        <div>
          <dt>사유</dt>
          <dd>{why}</dd>
        </div>
        <div>
          <dt>정지 횟수</dt>
          <dd>{count}회</dd>
        </div>
      </dl>
      <p className={styles.note}>
        {perm ? '영구 정지는 자동으로 풀리지 않아요. 이의가 있으면 문의하기로 알려 주세요.' : '정지 기간이 끝나면 자동으로 다시 이용할 수 있어요. 이의가 있으면 문의하기로 알려 주세요.'}
      </p>
      <div className={styles.actions}>
        <a className={styles.line} href="mailto:help@zip.example?subject=이용 정지 문의">
          문의하기
        </a>
        <Button className={styles.dark} onClick={onLogout} loading={logoutPending}>
          로그아웃
        </Button>
      </div>
    </main>
  )
}
