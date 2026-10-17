import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function PhotoPage() {
  return (
    <PagePlaceholder
      title="사진"
      description="사진을 찍어 분리배출·요리 등을 물어보는 화면"
      legacy={['variants/app/js/views/ai.js']}
    />
  )
}
