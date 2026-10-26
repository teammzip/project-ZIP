import { useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { Button, Card } from '@/components/ui'
import { InquiryDetail, InquiryList, SUPPORT_NOTICE } from './InquiryViews'
import { useSupportStore } from './store'
import styles from './Support.module.css'

export function AdminInquiries() {
  const user = useAuthStore((s) => s.user)
  const inquiries = useSupportStore((s) => s.inquiries)
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
        <InquiryList inquiries={inquiries} onSelect={setSelected} admin />
      </Card>}
    </div>
  )
}
