import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import styles from './SurveyPage.module.css'

type RegionResult = {
  name: string
  addresstype: string
  address: Partial<Record<'country_code' | 'province' | 'state' | 'city' | 'county' | 'borough' | 'city_district' | 'district' | 'municipality' | 'town' | 'village' | 'suburb' | 'quarter' | 'neighbourhood', string>>
}
const regionTypes = new Set(['state', 'province', 'city', 'county', 'borough', 'city_district', 'district', 'municipality', 'town', 'village', 'suburb', 'quarter', 'neighbourhood'])
const cache = new Map<string, string[]>()
let nextSearchAt = 0

/** 행정구역만 조합한다. 도로·건물·번지·우편번호는 표시하지 않는다. */
function simpleRegion(result: RegionResult): string | null {
  if (!regionTypes.has(result.addresstype) || result.address.country_code !== 'kr') return null
  const a = result.address
  const parts = [a.province ?? a.state, a.city, a.county, a.borough ?? a.city_district ?? a.district,
    a.municipality, a.town, a.village, a.suburb, a.quarter, a.neighbourhood, result.name]
    .filter((part): part is string => !!part && /[시도군구동읍면리가]$/.test(part))
  return parts.length ? [...new Set(parts)].join(' ') : null
}

export function AddressSearch({ onSelect }: { onSelect: (address: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const search = async () => {
    if (loading) return
    const keyword = query.trim().replace(/\s+/g, ' ')
    setError('')
    setResults(null)
    if (keyword.length < 2) { setError('동네 이름을 두 글자 이상 입력해 주세요.'); return }
    if (cache.has(keyword)) { setResults(cache.get(keyword)!); return }
    if (Date.now() < nextSearchAt) { setError('잠시 후 다시 검색해 주세요.'); return }
    nextSearchAt = Date.now() + 1100
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.search = new URLSearchParams({ q: keyword, format: 'jsonv2', countrycodes: 'kr',
        featureType: 'settlement', addressdetails: '1', limit: '20', 'accept-language': 'ko' }).toString()
      const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
      if (!response.ok) throw new Error('검색 실패')
      const data: RegionResult[] = await response.json()
      const addresses = [...new Set(data.map(simpleRegion).filter((address): address is string => !!address))]
      if (!controller.signal.aborted) { cache.set(keyword, addresses); setResults(addresses) }
    } catch {
      if (!controller.signal.aborted) setError('동네를 검색하지 못했어요. 인터넷 연결을 확인하고 다시 검색해 주세요.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return <div className={styles.addressSearch}>
    <label htmlFor="region-keyword">동네 이름
      <input id="region-keyword" value={query} maxLength={80} placeholder="예) 합정동, 서울 마포구" disabled={loading}
        onChange={(e) => { setQuery(e.target.value); setResults(null); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} />
    </label>
    <Button variant="line" onClick={() => void search()} loading={loading}>동네 검색</Button>
    {error && <p role="alert">{error}</p>}
    <div aria-live="polite">
      {results?.length === 0 && <p>검색 결과가 없어요. 시·군·구 또는 동·읍·면 이름으로 다시 검색해 주세요.</p>}
      {!!results?.length && <ul className={styles.addressResults} aria-label="간략한 주소 검색 결과">
        {results.map((address) => <li key={address}><button type="button" onClick={() => onSelect(address)}>{address}<span>선택</span></button></li>)}
      </ul>}
    </div>
    <a className={styles.sub} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
  </div>
}
