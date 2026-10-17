import { PagePlaceholder } from '@/components/common/PagePlaceholder'

export function CommunityPage() {
  return (
    <PagePlaceholder
      title="커뮤니티"
      description="글 목록·상세, 좋아요·댓글, 동네 범위"
      legacy={['variants/app/js/views/community.js', 'variants/app/js/data/posts-seed.js', 'variants/app/css/views/community.css']}
    />
  )
}
