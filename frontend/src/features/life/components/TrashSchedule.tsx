import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { cx } from '@/lib/cx'
import { DOW } from '@/lib/date'
import { useToday } from '@/lib/useToday'
import common from '@/styles/common.module.css'
import { TRASH } from '../data/catalog'
import styles from './life.module.css'

/** 쓰레기 배출: 요일별 일정 + 오늘 배출 + 분리배출 기본 */
export function TrashSchedule() {
  const todayIdx = useToday().getDay()
  const td = TRASH[todayIdx]

  return (
    <div className={common.layout}>
      <Card title="요일별 배출 일정" actions={<span className={cx(common.tag, common.tagPurple)}>예시 데이터</span>}>
        {TRASH.map((x, i) => (
          <div key={DOW[i]} className={cx(styles.weekRow, i === todayIdx && styles.weekToday)}>
            <span className={styles.dow}>{DOW[i]}</span>
            <div className={styles.weekItem}>
              {x ? x.t : '배출 없음'}
              {x && <small>{x.d}</small>}
            </div>
            {i === todayIdx && <span className={cx(common.tag, common.tagWarn)}>오늘</span>}
          </div>
        ))}
        <p className={common.note}>실제 배출 요일과 시간은 지역마다 달라요. 사는 동네 구청 안내를 확인하세요.</p>
      </Card>

      <Card title="오늘 배출">
        <div className={styles.todayBox}>
          <b>{td ? td.t : '배출 없음'}</b>
          {td ? td.d : '오늘은 배출하는 날이 아니에요. 쓰레기는 모아 두세요.'}
        </div>
        <h3 className={styles.subHead}>분리배출 기본</h3>
        <ul className={styles.tipList}>
          <li>플라스틱·캔·유리병은 비우고 헹군 뒤 라벨 제거</li>
          <li>종이는 테이프·스테이플러 제거 후 펼쳐서 묶기</li>
          <li>음식물은 종량제(음식물) 봉투나 전용 용기 사용</li>
          <li>기름기 남은 배달 용기는 일반쓰레기</li>
        </ul>
        <Link to="/ai?topic=trash" className={styles.lineLink}>
          이건 어떻게 버려요? AI에게 묻기
        </Link>
      </Card>
    </div>
  )
}
