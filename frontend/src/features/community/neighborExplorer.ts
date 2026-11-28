/* 커뮤니티 "주변 동네" 탭의 "다른 동네 주변 보기": 고른 시 · 군 · 구와 맞닿은 지역 (주소 · 글 범위는 바꾸지 않음)
 * GET /api/regions → 시 · 도(level 1) · 시 · 군 · 구(level 2), GET /api/regions/{id}/neighbors → 이웃 { id, name } */

export type RegionRow = { id: string; name: string; parentId: string | null; level: number }
export type NeighborRow = { id: string; name: string }

/** 시 · 도 목록과, 시 · 도 id → 그 아래 시 · 군 · 구 목록 (이름 가나다순) */
export function groupRegions(rows: RegionRow[]) {
  const byName = (a: RegionRow, b: RegionRow) => a.name.localeCompare(b.name, 'ko')
  const sidos = rows.filter((r) => r.level === 1).sort(byName)
  const districts = new Map<string, RegionRow[]>()
  for (const r of rows) {
    if (r.level !== 2 || !r.parentId) continue
    const list = districts.get(r.parentId) ?? []
    list.push(r)
    districts.set(r.parentId, list)
  }
  for (const list of districts.values()) list.sort(byName)
  return { sidos, districts }
}

/** 둘러보는 동네: 글 목록 기준(GET /api/posts?regionId=) · 제목 이름 · 시 · 도까지 붙인 이름 */
export type BrowseRegion = { id: string; name: string; label: string }

/** 이웃 칩: 이름에 시 · 도를 붙임 (같은 "중구"가 여러 시에 있어서). 고른 동네와 같은 시 · 도면 붙이지 않음.
 * sidoId 는 칩을 눌러 그 동네로 넘어갈 때 시 · 도 선택 상자를 맞추는 데 씀 (목록에 없는 이웃은 null) */
export function neighborLabels(neighbors: NeighborRow[], rows: RegionRow[], selectedSidoId: string | null) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return neighbors.map((n) => {
    const parent = byId.get(n.id)?.parentId ?? null
    const sido = parent ? byId.get(parent)?.name : undefined
    return { id: n.id, name: n.name, sidoId: parent, label: sido && parent !== selectedSidoId ? `${sido} ${n.name}` : n.name, full: sido ? `${sido} ${n.name}` : n.name }
  })
}
