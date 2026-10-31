export type MapPoint = { lat: number; lon: number }

/** 화면 간 전달한 좌표도 유효 범위를 확인한다. 0도 정상 좌표다. */
export function readMapPoint(value: unknown): MapPoint | null {
  if (!value || typeof value !== 'object' || !('lat' in value) || !('lon' in value)) return null
  const { lat, lon } = value
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}

export function getCurrentMapPosition(): Promise<MapPoint> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 브라우저에서는 현재 위치를 확인할 수 없어요.'))
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = readMapPoint({ lat: coords.latitude, lon: coords.longitude })
        if (point) resolve(point)
        else reject(new Error('현재 위치 정보를 확인하지 못했어요.'))
      },
      (error) => reject(new Error(error.code === 1 ? '위치 권한을 허용하면 내 주변을 볼 수 있어요.' : '현재 위치를 확인하지 못했어요. 다시 시도해 주세요.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
