import { readMapPoint } from '@/features/map/location'

export type AddressOption = { address: string; point: { lat: number; lon: number } }
export type RegionResult = {
  name: string
  lat: string
  lon: string
  addresstype: string
  address: Partial<Record<'country_code' | 'province' | 'state' | 'city' | 'county' | 'borough' | 'city_district' | 'district' | 'municipality' | 'town' | 'village' | 'suburb' | 'quarter' | 'neighbourhood', string>>
}
const regionTypes = new Set(['state', 'province', 'city', 'county', 'borough', 'city_district', 'district', 'municipality', 'town', 'village', 'suburb', 'quarter', 'neighbourhood'])

/** 도로·번지 대신 행정구역 주소와 해당 검색 결과의 좌표를 함께 선택. */
export function addressOption(result: RegionResult): AddressOption | null {
  if (!regionTypes.has(result.addresstype) || result.address.country_code !== 'kr' || !result.lat?.trim() || !result.lon?.trim()) return null
  const point = readMapPoint({ lat: Number(result.lat), lon: Number(result.lon) })
  if (!point) return null
  const a = result.address
  const parts = [a.province ?? a.state, a.city, a.county, a.borough ?? a.city_district ?? a.district,
    a.municipality, a.town, a.village, a.suburb, a.quarter, a.neighbourhood, result.name]
    .filter((part): part is string => !!part && /[시도군구동읍면리가]$/.test(part))
  return parts.length ? { address: [...new Set(parts)].join(' '), point } : null
}
