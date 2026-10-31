import { useEffect, useState } from 'react'
import { calculateAge } from './age'
import { todayStr } from './date'

/** 날짜 변경·탭 복귀 시 다시 계산한다. 나이는 저장하지 않고 생년월일에서 계산한다. */
export function useAge(birth: string) {
  const [today, setToday] = useState(todayStr)
  useEffect(() => {
    const refresh = () => setToday(todayStr())
    const timer = window.setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return { age: calculateAge(birth, today), today }
}
