import { useRef, useState, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { UNCATEGORIZED } from '../data/presets'
import { useLifeStore } from '../store'
import type { CustomPreset } from '../types'
import cal from './calendar.module.css'

/** 골라 둔 항목: 이름 + 카테고리 */
export type Picked = { title: string; category: string }

type Props = {
  picked: Picked | null
  onChoose: (p: Picked | null) => void
  /** 골라 둔 항목 안내 문장 ("10월 27일에 추가했어요" 등) */
  pickNote: string
  pickTime: string
  onPickTime: (t: string) => void
  onAddToday: () => void
  onAddWeek: () => void
  /** 직접 입력 폼의 날짜 (달력에서 고른 날을 따라감) */
  date: string
  onAdd: (title: string, date: string, time: string, category: string) => void
}

/** 일정 기록하기 (팀장님 · 백엔드 담당 시안 variants/app 캘린더와 같은 구성)
 * ① 카테고리별 항목 버튼 → 달력에서 날짜 누르기 (오늘로 · 이번 주로 추가도 가능)
 * ② 카테고리 관리: 추가 · 이름 변경 · 삭제(그 카테고리의 항목과 일정은 미분류로)
 * ③ 직접 입력: 일정을 넣으면 고른 카테고리 아래 항목 버튼으로도 저장. 직접 만든 항목은 수정 · 삭제 */
export function RecordCard({ picked, onChoose, pickNote, pickTime, onPickTime, onAddToday, onAddWeek, date, onAdd }: Props) {
  const { categories, customPresets, addPreset, updatePreset, removePreset } = useLifeStore(
    useShallow((s) => ({ categories: s.categories, customPresets: s.customPresets, addPreset: s.addPreset, updatePreset: s.updatePreset, removePreset: s.removePreset })),
  )
  const customRef = useRef<HTMLDetailsElement>(null)
  const [form, setForm] = useState({ title: '', date, time: '', category: UNCATEGORIZED })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  // 달력에서 다른 날을 고르면 직접 입력 날짜도 따라감 (렌더 중에 이전 값과 비교 — effect 안에서 setState 하지 않으려고)
  const [lastDate, setLastDate] = useState(date)
  if (lastDate !== date) {
    setLastDate(date)
    setForm((f) => ({ ...f, date }))
  }

  // 미분류 묶음은 직접 만든 항목이 있을 때만 보여 줌
  const groups = categories.filter((c) => c.name !== UNCATEGORIZED || c.items.length > 0 || customPresets.some((p) => p.category === UNCATEGORIZED))
  const categoryOk = (name: string) => categories.some((c) => c.name === name)
  const isOn = (title: string, category: string) => picked?.title === title && picked.category === category

  const startEdit = (p: CustomPreset) => {
    setEditingId(p.id)
    setForm((f) => ({ ...f, title: p.title, category: categoryOk(p.category) ? p.category : UNCATEGORIZED }))
    setMsg('항목 이름 · 카테고리를 바꾼 뒤 "항목 수정"을 눌러 주세요.')
    if (customRef.current) customRef.current.open = true
  }
  const stopEdit = () => {
    setEditingId(null)
    setForm((f) => ({ ...f, title: '' }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim()
    const category = form.category
    if (!title || !form.date) return
    if (!categoryOk(category)) return setMsg('목록에서 카테고리를 선택해 주세요.')
    const duplicate =
      categories.some((c) => c.name === category && c.items.includes(title)) || customPresets.some((p) => p.id !== editingId && p.title === title && p.category === category)
    if (editingId) {
      if (duplicate) return setMsg('해당 카테고리에 같은 항목이 이미 있어요.')
      const old = customPresets.find((p) => p.id === editingId)
      updatePreset(editingId, title, category)
      if (old && picked && isOn(old.title, old.category)) onChoose({ title, category }) // 골라 둔 항목이었으면 바뀐 이름으로
      stopEdit()
      setMsg('항목을 수정했어요.')
      return
    }
    if (!duplicate) addPreset(title, category)
    onAdd(title, form.date, form.time, category)
    setForm((f) => ({ ...f, title: '', time: '' }))
    setMsg('카테고리 아래 항목 버튼에 반영했어요. 버튼을 선택해 다른 날짜에도 추가할 수 있어요.')
  }

  return (
    <Card title="일정 기록하기">
      <p className={cal.help}>항목을 누른 다음, 달력에서 날짜를 누르면 일정이 추가돼요.</p>
      {groups.map((cat) => (
        <div key={cat.name} className={cal.cat}>
          <h3>
            {cat.ico} {cat.name}
          </h3>
          <div className={common.chips}>
            {cat.items.map((name) => (
              <ItemChip key={name} title={name} on={isOn(name, cat.name)} onClick={() => onChoose(isOn(name, cat.name) ? null : { title: name, category: cat.name })} />
            ))}
            {customPresets
              .filter((p) => p.category === cat.name)
              .map((p) => (
                <span key={p.id} className={cal.presetItem} tabIndex={-1} onPointerUp={(e) => e.pointerType === 'touch' && e.currentTarget.classList.add(cal.showActions)}>
                  <ItemChip title={p.title} on={isOn(p.title, p.category)} onClick={() => onChoose(isOn(p.title, p.category) ? null : { title: p.title, category: p.category })} />
                  <button type="button" className={cal.presetAction} onClick={() => startEdit(p)} aria-label={`${p.title} 항목 수정`}>
                    수정
                  </button>
                  <button
                    type="button"
                    className={cal.presetAction}
                    onClick={() => {
                      removePreset(p.id)
                      if (editingId === p.id) stopEdit()
                      if (isOn(p.title, p.category)) onChoose(null)
                    }}
                    aria-label={`${p.title} 항목 삭제`}
                  >
                    삭제
                  </button>
                </span>
              ))}
          </div>
        </div>
      ))}

      {picked && (
        <div className={cal.pickBar}>
          <p className={cal.pickMsg} aria-live="polite">
            <b>「{picked.title}」</b> <span>{pickNote || '달력에서 날짜를 눌러 주세요.'}</span>
          </p>
          <div className={cal.pickRow}>
            <label>
              시간 (선택) <input type="time" className={common.input} value={pickTime} onChange={(e) => onPickTime(e.target.value)} />
            </label>
            <Button variant="line" onClick={onAddToday}>
              오늘로 추가
            </Button>
            <Button variant="line" onClick={onAddWeek}>
              이번 주(일요일)로 추가
            </Button>
            <Button variant="line" onClick={() => onChoose(null)}>
              선택 해제
            </Button>
          </div>
        </div>
      )}

      <CategoryManager onRenamed={(from, to) => picked?.category === from && onChoose({ ...picked, category: to })} />

      {/* 목록에 없는 일정은 직접 입력 → 고른 카테고리 아래 항목 버튼으로도 저장 */}
      <details ref={customRef} className={cal.custom}>
        <summary>직접 입력하기</summary>
        <form className={common.form} onSubmit={submit}>
          <label>
            일정 제목
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} placeholder="예) 월세 이체, 집주인 통화, 장보기" required />
          </label>
          <label>
            카테고리 (선택)
            <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
          </label>
          <small className={common.note}>입력한 일정은 선택한 카테고리 아래에 항목 버튼으로도 저장돼요.</small>
          {!editingId && (
            <div className={common.two}>
              <label>
                날짜
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </label>
              <label>
                시간 (선택)
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </label>
            </div>
          )}
          <Button type="submit" block>
            {editingId ? '항목 수정' : '일정과 항목 추가'}
          </Button>
          {editingId && (
            <Button
              variant="line"
              block
              onClick={() => {
                stopEdit()
                setMsg('')
              }}
            >
              항목 수정 취소
            </Button>
          )}
          <p className={common.note} role="status" aria-live="polite">
            {msg}
          </p>
        </form>
      </details>
    </Card>
  )
}

function ItemChip({ title, on, onClick }: { title: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cx(common.chip, on && common.chipOn)} aria-pressed={on} onClick={onClick}>
      {title}
    </button>
  )
}

/** 카테고리 선택 상자 (없는 값이면 미분류) */
export function CategorySelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const categories = useLifeStore((s) => s.categories)
  const current = categories.some((c) => c.name === value) ? value : UNCATEGORIZED
  return (
    <select className={common.input} value={current} onChange={(e) => onChange(e.target.value)} aria-label={label ?? '일정 카테고리'}>
      {categories.map((c) => (
        <option key={c.name} value={c.name}>
          {c.ico} {c.name}
        </option>
      ))}
    </select>
  )
}

