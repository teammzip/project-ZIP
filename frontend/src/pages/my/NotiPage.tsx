import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function NotiPage() {
  return (
    <PagePlaceholder
      title="알림"
      description="알림 목록, 안 읽은 알림 빨간 점"
      legacy={['variants/app/js/views/noti.js', 'variants/app/css/views/noti.css']}
    />
  )
}
