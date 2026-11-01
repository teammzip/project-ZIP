/** 입력 상태는 쉼표 없는 숫자 문자열로 유지. 빈 값과 0, 소수점 입력 중 상태를 구분. */
export function normalizeAmountInput(text: string, decimalPlaces = 0): string | null {
  const value = text.replace(/[,\s₩원]/g, '')
  if (!value) return ''
  if (!/^\d*\.?\d*$/.test(value) || (decimalPlaces === 0 && value.includes('.'))) return null
  const [whole, decimal] = value.split('.')
  const integer = (whole || '0').replace(/^0+(?=\d)/, '')
  return decimal === undefined ? integer : `${integer}.${decimal.slice(0, decimalPlaces)}`
}

export function formatAmountInput(value: string): string {
  const [integer, decimal] = value.split('.')
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimal === undefined ? formatted : `${formatted}.${decimal}`
}

/** 쉼표를 제외한 문자 수로 커서를 복원해 중간 입력 때 끝으로 튀지 않게 함. */
export function amountCaretPosition(formatted: string, characterCount: number): number {
  if (characterCount <= 0) return 0
  let count = 0
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ',') count++
    if (count === characterCount) return i + 1
  }
  return formatted.length
}
