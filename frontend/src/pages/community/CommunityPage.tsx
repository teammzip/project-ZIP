import { useProfile } from '@/app/useProfile'
import { useAuthStore } from '@/features/auth'
import { CommunityBoard } from '@/features/community'
import common from '@/styles/common.module.css'
import { TownTabs } from '../town/TownTabs'

export function CommunityPage() {
  const { name, region } = useProfile()
  const uid = useAuthStore((st) => st.user?.username)
  return (
    <div className={common.stack}>
      <TownTabs />
      <CommunityBoard region={region} author={name} uid={uid} />
    </div>
  )
}
