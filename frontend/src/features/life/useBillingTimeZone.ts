import { useEffect, useState } from 'react'
import { isMockApi } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useHousingSurveyStore } from '@/features/onboarding/store'
import { useLifeStore } from './store'
import { useHomeInfo } from './homeApi'
import { deviceTimeZone } from './monthlyPeriod'
import { registeredBillingAddress, resolveBillingTimeZone, type BillingTimeZone } from './billingTimeZone'
import { addressTimeZone, locationTimeZone } from './billingTimeZoneApi'

/** DB의 집 주소를 우선 읽은 다음 주소 → 실제 위치 → 기기 순으로 확정한다. */
export function useBillingTimeZone() {
  const user = useAuthStore((s) => s.user)
  const sessionKey = useAuthStore((s) => s.sessionKey)
  const localHome = useLifeStore((s) => user ? s.settings.homeAddresses?.[user.id] ?? '' : '')
  const survey = useHousingSurveyStore((s) => s.survey)
  const remote = useHomeInfo()
  const address = registeredBillingAddress(user, remote.data?.settings.homeAddress ?? localHome, survey)
  const label = address.label, lat = address.point?.lat, lon = address.point?.lon
  const key = JSON.stringify([user?.id, sessionKey, label, lat, lon])
  const authenticated = !!user && !!sessionKey
  const waiting = !isMockApi && !!user && !!sessionKey && remote.isPending
  const [resolution, setResolution] = useState<{ key: string; choice?: BillingTimeZone }>({ key: '' })
  useEffect(() => {
    if (waiting || !authenticated) return
    let controller: AbortController | undefined
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      setResolution({ key })
      void resolveBillingTimeZone({
        address: { label, ...(lat !== undefined && lon !== undefined ? { point: { lat, lon } } : {}) },
        deviceZone: deviceTimeZone(), signal, addressZone: addressTimeZone, locationZone: locationTimeZone,
      }).then((choice) => { if (!signal.aborted) setResolution({ key, choice }) }).catch(() => {})
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      controller?.abort()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [key, waiting, authenticated, label, lat, lon])
  const choice = !waiting && resolution.key === key ? resolution.choice : undefined
  return { choice, resolving: !choice }
}
