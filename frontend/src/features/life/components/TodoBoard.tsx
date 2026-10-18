import { useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { useLifeStore } from '../store'
import styles from './life.module.css'

/** 이번 주 할 일: 체크 · 추가 · 삭제 · 완료 항목 지우기 */
export function TodoBoard() {
  const { todos, addTodo, toggleTodo, removeTodo, clearDoneTodos } = useLifeStore(
    useShallow((s) => ({ todos: s.todos, addTodo: s.addTodo, toggleTodo: s.toggleTodo, removeTodo: s.removeTodo, clearDoneTodos: s.clearDoneTodos })),
  )
  const [text, setText] = useState('')
  const done = todos.filter((t) => t.done).length
  const total = todos.length
  const pct = total ? Math.round((done / total) * 100) : 0

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    addTodo(v)
    setText('')
  }

  return (
    <Card
      className={common.narrow}
      title={
        <>
          이번 주 할 일 {total > 0 && <span className={common.count}>{done}/{total}</span>}
        </>
      }
      actions={
        <Button variant="line" onClick={clearDoneTodos} disabled={done === 0}>
          완료 항목 지우기
        </Button>
      }
    >
      <div className={common.bar}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className={common.sub}>{total ? `전체 ${total}개 중 ${done}개 완료 · ${pct}%` : '할 일을 추가해 보세요'}</p>

      {todos.map((t) => (
        <label key={t.id} className={cx(styles.todo, t.done && styles.done)}>
          <input type="checkbox" className={common.checkbox} checked={t.done} onChange={(e) => toggleTodo(t.id, e.target.checked)} />
          <span>{t.text}</span>
          <button type="button" className={common.del} onClick={() => removeTodo(t.id)} aria-label={`${t.text} 삭제`} title="삭제">
            ×
          </button>
        </label>
      ))}
      {!todos.length && <p className={common.empty}>할 일이 없어요. 아래에서 추가해 보세요.</p>}

      <form className={cx(common.inline, styles.addRow)} onSubmit={submit}>
        <input className={common.input} value={text} onChange={(e) => setText(e.target.value)} maxLength={40} placeholder="할 일 추가" aria-label="할 일 추가" />
        <Button type="submit">추가</Button>
      </form>
    </Card>
  )
}
