import { useState } from 'react'
import { groupRegions, neighborLabels } from '../neighborExplorer'
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

/**
 * 커뮤니티 "주변 동네" 탭 › 다른 동네 둘러보기 (서버 모드).
 * 시 · 도 → 시 · 군 · 구를 고르면 맞닿은 지역을 칩으로 보여 줘요. 이사 후보지를 둘러보는 용도라 내 주소 · 글 범위는 바꾸지 않아요.
 * 검색창과 같은 연회색 칸 · 테두리 없는 선택 상자로 머리말에 녹아들게 그려요.
 */
export function NeighborExplorer({ onClose }: { onClose: () => void }) {
  const [sidoId, setSidoId] = useState<string | null>(null)
  const [districtId, setDistrictId] = useState<string | null>(null)
  const regions = useRegionList(true)
  const neighbors = useRegionNeighbors(districtId)
  const rows = regions.data ?? []
  const { sidos, districts } = groupRegions(rows)
  const options = sidoId ? districts.get(sidoId) ?? [] : []
  const district = options.find((d) => d.id === districtId)
  const sido = sidos.find((s) => s.id === sidoId)
  const labels = neighbors.data ? neighborLabels(neighbors.data, rows, sidoId) : []

  return (
    <section className={styles.explorer} aria-label="다른 동네 둘러보기">
      <div className={styles.explorerHead}>
        <b>다른 동네 둘러보기</b>
        <button type="button" className={styles.explorerClose} onClick={onClose} aria-label="다른 동네 둘러보기 닫기">
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
          <select aria-label="시 · 도" value={sidoId ?? ''} onChange={(e) => { setSidoId(e.target.value || null); setDistrictId(null) }} disabled={regions.isLoading}>
            <option value="">{regions.isLoading ? '불러오는 중…' : '시 · 도 선택'}</option>
            {sidos.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select aria-label="시 · 군 · 구" value={districtId ?? ''} onChange={(e) => setDistrictId(e.target.value || null)} disabled={!sidoId}>
            <option value="">시 · 군 · 구 선택</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
      {district ? (
        <div className={styles.explorerResult} role="status">
          {neighbors.isLoading ? (
            <p className={styles.explorerNote}>맞닿은 지역을 찾고 있어요…</p>
          ) : neighbors.isError ? (
            <p className={styles.explorerNote}>주변 지역을 불러오지 못했어요. 잠시 후 다시 골라 주세요.</p>
          ) : labels.length ? (
            <>
              <p className={styles.explorerNote}>
                📍 <b>{sido?.name} {district.name}</b>와 맞닿은 <b>{labels.length}곳</b>
              </p>
              <ul className={styles.explorerChips}>
                {labels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className={styles.explorerNote}>📍 {sido?.name} {district.name} · 아직 이 지역의 주변 정보가 없어요.</p>
          )}
        </div>
      ) : (
        <p className={styles.explorerHint}>둘러보기만 해요. 내 동네와 글 목록 범위는 바뀌지 않아요.</p>
      )}
    </section>
  )
}
