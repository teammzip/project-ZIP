import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { NoticeDetail, NoticeList, reopenNoticePopups, useNotice, useNotices, usePopupNotices } from '@/features/notice'
import styles from '@/features/notice/Notice.module.css'
import common from '@/styles/common.module.css'

const BASE = '/my/settings/notices'

/** 공지사항: 목록 · 내용 (쓰기는 관리자 화면의 '공지 관리') */
export function NoticePage() {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}><h2>공지사항</h2><Link className={styles.link} to="/my/settings">내 정보로</Link></div>
      <Routes>
        <Route index element={<Notices />} />
        <Route path=":id" element={<OneNotice />} />
      </Routes>
    </div>
  )
}

function Notices() {
  const { notices, loading, error } = useNotices()
  const navigate = useNavigate()
  const popups = usePopupNotices()
  return (
    <Card title="공지 목록" actions={popups.length ? <Button variant="line" onClick={reopenNoticePopups}>팝업 공지 다시 보기</Button> : undefined}>
      {loading ? <p className={common.empty}>공지를 불러오고 있어요.</p> : error ? <p className={common.formError} role="alert">{error}</p> : (
        <NoticeList notices={notices} onSelect={(id) => navigate(`${BASE}/${id}`)} />
      )}
    </Card>
  )
}

function OneNotice() {
  const { id } = useParams()
  const { notice, loading, error } = useNotice(id)
  return <>
    <Link className={styles.link} to={BASE}>← 공지 목록</Link>
    {notice ? <NoticeDetail notice={notice} /> : loading ? <p className={common.empty}>공지를 불러오고 있어요.</p> : (
      <Card title="공지를 찾을 수 없어요"><p>{error || '지워졌거나 없는 공지예요.'}</p></Card>
    )}
  </>
}
