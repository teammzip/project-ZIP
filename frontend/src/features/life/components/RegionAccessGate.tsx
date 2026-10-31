import { useState, type ReactNode } from 'react'
import { Button, Card } from '@/components/ui'
import { useRegionVerify } from '../derive'
import { RegionVerifyDialog } from './RegionVerify'

/** 인증 전에 자식 컴포넌트를 마운트하지 않아 주소 조회·위치 요청도 막는다. */
export function RegionAccessGate({ children }: { children: ReactNode }) {
  const { verified } = useRegionVerify()
  const [open, setOpen] = useState(false)
  if (verified) return children
  return <Card title="동네 위치 인증이 필요해요">
    <p>현재 위치로 동네를 인증하면 커뮤니티를 이용할 수 있어요. 날씨와 지도는 인증 없이 이용할 수 있어요.</p>
    <Button onClick={() => setOpen(true)}>동네 인증하기</Button>
    <RegionVerifyDialog open={open} onClose={() => setOpen(false)} />
  </Card>
}
