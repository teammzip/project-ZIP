import { normRegion } from './locateRegion'
import type { RegionVerify } from './types'

export const VERIFY_DAYS = 30

export function regionVerification(region: string, verify: RegionVerify | null, userId: string | undefined, now = Date.now()) {
  const remaining = verify ? VERIFY_DAYS * 86400000 - (now - verify.at) : 0
  const left = Math.ceil(remaining / 86400000)
  const verified = !!userId && !!region && !!verify && verify.userId === userId && verify.region === region && verify.at <= now && left > 0
  return { region, verified, at: verified ? verify.at : null, left: verified ? left : 0 }
}

/**
 * 서버 모드의 인증 판정. 인증 시각과 인증한 동네는 서버(DB)가 기준이라 어느 기기에서 들어와도 같아야 한다.
 * 동네 이름은 이 브라우저의 생활 설정을 먼저 쓰고(인증한 기기는 "서울 중구 명동"처럼 자세함),
 * 비어 있으면(다른 기기에서 인증했거나 브라우저 데이터를 지움) 로그인 응답의 회원 동네 이름을 쓴다.
 */
export function serverRegionVerification(localRegion: string, serverRegion: string | null | undefined, serverAt: string | null, userId: string | undefined, now = Date.now()) {
  const region = localRegion || serverRegion || ''
  return regionVerification(region, serverAt && userId ? { region, at: Date.parse(serverAt), userId } : null, userId, now)
}

/** 서버의 회원 동네 이름. 같은 이름의 다른 구(서울 · 부산 · 대구 중구)와 헷갈리지 않게 시 · 도를 붙인 이름을 먼저 씀 ("서울특별시 중구" → "서울 중구") */
export function serverRegionName(region: { name: string; fullName?: string } | null | undefined) {
  return normRegion(region?.fullName || region?.name || '')
}
