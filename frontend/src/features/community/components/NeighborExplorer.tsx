import { useState } from 'react'
import { groupRegions, neighborLabels, type BrowseRegion } from '../neighborExplorer'
import { useRegionList, useRegionNeighbors } from '../useCommunity'
import styles from './Community.module.css'

/** 머리말 안내 줄 끝의 "다른 동네 둘러보기 ›" (동네 인증하기와 같은 작은 알약 모양) */
export function NeighborExplorerToggle({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className={styles.verifyLink} onClick={onOpen}>
      다른 동네 둘러보기 ›
    </button>
  )
}

type Props = {
  onClose: () => void
  /** 고른 동네로 아래 글 목록을 바꿈 (null 이면 내 동네로) */
  onBrowse: (region: BrowseRegion | null) => void
}

/**
 * 커뮤니티 "주변 동네" 탭 › 다른 동네 둘러보기 (서버 모드).
 * 시 · 도 → 시 · 군 · 구를 고르면 아래 글 목록이 그 동네 글로 바뀌고(GET /api/posts?regionId=), 맞닿은 동네는 칩으로 보여 줘요.
 * 칩을 누르면 그 동네로 넘어가요. 내 동네 · 글 쓰는 동네는 바뀌지 않아요. 닫으면 내 동네 주변 글로 돌아가요.
 */
export function NeighborExplorer({ onClose, onBrowse }: Props) {
  const [sidoId, setSidoId] = useState<string | null>(null)
  const [districtId, setDistrictId] = useState<string | null>(null)
  const regions = useRegionList(true)
  const neighbors = useRegionNeighbors(districtId)
  const rows = regions.data ?? []
  const { sidos, districts } = groupRegions(rows)
  const options = sidoId ? districts.get(sidoId) ?? [] : []
  const district = options.find((d) => d.id === districtId)
  const sido = sidos.find((s) => s.id === sidoId)
  const chips = neighbors.data ? neighborLabels(neighbors.data, rows, sidoId) : []

  /** 동네를 고름 (선택 상자 · 이웃 칩 공통) → 글 목록을 그 동네로 */
  const pick = (nextSido: string | null, nextDistrict: string | null) => {
    setSidoId(nextSido)
    setDistrictId(nextDistrict)
    const row = nextDistrict ? rows.find((r) => r.id === nextDistrict) : undefined
    const sidoName = nextSido ? rows.find((r) => r.id === nextSido)?.name : undefined
    onBrowse(row ? { id: row.id, name: row.name, label: sidoName ? `${sidoName} ${row.name}` : row.name } : null)
  }

  return (
    <section className={styles.explorer} aria-label="다른 동네 둘러보기">
      <div className={styles.explorerHead}>
        <b>다른 동네 둘러보기</b>
        <button type="button" className={styles.explorerClose} onClick={onClose} aria-label="다른 동네 둘러보기 닫고 내 동네로" title="닫고 내 동네로">
          ✕
        </button>
      </div>
      {regions.isError ? (
        <p className={styles.explorerNote} role="alert">
          지역 목록을 불러오지 못했어요.{' '}
          <button type="button" className={styles.explorerRetry} onClick={() => regions.refetch()}>
            다시 시도
          </button>
        </p>
      ) : (
        <div className={styles.explorerPick}>
          <select aria-label="시 · 도" value={sidoId ?? ''} onChange={(e) => pick(e.target.value || null, null)} disabled={regions.isLoading}>
            <option value="">{regions.isLoading ? '불러오는 중…' : '시 · 도 선택'}</option>
            {sidos.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select aria-label="시 · 군 · 구" value={districtId ?? ''} onChange={(e) => pick(sidoId, e.target.value || null)} disabled={!sidoId}>
            <option value="">시 · 군 · 구 선택</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      {district ? (
        <div className={styles.explorerResult} role="status">
          <p className={styles.explorerNote}>
            📍 아래 목록은 <b>{sido?.name} {district.name}</b> 글이에요.
            {neighbors.isLoading ? ' 맞닿은 동네를 찾고 있어요…' : chips.length ? ` 맞닿은 ${chips.length}곳을 눌러 넘어가 보세요.` : ''}
          </p>
          {neighbors.isError && <p className={styles.explorerNote}>맞닿은 동네를 불러오지 못했어요.</p>}
          {chips.length > 0 && (
            <ul className={styles.explorerChips}>
              {chips.map((c) => (
                <li key={c.id}>
                  <button type="button" className={styles.explorerChip} onClick={() => pick(c.sidoId, c.id)} disabled={!c.sidoId} title={`${c.full} 글 보기`}>
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className={styles.explorerHint}>시 · 군 · 구를 고르면 아래 목록이 그 동네 글로 바뀌어요. 내 동네와 글 쓰는 동네는 그대로예요.</p>
      )}
    </section>
  )
}
