import { useEffect, useState } from 'react'
import { getCurrentMapPosition, type MapPoint } from './location'

type PositionState = { point: MapPoint | null; loading: boolean; error: string }

/** 홈에서 받은 위치를 즉시 사용하고 새 위치도 확인. 좌표를 URL이나 영구 저장소에 저장하지 않음. */
export function useCurrentMapPosition(initialPoint: MapPoint | null = null) {
  const [attempt, setAttempt] = useState(0)
  const [position, setPosition] = useState<PositionState>({ point: initialPoint, loading: true, error: '' })
  useEffect(() => {
    let active = true
    void getCurrentMapPosition().then(
      (point) => { if (active) setPosition({ point, loading: false, error: '' }) },
      (error: unknown) => {
        if (active) setPosition((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : '현재 위치를 확인하지 못했어요.' }))
      },
    )
    return () => { active = false }
  }, [attempt])
  const retry = () => {
    setPosition((previous) => ({ ...previous, loading: true, error: '' }))
    setAttempt((value) => value + 1)
  }
  return { ...position, retry }
}
