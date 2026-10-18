import { MapView } from '@/features/map'
import common from '@/styles/common.module.css'
import { TownTabs } from '../town/TownTabs'

export function MapPage() {
  return (
    <div className={common.stack}>
      <TownTabs />
      <MapView />
    </div>
  )
}
