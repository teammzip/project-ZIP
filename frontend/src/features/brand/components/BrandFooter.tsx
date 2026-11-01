import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './BrandFooter.module.css'

const REPO = 'https://github.com/teammzip/project-ZIP'

const LINKS = [
  { to: '/start', label: '서비스 소개' },
  { to: '/terms', label: '이용약관' },
  { to: '/privacy', label: '개인정보 처리방침', strong: true },
  { to: '/signup', label: '회원가입' },
]

/** 브랜드 페이지 맨 아래: 링크 줄 → 팀 정보(펼치기) → 안내 → 깃허브 → 저작권. PC · 모바일 같은 구성 */
export function BrandFooter() {
  const [open, setOpen] = useState(false)
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label="서비스 정보">
          {LINKS.map((l) => (
            <Link key={l.label} to={l.to} className={l.strong ? styles.strong : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className={styles.company}>
          <button type="button" className={styles.companyBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            Team ZIP <span className={open ? styles.up : undefined} aria-hidden="true">⌄</span>
          </button>
          {open && <p className={styles.companyInfo}>자취생 생활 도우미 ZIP · 프론트엔드 · 백엔드 · 풀스택</p>}
          <p>ZIP은 팀 프로젝트로 만든 서비스예요. 지금은 입력한 정보가 이 브라우저에만 저장되고, AI 답변 · 장소 정보는 예시예요.</p>
        </div>

        <a className={styles.social} href={REPO} target="_blank" rel="noopener noreferrer" aria-label="ZIP 깃허브 (새 창)" title="GitHub">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
          </svg>
        </a>

        <p className={styles.copy}>Copyright 2026. Team ZIP. All rights reserved.</p>
      </div>
    </footer>
  )
}
