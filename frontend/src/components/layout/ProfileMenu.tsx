import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from '@/components/ui'
import { useAuthStore, useLogout } from '@/features/auth'
import { useLifeStore } from '@/features/life'
import { Avatar } from '@/features/profile'
import styles from './ProfileMenu.module.css'

type Props = {
  open: boolean
  onClose: () => void
}

/** 프로필 메뉴 (팀장님 시안 components/profile-menu.js): 왼쪽 메뉴 맨 아래(모바일은 위쪽)의 프로필 사진을 누르면 열림.
 * 프로필 보기(작은 창) · 설정(내 정보) · 로그아웃 */
export function ProfileMenu({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const settings = useLifeStore((s) => s.settings)
  const logout = useLogout()
  const navigate = useNavigate()
  const [viewOpen, setViewOpen] = useState(false)
  const name = user?.nickname ?? '자취생'

  // 바깥을 누르거나 Esc · 창 크기 변경이면 닫힘
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-profile-menu]') && !t.closest('[data-profile-opener]')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
    }
  }, [open, onClose])

  return (
    <>
      {open && (
        <div className={styles.menu} role="menu" data-profile-menu>
          <div className={styles.head}>
            <Avatar name={name} size={40} />
            <div>
              <b>{name}</b>
              <small>📍 {settings.region || '지역 미설정'}</small>
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              setViewOpen(true)
            }}
          >
            프로필 보기
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              navigate('/my/settings')
            }}
          >
            설정
          </button>
          <button type="button" role="menuitem" className={styles.out} onClick={() => logout.mutate()} disabled={logout.isPending}>
            로그아웃
          </button>
        </div>
      )}

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="프로필">
        <h3 className={styles.viewTitle}>프로필</h3>
        <dl className={styles.view}>
          <dt>닉네임</dt>
          <dd>{name}</dd>
          <dt>아이디</dt>
          <dd>{user?.username ?? user?.email ?? '-'}</dd>
          <dt>우리 동네</dt>
          <dd>{settings.region || '지역 미설정'}</dd>
          <dt>월세</dt>
          <dd>
            {settings.rent}만원 (매월 {settings.rentDay}일)
          </dd>
          <dt>알림</dt>
          <dd>{settings.notiOn ? '켜짐' : '꺼짐'}</dd>
        </dl>
        <div className={styles.viewActions}>
          <Button variant="line" onClick={() => setViewOpen(false)}>
            닫기
          </Button>
          <Button
            onClick={() => {
              setViewOpen(false)
              navigate('/my/settings')
            }}
          >
            내 정보 수정
          </Button>
        </div>
      </Modal>
    </>
  )
}
