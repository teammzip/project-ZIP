import { useState, type CSSProperties, type FormEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button, Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import { UNCATEGORIZED, catColor } from '../data/presets'
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
  /** 기념일 저장 (이름 · 날짜 · 매년 반복) */
  onAddAnniv: (name: string, date: string, yearly: boolean) => void
}

type Tab = 'quick' | 'custom' | 'anniv'

/** 일정 기록하기
 * - 탭 두 개: ⚡ 빠른 추가 | ✏️ 직접 입력
 * - 빠른 추가: 단계 표시 → 카테고리 탭(색 = 달력 막대 색, 끝에 ⚙ 편집) → 그 카테고리 항목 타일 → 선택 카드(시간 · 오늘 · 이번 주)
 * - ⚙ 편집: 카테고리 추가 · 이름 변경 · 삭제(그 카테고리의 항목과 일정은 미분류로)
 * - 직접 입력: 일정을 넣으면 고른 카테고리 아래 항목 타일로도 저장. 직접 만든 항목은 수정 · 삭제 */
export function RecordCard({ picked, onChoose, pickNote, pickTime, onPickTime, onAddToday, onAddWeek, date, onAdd, onAddAnniv }: Props) {
  const { categories, customPresets, addPreset, updatePreset, removePreset } = useLifeStore(
    useShallow((s) => ({ categories: s.categories, customPresets: s.customPresets, addPreset: s.addPreset, updatePreset: s.updatePreset, removePreset: s.removePreset })),
  )
  const [tab, setTab] = useState<Tab>('quick')
  const [catName, setCatName] = useState(categories[0]?.name ?? UNCATEGORIZED)
  const [managing, setManaging] = useState(false)
  const [form, setForm] = useState({ title: '', date, time: '', category: UNCATEGORIZED })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [anniv, setAnniv] = useState({ name: '', date, yearly: true })
  const [annivMsg, setAnnivMsg] = useState('')

  // 달력에서 다른 날을 고르면 직접 입력 날짜도 따라감 (렌더 중에 이전 값과 비교 — effect 안에서 setState 하지 않으려고)
  const [lastDate, setLastDate] = useState(date)
  if (lastDate !== date) {
    setLastDate(date)
    setForm((f) => ({ ...f, date }))
    setAnniv((a) => ({ ...a, date }))
  }

  const names = categories.map((c) => c.name)
  // 미분류 탭은 직접 만든 항목이 있을 때만 보여 줌
  const groups = categories.filter((c) => c.name !== UNCATEGORIZED || c.items.length > 0 || customPresets.some((p) => p.category === UNCATEGORIZED))
  const current = groups.find((c) => c.name === catName) ?? groups[0]
  const categoryOk = (name: string) => names.includes(name)
  const isOn = (title: string, category: string) => picked?.title === title && picked.category === category
  const hasPick = (category: string) => !!picked && picked.category === category

  const switchTab = (t: Tab) => {
    setTab(t)
    if (t !== 'quick') onChoose(null)
  }
  const startEdit = (p: CustomPreset) => {
    setEditingId(p.id)
    setForm((f) => ({ ...f, title: p.title, category: categoryOk(p.category) ? p.category : UNCATEGORIZED }))
    setMsg('항목 이름 · 카테고리를 바꾼 뒤 "항목 수정"을 눌러 주세요.')
    switchTab('custom')
  }
  const stopEdit = () => {
    setEditingId(null)
    setForm((f) => ({ ...f, title: '' }))
  }

  const submitAnniv = (e: FormEvent) => {
    e.preventDefault()
    const name = anniv.name.trim()
    if (!name || !anniv.date) return
    onAddAnniv(name, anniv.date, anniv.yearly)
    setAnniv((a) => ({ ...a, name: '' }))
    setAnnivMsg(`🎉 "${name}" 기념일을 ${Number(anniv.date.slice(5, 7))}월 ${Number(anniv.date.slice(8))}일에 넣었어요.${anniv.yearly ? ' 매년 달력에 보여요.' : ''}`)
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
      if (old && isOn(old.title, old.category)) onChoose({ title, category }) // 골라 둔 항목이었으면 바뀐 이름으로
      stopEdit()
      setMsg('항목을 수정했어요.')
      return
    }
    if (!duplicate) addPreset(title, category)
    onAdd(title, form.date, form.time, category)
    setForm((f) => ({ ...f, title: '', time: '' }))
    setMsg(`✅ 일정을 넣고, "${category}" 빠른 추가에 항목으로도 저장했어요.`)
  }

  return (
    <Card>
      <div className={cal.recHead}>
        <h2>일정 기록하기</h2>
        <div className={cal.recTabs} role="tablist" aria-label="일정 기록 방법">
          <button type="button" role="tab" className={cx(cal.recTab, tab === 'quick' && cal.on)} aria-selected={tab === 'quick'} onClick={() => switchTab('quick')}>
            ⚡ 빠른 추가
          </button>
          <button type="button" role="tab" className={cx(cal.recTab, tab === 'custom' && cal.on)} aria-selected={tab === 'custom'} onClick={() => switchTab('custom')}>
            ✏️ 직접 입력
          </button>
          <button type="button" role="tab" className={cx(cal.recTab, tab === 'anniv' && cal.on)} aria-selected={tab === 'anniv'} onClick={() => switchTab('anniv')}>
            🎉 기념일
          </button>
        </div>
      </div>

      {tab === 'quick' ? (
        <div role="tabpanel">
          <ol className={cal.steps}>
            <li className={picked ? cal.done : cal.on}>
              <b>1</b> 항목 고르기
            </li>
            <li className={cx(picked && cal.on)}>
              <b>2</b> 달력에서 날짜 누르기
            </li>
          </ol>

          {/* 카테고리 탭 + ⚙ 편집 */}
          <div className={cal.cats} role="tablist" aria-label="카테고리">
            {groups.map((c) => (
              <button
                key={c.name}
                type="button"
                role="tab"
                aria-selected={current?.name === c.name}
                className={cx(cal.catTab, current?.name === c.name && cal.on)}
                style={{ '--c': catColor(c.name, names) } as CSSProperties}
                onClick={() => setCatName(c.name)}
              >
                <span className={cal.catIco}>{c.ico}</span>
                {c.name}
                {hasPick(c.name) && <i className={cal.catDot} aria-label="골라 둔 항목 있음" />}
              </button>
            ))}
            <button type="button" className={cx(cal.catTab, cal.catEdit, managing && cal.on)} aria-expanded={managing} onClick={() => setManaging((v) => !v)}>
              ⚙ 편집
            </button>
          </div>

          {managing && (
            <CategoryManager
              onRenamed={(from, to) => {
                if (picked?.category === from) onChoose({ ...picked, category: to })
                if (catName === from) setCatName(to)
              }}
              onClose={() => setManaging(false)}
            />
          )}

          {/* 고른 카테고리의 항목 타일 (기본 항목 + 직접 만든 항목) */}
          {current && (
            <div className={cal.items} style={{ '--c': catColor(current.name, names) } as CSSProperties}>
              {current.items.map((name) => (
                <ItemTile key={name} title={name} on={isOn(name, current.name)} onClick={() => onChoose(isOn(name, current.name) ? null : { title: name, category: current.name })} />
              ))}
              {customPresets
                .filter((p) => p.category === current.name)
                .map((p) => (
                  <div key={p.id} className={cal.itemWrap} onPointerUp={(e) => e.pointerType === 'touch' && e.currentTarget.classList.add(cal.showActions)}>
                    <ItemTile title={p.title} mine on={isOn(p.title, p.category)} onClick={() => onChoose(isOn(p.title, p.category) ? null : { title: p.title, category: p.category })} />
                    <span className={cal.itemActions}>
                      <button type="button" onClick={() => startEdit(p)} aria-label={`${p.title} 항목 수정`}>
                        수정
                      </button>
                      <button
                        type="button"
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
                  </div>
                ))}
              {current.items.length === 0 && !customPresets.some((p) => p.category === current.name) && (
                <p className={cal.itemsEmpty}>
                  아직 항목이 없어요.{' '}
                  <button type="button" className={cal.linkBtn} onClick={() => (setForm((f) => ({ ...f, category: current.name })), switchTab('custom'))}>
                    직접 입력
                  </button>
                  으로 이 카테고리에 항목을 만들어 보세요.
                </p>
              )}
            </div>
          )}

          {/* 선택 카드 */}
          {picked && (
            <div className={cal.pickCard} style={{ '--c': catColor(picked.category, names) } as CSSProperties}>
              <div className={cal.pickTop}>
                <span>선택한 항목</span>
                <button type="button" className={cal.pickX} onClick={() => onChoose(null)} aria-label="선택 해제">
                  ✕
                </button>
              </div>
              <b className={cal.pickName}>{picked.title}</b>
              <p className={cal.pickNote} aria-live="polite">
                {pickNote || '왼쪽 달력에서 날짜를 눌러 주세요. 여러 날을 눌러도 돼요.'}
              </p>
              <div className={cal.pickRow}>
                <label className={cal.pickTime}>
                  🕒 <input type="time" value={pickTime} onChange={(e) => onPickTime(e.target.value)} aria-label="시간 (선택)" />
                </label>
                <Button variant="line" onClick={onAddToday}>
                  오늘로 추가
                </Button>
                <Button variant="line" onClick={onAddWeek}>
                  이번 주 일요일로
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'anniv' ? (
        <div role="tabpanel">
          {/* 기념일: 이름 + 날짜 + 매년 반복. 홈 화면에는 가장 가까운 기념일이 보임 */}
          <form className={cx(common.form, cal.recForm)} onSubmit={submitAnniv}>
            <label>
              기념일 이름
              <input value={anniv.name} onChange={(e) => setAnniv({ ...anniv, name: e.target.value })} maxLength={40} placeholder="예) 엄마 생신, 입주 1주년, 친구 결혼식" required autoFocus />
            </label>
            <label>
              날짜
              <input type="date" value={anniv.date} onChange={(e) => setAnniv({ ...anniv, date: e.target.value })} required />
            </label>
            <label className={cal.yearlyCheck}>
              <input type="checkbox" checked={anniv.yearly} onChange={(e) => setAnniv({ ...anniv, yearly: e.target.checked })} />
              매년 반복 (생일 · 기념일처럼 해마다 같은 날)
            </label>
            <Button type="submit" block>
              기념일 추가
            </Button>
            <p className={cal.recTip} role="status" aria-live="polite">
              {annivMsg || '💡 기념일은 달력과 일정 목록에 🎉 로 보이고, 홈 화면에는 다가오는 기념일이 D-day로 나와요.'}
            </p>
          </form>
        </div>
      ) : (
        <div role="tabpanel">
          {/* 직접 입력: 일정을 넣으면 고른 카테고리 아래 항목 타일로도 저장 */}
          <form className={cx(common.form, cal.recForm)} onSubmit={submit}>
            <label>
              {editingId ? '항목 이름' : '일정 제목'}
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={60} placeholder="예) 월세 이체, 집주인 통화, 장보기" required autoFocus />
            </label>
            <label>
              카테고리
              <CategorySelect value={form.category} onChange={(category) => setForm({ ...form, category })} />
            </label>
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
              {editingId ? '항목 수정' : '일정 추가'}
            </Button>
            {editingId && (
              <Button
                variant="line"
                block
                onClick={() => {
                  stopEdit()
                  setMsg('')
                  switchTab('quick')
                }}
              >
                수정 취소
              </Button>
            )}
            <p className={cal.recTip} role="status" aria-live="polite">
              {msg || (
                <>
                  💡 넣은 일정은 고른 카테고리의 빠른 추가에 항목으로도 저장돼요. 자주 쓰는 일정은{' '}
                  <button type="button" className={cal.linkBtn} onClick={() => switchTab('quick')}>
                    빠른 추가
                  </button>
                  에서 한 번에 넣을 수 있어요.
                </>
              )}
            </p>
          </form>
        </div>
      )}
    </Card>
  )
}

/** 항목 타일: 동그라미 체크 + 이름 (직접 만든 항목은 ✎ 표시) */
function ItemTile({ title, on, mine, onClick }: { title: string; on: boolean; mine?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={cx(cal.item, on && cal.on)} aria-pressed={on} onClick={onClick}>
      <span className={cal.check}>{on ? '✓' : ''}</span>
      <span className={cal.itemT}>{title}</span>
      {mine && (
        <span className={cal.mine} title="직접 만든 항목">
          ✎
        </span>
      )}
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

/** ⚙ 편집: 카테고리 추가 · 이름 변경 · 삭제 (삭제한 카테고리의 항목과 일정은 미분류로, 미분류는 바꿀 수 없음) */
function CategoryManager({ onRenamed, onClose }: { onRenamed: (from: string, to: string) => void; onClose: () => void }) {
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
    <div className={cal.manager}>
      <div className={cal.managerHead}>
        <b>카테고리 편집</b>
        <button type="button" className={cal.pickX} onClick={onClose} aria-label="편집 닫기">
          ✕
        </button>
      </div>
      <div className={cal.managerRow}>
        <CategorySelect
          value={current}
          onChange={(v) => {
            setTarget(v)
            setConfirmDel(false)
          }}
          label="편집할 카테고리"
        />
        <input className={common.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="새 이름" aria-label="새 이름" />
      </div>
      <div className={cal.pickRow}>
        <Button variant="line" onClick={() => run(addCategory(name), `"${name.trim()}" 카테고리를 추가했어요.`, name.trim())}>
          + 추가
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
      <p className={cal.recTip} role="status" aria-live="polite">
        {msg || '삭제한 카테고리의 항목과 일정은 미분류로 이동해요. 미분류는 변경·삭제할 수 없어요.'}
      </p>
    </div>
  )
}
