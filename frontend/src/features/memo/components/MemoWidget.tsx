import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cx } from '@/lib/cx'
import { useToday } from '@/lib/useToday'
import { colorOf, previewLines, sortMemos, titleOf, whenText } from '../lib'
import { useMemoStore } from '../store'
import styles from './MemoWidget.module.css'

/** 홈 메모 위젯: 노란 머리줄 + 줄 노트에 대표 메모(고정 또는 최근) + 그다음 메모 3개 + 빠른 메모.
 * 대표 메모가 체크리스트면 여기서 바로 체크. 메모를 누르면 마이페이지 메모장에서 그 메모를 엶 */
export function MemoWidget() {
  const memos = useMemoStore((s) => s.memos)
  const add = useMemoStore((s) => s.add)
  const update = useMemoStore((s) => s.update)
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const now = useToday().getTime()

  const [top, ...rest] = sortMemos(memos)
  const go = (id: number) => navigate(`/my/memo?id=${id}`)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    add(text.trim())
    setText('')
  }
  const left = top?.checklist ? top.items.filter((i) => i.text && !i.done).length : 0

  return (
    <section className={styles.widget} aria-labelledby="memo-widget-title">
      <header className={styles.head}>
        <span className={styles.ico} aria-hidden="true">
          📝
        </span>
        <h2 id="memo-widget-title">메모</h2>
        <small>{memos.length}개</small>
        <Link to="/my/memo" className={styles.open}>
          전체 보기 ›
        </Link>
      </header>

      <div className={styles.body}>
        <div className={styles.feature} style={top ? ({ '--memo-bg': colorOf(top.color).bg, '--memo-line': colorOf(top.color).line } as CSSProperties) : undefined}>
          {!top && <p className={styles.none}>{'아직 메모가 없어요.\n아래 칸에 적고 Enter 를 눌러 보세요.'}</p>}
          {top && (
            <>
              <button type="button" className={styles.featureHead} onClick={() => go(top.id)}>
                <b>
                  {top.pinned && '📌 '}
                  {titleOf(top)}
                </b>
                <time>{whenText(top.updatedAt, now)}</time>
              </button>
              {top.checklist ? (
                <>
                  <ul className={styles.checks}>
                    {top.items.slice(0, 5).map((it, i) =>
                      it.text ? (
                        <li key={i} className={cx(it.done && styles.done)}>
                          <label>
                            <input
                              type="checkbox"
                              checked={it.done}
                              onChange={(e) => update(top.id, { items: top.items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })}
                            />
                            <span>{it.text}</span>
                          </label>
                        </li>
                      ) : null,
                    )}
                  </ul>
                  <small className={styles.left}>{left ? `${left}개 남았어요` : '모두 끝냈어요 🎉'}</small>
                </>
              ) : (
                <p className={styles.text} onClick={() => go(top.id)}>
                  {previewLines(top).join('\n') || titleOf(top)}
                </p>
              )}
            </>
          )}
        </div>

        {rest.length > 0 && (
          <ul className={styles.list} aria-label="최근 메모">
            {rest.slice(0, 3).map((m) => {
              const preview = previewLines(m, (d) => (d ? '✓ ' : '')).join(' · ')
              return (
                <li key={m.id}>
                  <button type="button" className={styles.item} style={{ '--memo-line': colorOf(m.color).line } as CSSProperties} onClick={() => go(m.id)}>
                    <span className={styles.itemText}>
                      <b>
                        {m.pinned && '📌 '}
                        {titleOf(m)}
                      </b>
                      {preview && <small>{preview}</small>}
                    </span>
                    <time>{whenText(m.updatedAt, now)}</time>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <form className={styles.add} onSubmit={submit}>
        <span aria-hidden="true">✏️</span>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="빠른 메모 남기기" aria-label="빠른 메모" />
        <button type="submit" aria-label="메모 저장">
          ＋
        </button>
      </form>
    </section>
  )
}
