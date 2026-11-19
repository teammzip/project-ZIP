import { Link } from 'react-router-dom'
import { useProfile } from '@/app/useProfile'
import { Card } from '@/components/ui'
import { isMockApi, useAuthStore } from '@/features/auth'
import { normRegion } from '@/features/life'
import common from '@/styles/common.module.css'
import { useCommunityStore } from '../store'
import { usePopularPosts } from '../useCommunity'
import styles from './HomeCommunityPosts.module.css'

export function HomeCommunityPosts() {
  const { region } = useProfile()
  const userId = useAuthStore((state) => state.user?.id)
  const localPosts = useCommunityStore((state) => state.posts)
  const popular = usePopularPosts(userId, region)
  const posts = isMockApi
    ? localPosts
        .filter((post) => region && normRegion(post.region) === normRegion(region))
        .sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || b.ts - a.ts || b.id - a.id)
        .slice(0, 3)
    : popular.data ?? []

  return (
    <Card title="커뮤니티 게시글" actions={<Link to="/community" className={common.link}>더 보기</Link>}>
      {posts.length > 0 ? (
        <ol className={styles.ranking} aria-label="우리 동네 게시글 조회 수 순위">
          {posts.map((post, index) => (
            <li key={post.id}>
              <Link to={`/community?post=${post.id}`} className={styles.tip}>
                <span className={styles.thumb}>{index + 1}위</span>
                <span className={styles.tipInfo}>
                  <b>{post.title}</b>
                  <small>{post.author} · 조회 {(post.views ?? 0).toLocaleString('ko-KR')}</small>
                </span>
                <span className={common.tag}>{post.cat}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : !isMockApi && popular.isLoading ? (
        <p>게시글을 불러오는 중이에요.</p>
      ) : !isMockApi && popular.isError ? (
        <p>게시글을 불러오지 못했어요.</p>
      ) : (
        <p>{region ? '우리 동네에 올라온 게시글이 아직 없어요.' : '내 정보에서 우리 동네를 설정하면 게시글 순위를 볼 수 있어요.'}</p>
      )}
    </Card>
  )
}
