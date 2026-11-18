import { useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { Button, Card } from '@/components/ui'
import common from '@/styles/common.module.css'
import { SUPPORT_NOTICE, useAdminInquiries } from './api'
import { InquiryDetail, InquiryList } from './InquiryViews'
import styles from './Support.module.css'

export function AdminInquiries() {
  const user = useAuthStore((s) => s.user)
  const { inquiries, loading, error } = useAdminInquiries()
  const [selected, setSelected] = useState<string | null>(null)
  if (user?.role !== 'ADMIN') return null
  const inquiry = inquiries.find((q) => q.id === selected)
  return (
    <div className={styles.wrap}>
      <p className={styles.notice}>{SUPPORT_NOTICE}</p>
      {inquiry ? <>
        <div><Button variant="line" onClick={() => setSelected(null)}>← 문의 목록</Button></div>
        <InquiryDetail inquiry={inquiry} admin />
      </> : <Card title={`문의 관리 · 답변 대기 ${inquiries.filter((q) => !q.answer).length}건`}>
        {loading ? <p className={common.empty}>문의를 불러오고 있어요.</p> : error ? <p className={common.formError} role="alert">{error}</p> : (
          <InquiryList inquiries={inquiries} onSelect={setSelected} admin />
        )}
      </Card>}
    </div>
  )
}
