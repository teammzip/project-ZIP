import type { RegionVerify } from './types'

export const VERIFY_DAYS = 30

export function regionVerification(region: string, verify: RegionVerify | null, userId: string | undefined, now = Date.now()) {
  const remaining = verify ? VERIFY_DAYS * 86400000 - (now - verify.at) : 0
  const left = Math.ceil(remaining / 86400000)
  const verified = !!userId && !!region && !!verify && verify.userId === userId && verify.region === region && verify.at <= now && left > 0
  return { region, verified, at: verified ? verify.at : null, left: verified ? left : 0 }
}
