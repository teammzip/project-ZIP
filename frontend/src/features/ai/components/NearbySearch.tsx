import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nearbyMapPlaces, showNearbyOnMap } from '@/features/map/nearbyMap'
import { getErrorMessage } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { NEARBY_PROMPT, nearbyQuery, searchNearby, type NearbyMode } from '../nearbySearch'
import styles from './NearbySearch.module.css'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; mode: NearbyMode }
  | { status: 'error'; message: string }
  | ({ status: 'ready'; mode: NearbyMode } & Awaited<ReturnType<typeof searchNearby>>)

export function NearbySearch({ keyword }: { keyword: string }) {
  const { q, checkHours } = nearbyQuery(keyword)
  const navigate = useNavigate()
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const request = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (state.status === 'ready' || state.status === 'error') resultsRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.status])

  const search = async (mode: NearbyMode) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setState({ status: 'loading', mode })
    try {
      const result = await searchNearby(q, mode, controller.signal)
      if (!controller.signal.aborted) setState({ status: 'ready', mode, ...result })
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: 'error', message: getErrorMessage(error, '장소를 불러오지 못했어요. 다시 검색해 주세요.') })
    } finally {
      request.current = null
    }
  }

  if (!q || q.length > 40) return <p>찾을 장소 이름이나 종류를 40자 이내로 다시 입력해 주세요. 예를 들어 ‘약국’이나 ‘세탁방’을 검색할 수 있어요.</p>
  if (isMockApi) return <p>서버에 연결된 환경에서 카카오맵 장소를 검색할 수 있어요.</p>

  const searching = state.status === 'loading'
  const origin = (state.status === 'ready' || state.status === 'loading') && state.mode === 'current' ? '현재 위치' : '등록한 동네'
  const mapPlaces = state.status === 'ready' ? nearbyMapPlaces(state.places) : []

  return (
    <section className={styles.search} aria-label={`${keyword} 장소 검색`}>
      {state.status === 'idle' && <p>{NEARBY_PROMPT}</p>}
      <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={searching} onClick={() => void search('current')}>현재 위치로 검색</button>
        <button type="button" disabled={searching} onClick={() => void search('neighborhood')}>등록한 동네로 검색</button>
      </div>
      <div className={styles.output} ref={resultsRef}>
        {searching && <p role="status">{origin} 주변을 찾고 있어요.</p>}
        {state.status === 'error' && <p role="status">{state.message}</p>}
        {state.status === 'ready' && (
          <>
            <p role="status"><b>{origin} 기준 · 반경 1km</b>{state.places.length ? ` · ${state.places.length}곳` : ''}</p>
            {state.places.length ? (
              <>
                {mapPlaces.length > 0 && <button type="button" className={styles.openMap} onClick={() => {
                  const nearbyId = showNearbyOnMap({ query: q, origin: { point: state.point, label: origin }, places: mapPlaces, checkHours })
                  void navigate('/map', { state: { nearbyId } })
                }}>내 지도에서 전체 보기 ({mapPlaces.length}곳)</button>}
                <ul className={styles.places} role="list">
                  {state.places.slice(0, 3).map((place) => (
                    <li key={place.id}>
                      <div className={styles.placeHeading}>
                        <strong>{place.name}</strong>
                        <small>직선 {place.distanceMeters.toLocaleString('ko-KR')}m</small>
                      </div>
                      {place.address && <p>{place.address}</p>}
                      <a href={`https://place.map.kakao.com/${encodeURIComponent(place.id)}`} target="_blank" rel="noopener noreferrer"
                        aria-label={`${place.name} 카카오맵에서 보기`}>카카오맵에서 보기 <span aria-hidden="true">↗</span></a>
                    </li>
                  ))}
                </ul>
                <p className={styles.note}>{checkHours ? `‘${q}’ 검색 결과예요. 요청하신 영업시간은 카카오맵 상세 화면에서 확인해 주세요.` : '영업시간은 카카오맵 상세 화면에서 확인해 주세요.'}</p>
                <p className={styles.note}>장소 검색 © Kakao</p>
              </>
            ) : <p>주변에서 ‘{q}’에 해당하는 장소를 찾지 못했어요.</p>}
          </>
        )}
      </div>
    </section>
  )
}
