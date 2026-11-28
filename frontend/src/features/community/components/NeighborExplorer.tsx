import { useState } from 'react'
import { groupRegions, neighborLabels } from '../neighborExplorer'
import { useRegionList, useRegionNeighbors } from '../useCommunity'
import styles from './Community.module.css'

/**
 * 커뮤니티 "주변 동네" 탭 › 다른 동네 주변 보기 (서버 모드).
 * 시 · 도 → 시 · 군 · 구를 고르면 맞닿은 지역을 보여 줘요. 이사 후보지를 둘러보는 용도라 내 주소 · 글 범위는 바꾸지 않아요.
 */
export function NeighborExplorer() {
  const [open, setOpen] = useState(false)
  const [sidoId, setSidoId] = useState<string | null>(null)
  const [districtId, setDistrictId] = useState<string | null>(null)
  const regions = useRegionList(open)
  const neighbors = useRegionNeighbors(districtId)
  const rows = regions.data ?? []
  const { sidos, districts } = groupRegions(rows)
  const options = sidoId ? districts.get(sidoId) ?? [] : []
  const district = options.find((d) => d.id === districtId)
  const sido = sidos.find((s) => s.id === sidoId)

  if (!open) {
    return (
      <button type="button" className={styles.explorerOpen} onClick={() => setOpen(true)}>
        다른 동네 주변 보기
      </button>
    )
  }

  const labels = neighbors.data ? neighborLabels(neighbors.data, rows, sidoId) : []
  return (
    <div className={styles.explorer}>
      <div className={styles.explorerHead}>
        <b>다른 동네 주변 보기</b>
        <button type="button" onClick={() => setOpen(false)}>
          닫기
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
          <select aria-label="시 · 도" value={sidoId ?? ''} onChange={(e) => { setSidoId(e.target.value || null); setDistrictId(null) }} disabled={regions.isLoading}>
            <option value="">{regions.isLoading ? '불러오는 중…' : '시 · 도'}</option>
            {sidos.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select aria-label="시 · 군 · 구" value={districtId ?? ''} onChange={(e) => setDistrictId(e.target.value || null)} disabled={!sidoId}>
            <option value="">시 · 군 · 구</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      {district && (
        <p className={styles.explorerNote} role="status">
          {neighbors.isLoading
            ? '맞닿은 지역을 찾고 있어요…'
            : neighbors.isError
              ? '주변 지역을 불러오지 못했어요. 잠시 후 다시 골라 주세요.'
              : labels.length
                ? `📍 ${sido?.name ?? ''} ${district.name}와 맞닿은 ${labels.length}곳: ${labels.join(' · ')}`
                : `📍 ${sido?.name ?? ''} ${district.name} · 아직 이 지역의 주변 정보가 없어요.`}
        </p>
      )}
      <p className={styles.explorerHint}>둘러보기만 해요. 내 동네와 글 목록 범위는 바뀌지 않아요.</p>
    </div>
  )
}
