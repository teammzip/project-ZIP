import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'
import { apiClient } from '@/lib/apiClient'
import { isMockApi } from '@/lib/apiMode'
import { DOW } from '@/lib/date'
import common from '@/styles/common.module.css'
import styles from './calendar.module.css'

type TrashKind = { days: number[]; startTime: string }
type TrashSchedule = {
  regionName: string | null
  items: Array<{ place: string; general: TrashKind | null; food: TrashKind | null; recycle: TrashKind | null }>
}

export function TrashScheduleDisclosure() {
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className={styles.trashSummary}>우리 동네 배출표 보기</summary>
        <TrashScheduleTable open={open} />
      </details>
    </Card>
  )
}

function TrashScheduleTable({ open }: { open: boolean }) {
  const userId = useAuthStore((state) => state.user?.id)
  const sessionKey = useAuthStore((state) => state.sessionKey)
  const query = useQuery({
    queryKey: ['trash-schedules', userId, sessionKey],
    queryFn: async ({ signal }) => (await apiClient.get<TrashSchedule>('/trash-schedules/me', { signal })).data,
    enabled: open && !isMockApi && !!userId && !!sessionKey,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })

  if (!open) return null
  if (isMockApi) return <p className={common.note}>배출표는 서버에 연결하면 볼 수 있어요.</p>
  if (!userId || !sessionKey) return <p className={common.note}>로그인하면 배출표를 볼 수 있어요.</p>
  if (query.isError) return (
    <div role="alert" className={styles.trashFeedback}>
      <p>배출표를 불러오지 못했어요.</p>
      <Button variant="line" onClick={() => void query.refetch()}>다시 조회</Button>
    </div>
  )
  if (query.isPending) return <p role="status" className={common.note}>배출표를 불러오는 중이에요.</p>

  const { regionName, items } = query.data
  if (!regionName) return (
    <p className={common.note}>
      등록한 주소에서 시·군·구를 찾지 못했어요. <Link to="/my/settings" className={common.link}>내 정보에서 주소 확인</Link>
    </p>
  )
  if (!items.length) return <p className={common.note}>{regionName}의 배출표가 없어요. 시·군·구청 안내를 확인해 주세요.</p>

  return (
    <>
      <div className={styles.trashTableWrap} role="region" aria-label="배출표 스크롤 영역" tabIndex={0}>
        <table className={styles.trashTable}>
          <caption>{regionName} 쓰레기 배출표</caption>
          <thead>
            <tr>
              <th scope="col">배출 장소</th>
              <th scope="col">생활쓰레기</th>
              <th scope="col">음식물</th>
              <th scope="col">재활용</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ place, general, food, recycle }, index) => (
              <tr key={`${place}-${index}`}>
                <th scope="row">{place}</th>
                <TrashKindCell kind={general} />
                <TrashKindCell kind={food} />
                <TrashKindCell kind={recycle} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={common.note}>같은 지역도 장소마다 요일과 시간이 달라요. 정확한 일정은 시·군·구청 안내를 확인해 주세요.</p>
      {/* 공공데이터 출처 표시 (이용약관 제2조 · 소개 페이지 푸터와 같은 안내) */}
      <p className={common.note}>
        출처: 행정안전부 「전국생활쓰레기배출정보표준데이터」 (<a href="https://www.data.go.kr/data/15025450/standard.do" target="_blank" rel="noopener noreferrer" className={common.link}>공공데이터포털</a>)
      </p>
    </>
  )
}

function TrashKindCell({ kind }: { kind: TrashKind | null }) {
  if (!kind) return <td className={styles.trashTime}>정보 없음</td>

  return (
    <td>
      {kind.days.map((day) => DOW[day]).join(' · ')}
      <small className={styles.trashTime}>
        {kind.startTime === '00:00' ? '시간 확인 필요' : <time dateTime={kind.startTime}>{kind.startTime}부터</time>}
      </small>
    </td>
  )
}
