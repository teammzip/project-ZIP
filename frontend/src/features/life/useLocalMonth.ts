import { useEffect, useState } from 'react'
import { deviceTimeZone, monthInZone, nextMinuteDelay } from './monthlyPeriod'

export function useLocalMonth(preferredTimeZone?: string) {
  const [clock, setClock] = useState(() => {
    const timeZone = preferredTimeZone || deviceTimeZone()
    return { timeZone, currentMonth: monthInZone(Date.now(), timeZone) }
  })
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const timeZone = preferredTimeZone || deviceTimeZone(), now = Date.now()
      const currentMonth = monthInZone(now, timeZone)
      setClock((old) => old.timeZone === timeZone && old.currentMonth === currentMonth ? old : { timeZone, currentMonth })
      timer = setTimeout(refresh, nextMinuteDelay(now))
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [preferredTimeZone])
  return clock
}
