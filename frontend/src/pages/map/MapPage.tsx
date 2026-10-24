import { MapView } from '@/features/map'
import common from '@/styles/common.module.css'

export function MapPage() {
  return (
    <div className={common.stack}>
      <MapView />
    </div>
  )
}
