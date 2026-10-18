import { useState } from 'react'

/** 화면이 처음 그려질 때의 "지금". 렌더할 때마다 new Date() 를 부르지 않게 한 번만 만들어 둠 */
export function useToday() {
  const [now] = useState(() => new Date())
  return now
}
