import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function MapPage() {
  return (
    <PagePlaceholder
      title="동네"
      description="지도(OpenStreetMap)와 주변 장소 목록"
      legacy={['variants/app/js/views/map.js', 'variants/app/js/data/places.js', 'variants/app/css/views/map.css']}
    />
  )
}
