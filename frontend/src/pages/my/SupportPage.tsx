import { useState, type FormEvent } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/features/auth'
import { INQUIRY_CATEGORIES, InquiryDetail, InquiryList, SUPPORT_NOTICE, useSupportStore, visibleInquiries, type InquiryCategory } from '@/features/support'
import styles from '@/features/support/Support.module.css'
import common from '@/styles/common.module.css'

const BASE = '/my/settings/support'

export function SupportPage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}><h2>고객센터</h2><Link className={styles.link} to="/my/settings">내 정보로</Link></div>
      <p className={styles.notice}>{SUPPORT_NOTICE}</p>
      <Routes>
        <Route index element={<MyInquiries />} />
        <Route path="new" element={<NewInquiry />} />
        <Route path=":id" element={<MyInquiry />} />
      </Routes>
    </div>
  )
}

function MyInquiries() {
  const user = useAuthStore((s) => s.user)
  const inquiries = useSupportStore((s) => s.inquiries)
  const navigate = useNavigate()
  return (
    <Card title="내 문의 내역" actions={<Button onClick={() => navigate(`${BASE}/new`)}>문의하기</Button>}>
      <InquiryList inquiries={visibleInquiries(inquiries, user)} onSelect={(id) => navigate(`${BASE}/${id}`)} />
    </Card>
  )
}

function MyInquiry() {
  const { id } = useParams()
  const user = useAuthStore((s) => s.user)
  const inquiries = useSupportStore((s) => s.inquiries)
  const inquiry = visibleInquiries(inquiries, user).find((q) => q.id === id)
  return <>
    <Link className={styles.link} to={BASE}>← 문의 목록</Link>
    {inquiry ? <InquiryDetail inquiry={inquiry} /> : <Card title="문의를 찾을 수 없어요"><p>본인이 작성한 문의만 확인할 수 있어요.</p></Card>}
  </>
}

function NewInquiry() {
  const navigate = useNavigate()
  const add = useSupportStore((s) => s.add)
  const [category, setCategory] = useState<InquiryCategory>('이용 문의')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    try {
      const id = add({ category, title, content })
      navigate(`${BASE}/${id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '문의를 저장하지 못했어요.')
    }
  }
  return (
    <Card title="문의하기">
      <form className={common.form} onSubmit={submit}>
        <label>문의 유형<select value={category} onChange={(e) => setCategory(e.target.value as InquiryCategory)}>{INQUIRY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>제목<input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="문의 제목을 입력해 주세요." /></label>
        <label>내용<textarea required maxLength={3000} rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="궁금한 점이나 문제가 발생한 상황을 적어 주세요." /><span>{content.length.toLocaleString()} / 3,000자</span></label>
        {error && <p className={common.formError} role="alert">{error}</p>}
        <div className={styles.actions}><Button variant="line" onClick={() => navigate(BASE)}>취소</Button><Button type="submit" disabled={!title.trim() || !content.trim()}>문의 등록</Button></div>
      </form>
    </Card>
  )
}
