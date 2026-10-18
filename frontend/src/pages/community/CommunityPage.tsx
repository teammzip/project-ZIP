import { useProfile } from '@/app/useProfile'
import { CommunityBoard } from '@/features/community'
import common from '@/styles/common.module.css'
import { TownTabs } from '../town/TownTabs'

export function CommunityPage() {
  const { name, region } = useProfile()
  return (
    <div className={common.stack}>
      <TownTabs />
      <CommunityBoard region={region} author={name} />
    </div>
  )
}
