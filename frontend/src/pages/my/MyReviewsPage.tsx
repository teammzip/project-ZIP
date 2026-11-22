import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { MyReviewsList } from '@/features/map/components/MyReviews'
import common from '@/styles/common.module.css'

/** 내 정보의 '내가 쓴 리뷰'에서 진입하는 하위 페이지. 별도 메뉴·탭은 추가하지 않습니다. */
export function MyReviewsPage() {
  return <Card title="내가 쓴 리뷰">
    <Link to="/my/settings" className={common.link}>← 내 정보로 돌아가기</Link>
    <p>내가 작성한 장소 리뷰를 모아 볼 수 있어요. 장소를 누르면 해당 장소의 리뷰가 열려요.</p>
    <MyReviewsList />
  </Card>
}
