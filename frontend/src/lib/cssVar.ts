import type { CSSProperties } from 'react'

/** CSS 변수를 style 로 넘길 때 타입 맞추기: style={cssVar({ '--c': 'red' })} */
export const cssVar = (vars: Record<`--${string}`, string | number>) => vars as CSSProperties
