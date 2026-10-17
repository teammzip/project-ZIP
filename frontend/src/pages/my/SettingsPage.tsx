import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function SettingsPage() {
  return (
    <PagePlaceholder
      title="내 정보"
      description="이름, 동네, 월세, 알림 켜기/끄기, 데이터 초기화, 회원 탈퇴"
      legacy={['variants/app/js/views/settings.js', 'variants/app/js/components/account.js']}
    />
  )
}