/** 카테고리 관리: 추가 · 이름 변경 · 삭제 (삭제한 카테고리의 항목과 일정은 미분류로, 미분류는 바꿀 수 없음) */
function CategoryManager({ onRenamed }: { onRenamed: (from: string, to: string) => void }) {
  const { categories, addCategory, renameCategory, deleteCategory } = useLifeStore(
    useShallow((s) => ({ categories: s.categories, addCategory: s.addCategory, renameCategory: s.renameCategory, deleteCategory: s.deleteCategory })),
  )
  const [target, setTarget] = useState(categories[0]?.name ?? UNCATEGORIZED)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const current = categories.some((c) => c.name === target) ? target : (categories[0]?.name ?? UNCATEGORIZED)

  const run = (err: string | null, ok: string, next?: string) => {
    if (err) return setMsg(err)
    setMsg(ok)
    setName('')
    if (next) setTarget(next)
  }

  return (
    <details className={cal.custom}>
      <summary>카테고리 관리</summary>
      <div className={common.form}>
        <label>
          관리할 카테고리
          <CategorySelect
            value={current}
            onChange={(v) => {
              setTarget(v)
              setConfirmDel(false)
            }}
            label="관리할 카테고리"
          />
        </label>
        <label>
          새 이름
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="추가하거나 변경할 이름" />
        </label>
        <div className={cal.pickRow}>
          <Button variant="line" onClick={() => run(addCategory(name), `"${name.trim()}" 카테고리를 추가했어요.`, name.trim())}>
            추가
          </Button>
          <Button
            variant="line"
            onClick={() => {
              const to = name.trim()
              const err = renameCategory(current, to)
              run(err, `"${current}" → "${to}"(으)로 바꿨어요.`, to)
              if (!err) onRenamed(current, to)
            }}
          >
            이름 변경
          </Button>
          {confirmDel ? (
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDel(false)
                run(deleteCategory(current), `"${current}" 카테고리를 삭제했어요. 항목과 일정은 미분류로 옮겼어요.`, UNCATEGORIZED)
                if (current !== UNCATEGORIZED) onRenamed(current, UNCATEGORIZED)
              }}
            >
              정말 삭제
            </Button>
          ) : (
            <Button variant="line" onClick={() => (current === UNCATEGORIZED ? setMsg('미분류는 삭제할 수 없어요.') : setConfirmDel(true))}>
              삭제
            </Button>
          )}
        </div>
        <small className={common.note}>삭제한 카테고리의 항목과 일정은 미분류로 이동해요. 미분류는 변경·삭제할 수 없어요.</small>
        <p className={common.note} role="status" aria-live="polite">
          {msg}
        </p>
      </div>
    </details>
  )
}
