import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { amountCaretPosition, formatAmountInput, normalizeAmountInput } from '@/lib/amountInput'

type Props = Omit<ComponentProps<'input'>, 'type' | 'inputMode' | 'value' | 'onChange' | 'defaultValue' | 'min' | 'max' | 'step'> & {
  /** 쉼표 없는 숫자 문자열. 저장하는 쪽에서는 Number(value)로 변환. */
  value: string
  onValueChange: (value: string) => void
  max?: number
  decimalPlaces?: number
}

/** 모든 금액 입력의 표시 형식·숫자 키패드·최대 금액 검증을 통일. */
export function AmountInput({ value, onValueChange, max, decimalPlaces = 0, onKeyDown, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const formatted = formatAmountInput(value)
  useLayoutEffect(() => {
    const input = ref.current
    if (!input) return
    input.setCustomValidity(value && max !== undefined && Number(value) > max ? `${formatAmountInput(String(max))} 이하로 입력해 주세요.` : '')
    if (caret.current !== null && document.activeElement === input) {
      input.setSelectionRange(caret.current, caret.current)
    }
    caret.current = null
  })

  return <input
    {...props}
    ref={ref}
    type="text"
    inputMode={decimalPlaces ? 'decimal' : 'numeric'}
    value={formatted}
    onKeyDown={(event) => {
      onKeyDown?.(event)
      if (event.defaultPrevented) return
      const input = event.currentTarget
      const position = input.selectionStart
      if (position === null || position !== input.selectionEnd) return
      // 쉼표 바로 옆에서는 실제 숫자가 지워지도록 건너뛴다.
      if (event.key === 'Backspace' && input.value[position - 1] === ',') input.setSelectionRange(position - 1, position - 1)
      if (event.key === 'Delete' && input.value[position] === ',') input.setSelectionRange(position + 1, position + 1)
    }}
    onChange={(event) => {
      const input = event.currentTarget
      const prefix = input.value.slice(0, input.selectionStart ?? input.value.length)
      const next = normalizeAmountInput(input.value, decimalPlaces)
      if (next === null) {
        input.value = formatted
        return
      }
      const nextFormatted = formatAmountInput(next)
      // 앞의 0이 정리된 경우에도 실제 숫자 위치에 맞춰 커서를 계산.
      const normalizedPrefix = normalizeAmountInput(prefix, decimalPlaces) ?? ''
      caret.current = amountCaretPosition(nextFormatted, normalizedPrefix.length)
      input.value = nextFormatted
      input.setSelectionRange(caret.current, caret.current)
      onValueChange(next)
    }}
  />
}
