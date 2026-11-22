import { useState, type FormEvent } from 'react'
import { useAuthStore } from '@/features/auth'
import { Button, Card, Checkbox, Modal } from '@/components/ui'
import { isMockApi } from '@/lib/apiMode'
import common from '@/styles/common.module.css'
import { useNotice, useNoticeActions, useNotices } from './api'
import { NoticePopupCard } from './NoticePopupCard'
import { NoticeList } from './NoticeViews'
import { BODY_MAX, TITLE_MAX, draftError, type Notice } from './store'
import styles from './Notice.module.css'

/** 관리자 화면 '공지 관리' 탭: 왼쪽 목록, 오른쪽 새 공지 쓰기 · 고르면 고치기 · 지우기 */
export function AdminNotices() {
  const user = useAuthStore((s) => s.user)
  const { notices, loading, error } = useNotices()
  const [selected, setSelected] = useState<string | null>(null)
  if (user?.role !== 'ADMIN') return null
  return (
    <div className={styles.admin}>
      <Card title={`공지 ${notices.length}개`} actions={selected ? <Button variant="line" onClick={() => setSelected(null)}>+ 새 공지</Button> : undefined}>
        {loading ? <p className={common.empty}>공지를 불러오고 있어요.</p> : error ? <p className={common.formError} role="alert">{error}</p> : (
          <NoticeList notices={notices} onSelect={setSelected} selected={selected ?? undefined} showPopup />
        )}
      </Card>
      {selected ? <EditNotice key={selected} id={selected} onDone={() => setSelected(null)} /> : <NoticeForm key="new" onDone={() => undefined} />}
    </div>
  )
}

/** 고를 공지를 (서버 모드면 내용까지) 불러와서 고치기 폼 */
function EditNotice({ id, onDone }: { id: string; onDone: () => void }) {
  const { notice, loading, error } = useNotice(id)
  if (loading) return <Card title="공지 고치기"><p className={common.empty}>불러오고 있어요.</p></Card>
  if (!notice) return <Card title="공지 고치기"><p className={common.formError} role="alert">{error || '공지를 찾을 수 없어요.'}</p></Card>
  return <NoticeForm notice={notice} onDone={onDone} />
}

function NoticeForm({ notice, onDone }: { notice?: Notice; onDone: () => void }) {
  const { create, update, remove } = useNoticeActions()
  const [title, setTitle] = useState(notice?.title ?? '')
  const [body, setBody] = useState(notice?.body ?? '')
  const [pinned, setPinned] = useState(notice?.pinned ?? false)
  const [popup, setPopup] = useState(notice?.popup ?? false)
  const [notify, setNotify] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [saving, setSaving] = useState(false)
  const [bigPreview, setBigPreview] = useState(false)
  // 미리보기 날짜 (새 공지면 오늘)
  const [today] = useState(() => new Date().toISOString())

  const run = async (work: () => Promise<unknown>, message: string) => {
    setSaving(true)
    setError('')
    setDone('')
    try {
      await work()
      setDone(message)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const draft = { title, body, pinned, popup }
    const problem = draftError(draft)
    if (problem) return setError(problem)
    if (notice) {
      await run(() => update(notice.id, draft), '공지를 고쳤어요.')
    } else if (await run(() => create(draft, notify), notify ? '공지를 올리고 회원들에게 알림을 보냈어요.' : '공지를 올렸어요.')) {
      setTitle('')
      setBody('')
      setPinned(false)
      setPopup(false)
      setNotify(false)
    }
  }

  const del = async () => {
    if (!notice || !window.confirm(`"${notice.title}" 공지를 지울까요? 지우면 되돌릴 수 없어요.`)) return
    if (await run(() => remove(notice.id), '공지를 지웠어요.')) onDone()
  }

  const previewItems = [{ id: notice?.id ?? "new", title, body, createdAt: notice?.createdAt ?? today }]

  return (
    <div className={styles.list}>
    <Card title={notice ? '공지 고치기' : '새 공지 쓰기'}>
      <form className={common.form} onSubmit={submit}>
        <label>제목<input required maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 11월 서비스 점검 안내" /></label>
        <label>내용<textarea required maxLength={BODY_MAX} rows={10} value={body} onChange={(e) => setBody(e.target.value)} placeholder="회원들에게 알릴 내용을 적어 주세요." />
          <span className={styles.count}>{body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}자</span>
        </label>
        <Checkbox label="목록 맨 위에 고정" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        <Checkbox label="앱을 열면 팝업으로 보여 주기 (회원이 일주일 동안 보지 않기 · 닫기를 고를 수 있어요)" checked={popup} onChange={(e) => setPopup(e.target.checked)} />
        {!notice && !isMockApi && <Checkbox label="회원들에게 알림 보내기 (알림을 켠 회원 모두)" checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
        {error && <p className={common.formError} role="alert">{error}</p>}
        {done && <p className={common.empty} role="status">{done}</p>}
        <div className={styles.actions}>
          {notice && <Button variant="line" onClick={del} disabled={saving}>지우기</Button>}
          {notice && <Button variant="line" onClick={onDone} disabled={saving}>닫기</Button>}
          <Button type="submit" disabled={!title.trim() || !body.trim() || saving}>{saving ? '저장 중…' : notice ? '고친 내용 저장' : '공지 올리기'}</Button>
        </div>
      </form>
    </Card>

    {/* 회원에게 뜰 팝업 미리보기 (쓰는 대로 바뀜) */}
    <Card title="미리보기" actions={<Button variant="line" onClick={() => setBigPreview(true)}>실제 팝업으로 보기</Button>}>
      <div className={styles.previewStage}>
        <NoticePopupCard items={previewItems} onClose={() => undefined} onHideWeek={() => undefined} />
      </div>
      <p className={styles.previewNote}>{popup ? '앱을 열면 회원에게 이렇게 떠요.' : '"팝업으로 보여 주기"를 켜면 앱을 열 때 회원에게 이렇게 떠요. 끄면 공지사항 목록에만 보여요.'}</p>
    </Card>
    <Modal open={bigPreview} onClose={() => setBigPreview(false)} title="공지 팝업 미리보기" className={styles.popup} hideClose>
      <NoticePopupCard items={previewItems} onClose={() => setBigPreview(false)} onHideWeek={() => setBigPreview(false)} />
    </Modal>
    </div>
  )
}
