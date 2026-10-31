/** 생일이 지나기 전에는 한 살을 빼는 만 나이. 잘못된 날짜·미래 날짜는 null. */
export function calculateAge(birth: string, today: string): number | null {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  }
  if (!validDate(birth) || !validDate(today) || birth > today) return null
  return Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - (today.slice(5) < birth.slice(5) ? 1 : 0)
}
