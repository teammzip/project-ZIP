import { useSyncExternalStore } from 'react'

/** 화면 폭 조건이 맞는지 (창 크기가 바뀌면 다시 그림). 예: useMediaQuery('(max-width: 900px)') */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}
