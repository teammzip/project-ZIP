import { Card } from '@/components/ui'
import { ProfilePersonalInfo } from '@/features/profile'
import common from '@/styles/common.module.css'

export function PersonalInfoCard() {
  return <Card title="내 정보"><div className={common.stack}>
    <ProfilePersonalInfo />
  </div></Card>
}
