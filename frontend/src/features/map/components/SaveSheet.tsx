import { useEffect, useState, type FormEvent } from 'react'
import { isMockApi } from '@/features/auth'
import { Modal } from '@/components/ui'
import { getErrorMessage } from '@/lib/apiClient'
import { cx } from '@/lib/cx'
import { mapApi } from '../api'
import { isKakaoPlace } from '../kakaoPlaceId'
import { placeColors } from '../placeIcons'
import { closeSaveSheet, showFavNote, useSaveSheet, type SaveTarget } from '../saveSheet'
import { LIST_COLORS, useMapStore } from '../store'
import { refreshSavedFromServer } from '../useMapData'
import styles from './MapView.module.css'
import { PlaceIcon } from './PlaceIcon'

/** ★ 저장 창: 장소 이름 → [+ 새 리스트 만들기] → 내 리스트들(색 별 · 이름 · 개수 · 체크) → [저장]
 * 여러 리스트에 넣을 수 있고, 체크를 다 풀고 저장하면 저장이 풀려요. 지도 화면(MapView)에 하나만 둬요. */
export function SaveSheet() {
  const target = useSaveSheet((s) => s.target)
  // 장소가 바뀌면 창 내용을 새로 만듦 (체크 · 입력 초기화)
  return target ? <SaveSheetBody key={target.id} target={target} /> : null
}

/** 이 장소가 들어 있는 리스트 id */
const listsWith = (placeId: string) => useMapStore.getState().lists.filter((l) => l.placeIds.includes(placeId)).map((l) => l.id)

function SaveSheetBody({ target }: { target: SaveTarget }) {
  const lists = useMapStore((s) => s.lists)
  const [picked, setPicked] = useState(() => listsWith(target.id))
  const [initial, setInitial] = useState(() => listsWith(target.id))
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(LIST_COLORS[1])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 서버 모드: 창이 열리면 최신 리스트를 받아 체크를 맞춤 (처음이면 서버가 "내 장소"를 만들어 줌)
  useEffect(() => {
    if (isMockApi) return
    let alive = true
    refreshSavedFromServer()
      .then(() => {
        if (!alive) return
        setPicked(listsWith(target.id))
        setInitial(listsWith(target.id))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [target.id])

  const changed = picked.length !== initial.length || picked.some((id) => !initial.includes(id))
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const meta = isKakaoPlace(target.id) ? { n: target.n, cat: target.cat } : undefined

  const addList = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('리스트 이름을 입력해 주세요.')
    if (lists.some((l) => l.name === n)) return setError('같은 이름의 리스트가 있어요.')
    setBusy(true)
    setError('')
    try {
      if (isMockApi) {
        const list = useMapStore.getState().addListLocal(n, color)
        if (list) setPicked((p) => [...p, list.id])
      } else {
        const list = await mapApi.createPlaceList(n, color)
        await refreshSavedFromServer()
        setPicked((p) => [...p, list.id])
      }
      setAdding(false)
      setName('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  /** 리스트 삭제 (한 번 확인). 이 리스트에만 있던 장소는 저장이 풀려요 */
  const removeList = async (id: string) => {
    const list = lists.find((l) => l.id === id)
    if (!list) return
    const onlyHere = list.placeIds.filter((pid) => !lists.some((l) => l.id !== id && l.placeIds.includes(pid))).length
    const warn = onlyHere ? `
이 리스트에만 있는 장소 ${onlyHere}곳은 저장이 풀려요.` : ''
    if (!window.confirm(`'${list.name}' 리스트를 지울까요?${warn}`)) return
    setBusy(true)
    setError('')
    try {
      if (isMockApi) useMapStore.getState().deleteListLocal(id)
      else {
        await mapApi.deletePlaceList(id)
        await refreshSavedFromServer()
      }
      // 이 장소가 그 리스트에 있었으면 체크도 같이 정리 (삭제는 이미 서버에 반영됨)
      setPicked((p) => p.filter((x) => x !== id))
      setInitial((p) => p.filter((x) => x !== id))
      showFavNote(`'${list.name}' 리스트를 지웠어요.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      if (isMockApi) useMapStore.getState().setPlaceListsLocal({ id: target.id, n: target.n, cat: target.cat }, picked)
      else {
        await mapApi.setPlaceLists(target.id, picked, meta)
        await refreshSavedFromServer()
      }
      const names = lists.filter((l) => picked.includes(l.id)).map((l) => l.name)
      showFavNote(picked.length ? `★ '${target.n}'을(를) ${names.join(' · ')}에 저장했어요.` : `'${target.n}' 저장을 취소했어요.`)
      closeSaveSheet()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={closeSaveSheet} title="저장할 리스트 고르기" className={styles.saveSheet}>
      <div className={styles.sheetHead}>
        <span className={styles.sheetThumb} style={{ background: placeColors(target.cat).bg, color: placeColors(target.cat).fg }} aria-hidden="true">
          <PlaceIcon cat={target.cat} size={24} />
        </span>
        <div>
          <b>{target.n}</b>
          <small>{target.cat}</small>
        </div>
      </div>

      {adding ? (
        <form className={styles.newList} onSubmit={addList}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="리스트 이름 (예: 맛집, 제주)" aria-label="새 리스트 이름" autoFocus />
          <div className={styles.colorDots} role="radiogroup" aria-label="리스트 색">
            {LIST_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`색 ${c}`} className={cx(styles.colorDot, color === c && styles.colorDotOn)} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className={styles.newListBtns}>
            <button type="button" onClick={() => setAdding(false)}>
              취소
            </button>
            <button type="submit" className={styles.newListAdd} disabled={busy}>
              만들기
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={styles.newListOpen} onClick={() => setAdding(true)}>
          <span aria-hidden="true">＋</span> 새 리스트 만들기
        </button>
      )}

      <ul className={styles.listPick}>
        {lists.map((l) => {
          const on = picked.includes(l.id)
          return (
            <li key={l.id} className={styles.listPickItem}>
              <button type="button" role="checkbox" aria-checked={on} className={styles.listPickRow} onClick={() => toggle(l.id)}>
                <span className={styles.listStar} style={{ background: l.color }} aria-hidden="true">
                  ★
                </span>
                <b>{l.name}</b>
                <small>{l.placeIds.length}</small>
                <span className={cx(styles.listCheck, on && styles.listCheckOn)} aria-hidden="true">
                  ✓
                </span>
              </button>
              <button type="button" className={styles.listDelete} onClick={() => void removeList(l.id)} disabled={busy} aria-label={`'${l.name}' 리스트 삭제`} title="리스트 삭제">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            </li>
          )
        })}
      </ul>

      {error && (
        <p className={styles.sheetError} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={styles.sheetSave} disabled={busy || !changed} onClick={save}>
        {initial.length && !picked.length ? '저장 취소' : '저장'}
      </button>
    </Modal>
  )
}
