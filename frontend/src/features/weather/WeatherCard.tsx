import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal } from '@/components/ui'
import { useLifeStore } from '@/features/life/store'
import { RegionVerifyDialog, useRegionVerify } from '@/features/life'
import { cx } from '@/lib/cx'
import common from '@/styles/common.module.css'
import home from '@/features/life/components/home.module.css'
import { fetchForecast, koreaTime, probabilityText, resolveWeatherPlace, temperatureText, upcomingHours, weatherDescription } from './api'
import styles from './WeatherCard.module.css'

export function WeatherCard() {
  const region = useLifeStore((s) => s.settings.region.trim())
  const [open, setOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const { verified } = useRegionVerify()
  const [now, setNow] = useState(Date.now)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const day = koreaTime(now).slice(0, 10)
  const location = useQuery({
    queryKey: ['weather-place', region], queryFn: ({ signal }) => resolveWeatherPlace(region, signal),
    enabled: !!region, staleTime: Infinity, retry: false,
  })
  const forecast = useQuery({
    queryKey: ['weather', location.data?.latitude, location.data?.longitude, day],
    queryFn: ({ signal }) => fetchForecast(location.data!, signal), enabled: !!location.data,
    staleTime: 10 * 60 * 1000, refetchInterval: 15 * 60 * 1000, refetchOnWindowFocus: true, retry: false,
  })
  const data = forecast.data
  const error = location.error || forecast.error
  const loading = location.isFetching || forecast.isFetching
  const condition = weatherDescription(data?.current.weather_code, data?.current.is_day !== 0)
  const index = data?.daily.time.indexOf(day) ?? -1
  const low = data?.daily.temperature_2m_min[index]
  const high = data?.daily.temperature_2m_max[index]
  const rain = data?.daily.precipitation_probability_max[index]
  const retry = () => { if (!location.data) void location.refetch(); else void forecast.refetch() }
  const close = () => { setOpen(false); trigger.current?.focus() }

  return <>
    <button ref={trigger} type="button" className={cx(home.stat, styles.card)} onClick={() => setOpen(true)} aria-label="오늘 날씨 자세히 보기" aria-haspopup="dialog">
      <span className={home.statLabel}>오늘 날씨</span>
      {region && data ? <>
        <span className={home.statValue}><span aria-hidden="true">{condition.icon}</span> {temperatureText(data.current.temperature_2m)}<small>{condition.text}</small></span>
        <span className={styles.region}>{region}</span>
        <span className={styles.summary}>최저 {temperatureText(low)} · 최고 {temperatureText(high)} · 강수 {probabilityText(rain)}</span>
        {error && <span className={styles.summary}>갱신 실패 · 이전 정보</span>}
      </> : <>
        <span className={cx(home.statValue, home.valueSm)}>{!region ? '동네를 설정해 주세요' : error ? '날씨를 불러오지 못했어요' : '날씨를 불러오는 중…'}</span>
        <span className={styles.summary}>{!region ? '눌러서 우리 동네 설정' : error ? '눌러서 다시 시도' : region}</span>
      </>}
      <span className={styles.source}>Open-Meteo · OpenStreetMap</span>
    </button>
    <Modal open={open && !verifyOpen} onClose={close} title="오늘 날씨" className={styles.dialog}>
      <div className={styles.detail}>
        <header><h3>오늘 날씨</h3><p>{day.replaceAll('-', '.')} · 한국 시간</p></header>
        <RegionForm key={region} region={region} />
        <div>
          <Button variant="line" onClick={() => setVerifyOpen(true)} aria-haspopup="dialog">
            {verified ? '현 위치 다시 인증' : '현 위치 인증'}
          </Button>
          <p className={styles.updated}>위치를 인증하면 현재 동네의 날씨로 변경돼요.</p>
        </div>
        {!region && <p className={common.empty}>우리 동네를 저장하면 날씨를 보여드려요.</p>}
        {region && !data && !error && <p role="status">날씨를 불러오는 중이에요.</p>}
        {region && error && <p className={common.formError} role="alert">{error instanceof Error && error.message.includes('동네') ? error.message : '날씨를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'}{data && ' 아래는 마지막으로 받은 정보예요.'}</p>}
        {region && data && <>
          <div className={styles.current}>
            <span aria-hidden="true">{condition.icon}</span><strong>{temperatureText(data.current.temperature_2m)}</strong><span>{condition.text}</span>
          </div>
          <p className={styles.range}>최저 {temperatureText(low)} · 최고 {temperatureText(high)} · 오늘 최대 강수확률 {probabilityText(rain)}</p>
          <p className={styles.updated}>{data.current.time.replace('T', ' ')} 기준 · 15분마다 갱신</p>
          <section className={styles.hourSection} aria-label="시간대별 예보">
            <h4>앞으로 12시간</h4>
            <ul className={styles.hours}>
              {upcomingHours(data, now).map((hour) => {
                const weather = weatherDescription(hour.code, hour.isDay)
                return <li key={hour.time}>
                  <time dateTime={`${hour.time}+09:00`}>{hour.time.slice(0, 10) !== day ? '내일 ' : ''}{hour.time.slice(11, 16)}</time>
                  <span aria-label={weather.text}>{weather.icon}</span>
                  <b>{temperatureText(hour.temperature)}</b>
                  <small>강수 {probabilityText(hour.probability)}</small>
                </li>
              })}
            </ul>
          </section>
        </>}
        {region && <Button variant="line" onClick={retry} disabled={loading}>{loading ? '불러오는 중…' : error ? '다시 시도' : '새로고침'}</Button>}
        <p className={styles.updated}>동네 중심 좌표의 예보이며 실제 날씨와 다를 수 있어요.</p>
        <footer className={styles.attribution}>날씨: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · 지역: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap 기여자</a></footer>
      </div>
    </Modal>
    <RegionVerifyDialog open={verifyOpen} onClose={() => setVerifyOpen(false)} />
  </>
}

function RegionForm({ region }: { region: string }) {
  const [value, setValue] = useState(region)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (value.trim()) saveSettings({ ...useLifeStore.getState().settings, region: value.trim() })
  }
  return <form className={cx(common.form, styles.regionForm)} onSubmit={submit}>
    <label>우리 동네<input value={value} onChange={(e) => setValue(e.target.value)} required maxLength={30} placeholder="예: 서울 마포구" /></label>
    <Button type="submit" variant="line" disabled={!value.trim() || value.trim() === region}>동네 저장</Button>
  </form>
}
