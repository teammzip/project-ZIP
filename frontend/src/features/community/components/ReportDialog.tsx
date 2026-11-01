import { useState, type FormEvent } from 'react'
import { Button, Modal } from '@/components/ui'
import { REPORT_REASONS, type ReportReason } from '../reports'
import styles from './Community.module.css'

type Props = {
  /** 무엇을 신고하는지: '글' 또는 '댓글' (둘 다 받침이 있어 '을') */
  what: string
  onClose: () => void
  onSubmit: (reason: ReportReason, detail: string) => void
}

/** 신고 창: 사유 하나 고르기 + 자세한 내용(기타는 꼭 적기) */
export function ReportDialog({ what, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [detail, setDetail] = useState('')
  const needDetail = reason === 'OTHER'
  const ready = !!reason && (!needDetail || !!detail.trim())

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!reason || !ready) return
    onSubmit(reason, detail.trim())
  }

  return (
    <Modal open onClose={onClose} title={`${what} 신고`}>
      <form className={styles.report} onSubmit={submit}>
        <h3>이 {what}을 신고할까요?</h3>
        <p>신고 사유를 골라 주세요. 운영자가 확인한 뒤 운영 정책에 따라 처리해요.</p>
        <div className={styles.reasons} role="radiogroup" aria-label="신고 사유">
          {REPORT_REASONS.map((r) => (
            <label key={r.code} className={styles.reason}>
              <input type="radio" name="report-reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} />
              {r.label}
            </label>
          ))}
        </div>
        <label className={styles.reportDetail}>
          자세한 내용 {needDetail ? '(필수)' : '(선택)'}
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} rows={3} placeholder="어떤 점이 문제인지 적어 주시면 확인에 도움이 돼요." required={needDetail} />
        </label>
        <div className={styles.reportBtns}>
          <Button variant="line" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" variant="danger" disabled={!ready}>
            신고하기
          </Button>
        </div>
      </form>
    </Modal>
  )
}
