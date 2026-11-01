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

/* 실제 앱 화면과 같은 구성으로 그림 (홈: 요약 카드 4개 + 메모 위젯, 일정: 칸 안 막대, 커뮤니티: 동네생활 목록, 지도: 네이버 지도 스타일) */
const CAL_BARS: Record<number, string[]> = {
  2: ['#1fb5a3'],
  6: ['#45aaf2', '#1fb5a3'],
  9: ['#7c6cf5'],
  13: ['#1fb5a3'],
  14: ['#ff5a7e', '#45aaf2'],
  20: ['#1fb5a3'],
  22: ['#f5a623'],
  23: ['#45aaf2', '#7c6cf5', '#1fb5a3'],
  27: ['#1fb5a3'],
  30: ['#ff5a7e'],
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
          <b>15개 남음</b>
          <i style={{ width: '62%' }} />
        </div>
        <div className={cx(styles.stat, styles.sky)}>
          <small>오늘 할 일</small>
          <b>4개 남음</b>
          <i style={{ width: '40%' }} />
        </div>
        <div className={cx(styles.stat, styles.navy)}>
          <small>오늘 날씨</small>
          <b>🌦️ 9° 이슬비</b>
          <em>서울시 마포구</em>
        </div>
        <div className={cx(styles.stat, styles.pink)}>
          <small>🎉 다가오는 기념일</small>
          <b>엄마 생신 D-5</b>
        </div>
      </div>
      <div className={styles.memo}>
        <p className={styles.memoHead}>
          📝 메모 <small>2개</small>
        </p>
        <div className={styles.memoNotes}>
          <div className={cx(styles.note, styles.noteYellow)}>
            <b>📌 장보기</b>
            <span>☐ 두부</span>
            <span className={styles.strike}>☑ 계란 한 판</span>
            <span>☐ 키친타월</span>
          </div>
          <div className={cx(styles.note, styles.notePink)}>
            <b>관리비 문의할 것</b>
            <span>엘리베이터 수리비 포함인지 확인하기</span>
          </div>
        </div>
        <p className={styles.memoQuick}>
          ✏️ 빠른 메모 남기기 <i>+</i>
        </p>
      </div>
    </>
  ),
  calendar: () => (
    <>
      <p className={styles.title}>내 일정</p>
      <div className={styles.calBar}>
        <span className={styles.pills}>
          <i>주간</i>
          <i className={styles.pillOn}>월간</i>
        </span>
        <b>2026.10</b>
      </div>
      <div className={styles.cal}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <em key={d} className={cx(i === 0 && styles.sun)}>
            {d}
          </em>
        ))}
        {Array.from({ length: 35 }, (_, i) => {
          const d = i - 3
          const inMonth = d >= 1 && d <= 31
          return (
            <span key={i} className={cx(d === 23 && styles.calSel, !inMonth && styles.calEmpty)}>
              {inMonth ? d : ''}
              {inMonth && CAL_BARS[d]?.map((c, k) => <i key={k} style={{ background: c }} />)}
            </span>
          )
        })}
      </div>
      <p className={styles.subTitle}>오늘 할 일</p>
      {[
        ['18:00', '장보기', false],
        ['18:00', '♻️ 재활용 배출', null],
        ['종일', '욕실 청소', true],
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
          <li style={{ '--c': 'var(--color-primary)' } as React.CSSProperties}>고정 지출 12%</li>
          <li style={{ '--c': '#f5a623' } as React.CSSProperties}>여가 4%</li>
        </ul>
      </div>
      <p className={styles.addBtn}>＋ 지출 기록하기</p>
      {[
        ['23', '마트 장보기', '41,000원'],
        ['22', '전시회', '22,000원'],
        ['20', '택시', '12,000원'],
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
      <div className={cx(styles.bubble, styles.bot)}>안녕하세요! 자취하면서 궁금한 걸 물어보세요 😊</div>
      <div className={cx(styles.bubble, styles.user)}>이건 어떻게 버려요?</div>
      <div className={styles.photo}>📦</div>
      <div className={cx(styles.bubble, styles.bot)}>
        택배 상자는 <b>테이프·송장을 떼고</b> 펼쳐서 종이류로 배출해요. 오늘이 재활용 날이에요! ♻️
      </div>
      <div className={styles.askBar}>
        <i>＋</i>
        <span>궁금한 걸 물어보세요</span>
        <b>↑</b>
      </div>
    </>
  ),
  community: () => (
    <>
      <div className={styles.commHead}>
        <p className={styles.title}>
          마포구 <span className={styles.blue}>동네생활</span>
        </p>
        <span className={styles.scope}>
          <i className={styles.scopeOn}>우리 동네</i>
          <i>주변</i>
          <i>전체</i>
        </span>
      </div>
      <div className={styles.topics}>
        <span className={styles.topicOn}>전체</span>
        <span>💬 자유</span>
        <span>💡 꿀팁</span>
        <span>❓ 질문</span>
      </div>
      <div className={styles.feed}>
        {[
          ['쓰레기 배출 시간 바뀐 건가요?', '어제부터 수거 시간이 달라진 것 같은데 아시는 분 계신가요?', '동네 · 20분 전', '♡ 7', '💬 1'],
          ['근처 세탁방 추천해 주세요', '이불 빨래할 수 있는 큰 세탁기 있는 곳이면 좋겠어요.', '질문 · 2시간 전', '♡ 3', ''],
          ['1인 가구 냉장고 관리 루틴', '채소는 물기를 제거한 뒤 채반에 잠깐 두고 보관하면 좋아요.', '꿀팁 · 5시간 전', '♡ 15', '💬 4'],
        ].map(([t, b, meta, like, cmt]) => (
          <div key={t} className={styles.item}>
            <b>{t}</b>
            <span>{b}</span>
            <small>
              마포구 · {meta}
              <em>
                {like} {cmt}
              </em>
            </small>
          </div>
        ))}
      </div>
    </>
  ),
  map: () => (
    <div className={styles.mapScreen}>
      <div className={styles.map}>
        <span className={styles.road1} />
        <span className={styles.road2} />
        <span className={styles.pin} style={{ left: '22%', top: '46%' }}>
          🧺
        </span>
        <span className={cx(styles.pin, styles.pinOn)} style={{ left: '60%', top: '34%' }}>
          🧺
        </span>
        <span className={styles.pin} style={{ left: '70%', top: '58%' }}>
          🧺
        </span>
        <span className={styles.me} style={{ left: '44%', top: '50%' }} />
      </div>
      <div className={styles.mapSearch}>📍 장소 검색 · AI에게 물어보기</div>
      <div className={styles.mapChips}>
        <span className={styles.topicOn}>🧺 세탁방</span>
        <span>🏪 편의점</span>
        <span>💊 약국</span>
      </div>
      <div className={styles.sheet}>
        <i className={styles.grab} />
        <div className={styles.sheetTabs}>
          <span className={styles.sheetTabOn}>📍 마포구</span>
          <span>★ 저장 2</span>
        </div>
        <p className={styles.sheetTitle}>
          이 주변 세탁방 <small>3곳</small>
        </p>
        {[
          ['세탁방 A', '도보 3분 · 대형 세탁기'],
          ['세탁방 B', '도보 6분 · 24시간'],
        ].map(([n, d], i) => (
          <div key={n} className={styles.place}>
            <span className={styles.placeThumb}>🧺</span>
            <span>
              <b>
                {i + 1} {n}
              </b>
              <small>{d}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
}
