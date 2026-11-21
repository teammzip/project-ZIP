import { useLocation } from 'react-router-dom'
import { MapView } from '@/features/map'
import { useNearbyMap } from '@/features/map/nearbyMap'
import common from '@/styles/common.module.css'

export function MapPage() {
  const { state } = useLocation()
  const result = useNearbyMap((store) => store.result)
  const nearby = result && result.id === state?.nearbyId ? result : null

  return (
    <div className={common.stack}>
      <MapView key={nearby?.id ?? 'map'} initialNearby={nearby} />
    </div>
  )
}
