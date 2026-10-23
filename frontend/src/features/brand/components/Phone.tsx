import { cx } from '@/lib/cx'
import styles from './Phone.module.css'

/* 시작 화면에서 쓰는 "앱 화면 그림": 휴대폰 틀 안에 실제 ZIP 앱 화면을 작게 그린 것 (그림이라 클릭 안 됨).
 * TODO: 실제 앱 캡처 이미지가 생기면 <img> 로 바꿔도 돼요. */

export type ScreenName = 'home' | 'calendar' | 'budget' | 'ai' | 'community' | 'map'

export function Phone({ screen, className }: { screen: ScreenName; className?: string }) {
  const Screen = SCREENS[screen]
  return (
    <div className={cx(styles.phone, className)} aria-hidden="true">
      <div className={styles.notch} />
      <div className={styles.screen}>
        <Screen />
      </div>
    </div>
  )
}

const SCREENS: Record<ScreenName, () => React.ReactElement> = {
  home: () => (
    <>
      <p className={styles.date}>10월 23일 금요일</p>
      <p className={styles.hello}>
        안녕하세요, <b>지기</b>님
      </p>
      <div className={styles.grid2}>
        <div className={cx(styles.stat, styles.teal)}>
          <small>전체 일정</small>
          <b>7개 남음</b>
          <i style={{ width: '62%' }} />
        </div>
        <div className={cx(styles.stat, styles.sky)}>
          <small>오늘 할 일</small>
          <b>3개 남음</b>
          <i style={{ width: '40%' }} />
        </div>
        <div className={cx(styles.stat, styles.pink)}>
          <small>쓰레기 배출</small>
          <b>오늘은 재활용</b>
        </div>
        <div className={cx(styles.stat, styles.purple)}>
          <small>월세 납부일</small>
          <b>D-3</b>
        </div>
      </div>
      <div className={styles.card}>
        <small>월별 수입</small>
        <div className={styles.bars}>
          {[50, 64, 42, 70, 58, 88].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} className={cx(i === 5 && styles.barOn)} />
          ))}
        </div>
      </div>
    </>
  ),
  calendar: () => (
    <>
      <p className={styles.title}>2026년 10월</p>
      <div className={styles.cal}>
        {Array.from({ length: 35 }, (_, i) => {
          const d = i - 3
          return (
            <span key={i} className={cx(d === 23 && styles.calSel, d < 1 || d > 31 ? styles.calEmpty : '')}>
              {d >= 1 && d <= 31 ? d : ''}
              {[2, 9, 14, 23, 24, 27].includes(d) && <i />}
            </span>
          )
        })}
      </div>
      <p className={styles.subTitle}>오늘 할 일</p>
      {[
        ['18:00', '장보기', false],
        ['18:00', '♻️ 재활용 배출', null],
        ['종일', '욕실 청소', true],
        ['종일', '수도요금 납부', false],
      ].map(([t, name, done]) => (
        <div key={String(name)} className={cx(styles.row, done === null && styles.rowTrash)}>
          {done !== null && <span className={cx(styles.check, !!done && styles.checkOn)} />}
          <small>{t}</small>
          <span className={cx(!!done && styles.strike)}>{name}</span>
        </div>
      ))}
    </>
  ),
  budget: () => (
    <>
      <p className={styles.title}>이번 달 지출 구성</p>
      <div className={styles.donutRow}>
        <div className={styles.donut}>
          <b>83.5만</b>
        </div>
        <ul className={styles.legend}>
          <li style={{ '--c': 'var(--color-purple)' } as React.CSSProperties}>월세 66%</li>
          <li style={{ '--c': 'var(--color-teal)' } as React.CSSProperties}>식비 13%</li>
          <li style={{ '--c': 'var(--color-primary)' } as React.CSSProperties}>공과금 12%</li>
          <li style={{ '--c': '#f5a623' } as React.CSSProperties}>여가 4%</li>
        </ul>
      </div>
      <p className={styles.subTitle}>기타 지출</p>
      {[
        ['23', '마트 장보기', '41,000원'],
        ['22', '전시회', '22,000원'],
        ['20', '택시', '12,000원'],
        ['18', '수납박스', '11,900원'],
      ].map(([d, name, amt]) => (
        <div key={name} className={styles.money}>
          <span className={styles.day}>{d}</span>
          <span>{name}</span>
          <b>{amt}</b>
        </div>
      ))}
    </>
  ),
  ai: () => (
    <>
      <p className={styles.title}>🤖 AI와 대화</p>
      <div className={cx(styles.bubble, styles.bot)}>안녕하세요! 자취하면서 궁금한 걸 물어보세요 😊</div>
      <div className={cx(styles.bubble, styles.user)}>이건 어떻게 버려요?</div>
      <div className={styles.photo}>📦</div>
      <div className={cx(styles.bubble, styles.bot)}>
        택배 상자는 <b>테이프·송장을 떼고</b> 펼쳐서 종이류로 배출해요. 오늘이 재활용 날이에요! ♻️
      </div>
      <div className={styles.chips}>
        <span>♻️ 분리배출</span>
        <span>🍳 냉장고 요리</span>
        <span>📊 지출 요약</span>
      </div>
    </>
  ),
  community: () => (
    <>
      <p className={styles.title}>서울 마포구 이야기</p>
      <div className={styles.tabs}>
        <span className={styles.tabOn}>전체</span>
        <span>꿀팁</span>
        <span>질문</span>
        <span>동네</span>
      </div>
      {[
        ['💡', '#e9f7f2', '작은 방을 넓어 보이게 정리하는 법', '♥ 12 · 💬 3'],
        ['🧴', '#e3efff', '세제는 이렇게 놓으면 관리가 편해요', '♥ 9 · 💬 1'],
        ['🥗', '#f3efff', '1인 가구 냉장고 관리 루틴', '♥ 15 · 💬 4'],
        ['🧺', '#fff1e6', '근처 세탁방 추천해 주세요', '♥ 3 · 💬 2'],
      ].map(([e, bg, t, meta]) => (
        <div key={t} className={styles.post}>
          <span className={styles.thumb} style={{ background: bg }}>
            {e}
          </span>
          <span className={styles.postText}>
            <b>{t}</b>
            <small>{meta}</small>
          </span>
        </div>
      ))}
    </>
  ),
  map: () => (
    <>
      <p className={styles.title}>우리 동네 지도</p>
      <div className={styles.map}>
        <span className={styles.road1} />
        <span className={styles.road2} />
        <span className={styles.pin} style={{ left: '30%', top: '35%' }}>
          🧺
        </span>
        <span className={styles.pin} style={{ left: '62%', top: '22%' }}>
          🏪
        </span>
        <span className={styles.pin} style={{ left: '55%', top: '62%' }}>
          💊
        </span>
        <span className={styles.me} style={{ left: '44%', top: '46%' }} />
      </div>
      {[
        ['세탁방 A', '도보 3분 · 대형 세탁기'],
        ['편의점 B', '도보 4분 · 24시간'],
        ['약국 A', '도보 5분 · 평일 9~21시'],
      ].map(([n, d]) => (
        <div key={n} className={styles.place}>
          <b>{n}</b>
          <small>{d}</small>
        </div>
      ))}
    </>
  ),
}
