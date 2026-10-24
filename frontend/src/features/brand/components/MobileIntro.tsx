import { useEffect, useRef, useState } from 'react'
import appIcon from '@/assets/images/app-icon.png'
import house from '@/assets/images/house-mobile.png'
import robotImg from '@/assets/images/robot-cut.png'
import styles from './MobileIntro.module.css'

type Props = {
  /** 문을 누르고 로봇이 들어간 뒤 (로그인 창 열기) */
  onEnter: () => void
  onSignup: () => void
  /** 로그인 창이 열려 있는 동안 true. 창이 닫히면 인트로를 처음부터 다시 재생 */
  paused: boolean
  /** 가입·찾기 페이지에서 "로그인"으로 돌아온 경우: 스플래시 없이 로봇이 나타나 문이 저절로 열리고 로그인 창이 뜸 */
  autoDoor?: boolean
}

// 집 그림(1024×1024, 하얀 집 + 파란 문) 안의 위치 (그림 기준 픽셀)
const IMG_W = 1024
const IMG_H = 1024
const GROUND_Y = 800 // 집이 서 있는 계단 아래 끝
const HOUSE_W = 960 // 화분까지 포함한 폭(여유 포함): 이 폭이 화면 폭에 맞음
const HOUSE_CX = 484 // 집 가운데 (그림 가운데보다 조금 왼쪽): 이 폭이 화면 폭에 맞음
const HOUSE_H = 760 // 지붕 위부터 계단 아래까지
const DOOR = { x1: 354, y1: 340, x2: 480, y2: 708 } // 비스듬한 윗변은 CSS clip-path 로 맞춤
// 거실 통유리창: 처음엔 불이 꺼져 있다가 로봇이 들어가면 켜짐
const WINDOWS = [[484, 370, 764, 706]]
// 시간(초): 로봇 등장 → 줌인 → (문 클릭) 문 열림(오른쪽 경첩) + 로봇이 문 앞으로 → 안으로 들어감 → 문 닫힘 → 창문 불빛 → 로그인 창
const T_ENTER = 1.3
const T_ZOOM = 1.5
const T_DESC = 1.2
const T_IN = 1.1
const T_LIGHT = 0.8
const T_OPEN_AT = 0.2
const T_OPEN = 0.8
const T_CLOSE_AT = T_DESC + T_IN + 0.1
const SPLASH_MS = 2000
const AUTO_DOOR_S = T_ENTER + T_ZOOM + 0.2

const clamp = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, p: number) => a + (b - a) * p
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const place = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.width = `${w}px`
  el.style.height = `${h}px`
}

/** 모바일 시작 화면: 앱 시작(스플래시) → 로봇이 날아와 문을 가리킴 → 문을 누르면 로봇이 들어가고 불이 켜짐 → 로그인.
 * 기존 시안 variants/start-mobile/index.html 의 모션을 그대로 옮김. '동작 줄이기' 설정이면 모션을 건너뜀 */
export function MobileIntro({ onEnter, onSignup, paused, autoDoor = false }: Props) {
  const world = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const robot = useRef<HTMLImageElement>(null)
  const door = useRef<HTMLButtonElement>(null)
  const doorway = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const glows = useRef<Array<HTMLDivElement | null>>([])
  const dims = useRef<Array<HTMLDivElement | null>>([])
  const [caption, setCaption] = useState({ key: '', text: '' })
  const [splash, setSplash] = useState<'show' | 'hide' | 'gone'>(autoDoor ? 'gone' : 'show')
  const [skipShown, setSkipShown] = useState(false)
  // 애니메이션 쪽에서 부를 함수들 (effect 밖의 최신 값을 쓰기 위해 ref 로 둠)
  const api = useRef({ play: () => {}, onDoor: () => {}, skip: () => {} })
  const autoDoorRef = useRef(autoDoor)
  const onEnterRef = useRef(onEnter)
  useEffect(() => {
    onEnterRef.current = onEnter
  }, [onEnter])

  useEffect(() => {
    const w = world.current!
    const im = img.current!
    const rb = robot.current!
    const dr = door.current!
    const dw0 = doorway.current!
    const pn = panel.current!
    const wg = glows.current.filter((g): g is HTMLDivElement => !!g)
    const wd = dims.current.filter((g): g is HTMLDivElement => !!g)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let vw = 0, vh = 0, s = 1, ox = 0, oy = 0, R = 0, RH = 0, Z = 2.6, mx = 0, my = 0
    let capKey = ''
    let tStart = 0, tClick = -1, opened = false, raf = 0, skipOn = false, splashUp = !autoDoorRef.current

    const say = (key: string, text: string) => {
      if (key === capKey) return
      capKey = key
      setCaption({ key, text })
    }

    function layout() {
      vw = window.innerWidth
      vh = window.innerHeight
      s = Math.min(vw / HOUSE_W, (vh * 0.62) / HOUSE_H) // 집 폭이 화면 폭에 맞게 (너무 크면 높이 기준)
      const groundY = vh * 0.76
      ox = vw / 2 - HOUSE_CX * s
      oy = groundY - GROUND_Y * s
      place(im, ox, oy, IMG_W * s, IMG_H * s)
      const dx = ox + DOOR.x1 * s, dy = oy + DOOR.y1 * s, dw = (DOOR.x2 - DOOR.x1) * s, dh = (DOOR.y2 - DOOR.y1) * s
      for (const e of [dr, dw0, pn]) place(e, dx, dy, dw, dh)
      // 문 부분을 그림에서 그대로 오려 열리는 문짝으로 씀
      pn.style.backgroundImage = `url("${house}")`
      pn.style.backgroundSize = `${IMG_W * s}px ${IMG_H * s}px`
      pn.style.backgroundPosition = `${-DOOR.x1 * s}px ${-DOOR.y1 * s}px`
      WINDOWS.forEach((win, i) => {
        for (const e of [wg[i], wd[i]]) if (e) place(e, ox + win[0] * s, oy + win[1] * s, (win[2] - win[0]) * s, (win[3] - win[1]) * s)
      })
      R = Math.max(46, Math.min(110, dw * 1.3)) // 로봇은 문 폭의 1.3배 정도
      RH = (R * 498) / 473
      rb.style.width = `${R}px`
      rb.style.height = `${RH}px`
      mx = dx + dw / 2
      my = dy + dh / 2
      Z = Math.max(1.6, Math.min(3.2, (vw * 0.5) / dw)) // 줌인: 문 폭이 화면의 절반 가까이 (최대 3.2배)
    }

    function frame(t: number) {
      const doorLeft = ox + DOOR.x1 * s, doorBottom = oy + DOOR.y2 * s
      const hoverX = doorLeft - R * 0.15, hoverY = doorBottom - RH * 0.8 // 문 바로 옆
      const tgtX = mx, tgtY = doorBottom - RH * 0.3
      let cx: number, cy: number, sc = 1, op = 1, rot = 0, glowW = 0, shade = 1
      const bob = Math.sin(t * 3.2) * 6

      if (tClick < 0) {
        if (t < T_ENTER) {
          // 오른쪽 위에서 날아 들어옴
          const p = easeOut(clamp(t / T_ENTER))
          cx = lerp(vw + R, hoverX, p)
          cy = lerp(vh * 0.2, hoverY, p) + bob * p
          rot = (1 - p) * -14
          say('hi', '안녕, 나는 ZIP 도우미야')
        } else {
          // 집 옆에서 둥둥 떠서 문을 가리킴
          cx = hoverX
          cy = hoverY + bob
          rot = Math.sin(t * 3.2) * 4
          say('idle', '문을 눌러서 들어와 봐요')
        }
      } else {
        const u0 = t - tClick
        say('go', '들어갈게요!')
        if (u0 < T_DESC) {
          // 문 앞으로 내려옴
          const q = easeInOut(u0 / T_DESC)
          cx = lerp(hoverX, tgtX, q) + Math.sin(q * Math.PI) * -R * 0.35
          cy = lerp(hoverY, tgtY, q)
          sc = lerp(1, 0.62, q)
          rot = Math.sin(q * Math.PI * 2) * 8
        } else if (u0 < T_DESC + T_IN) {
          // 열린 문 안쪽으로 멀어지듯 작아지고 어두워짐
          const u = easeInOut((u0 - T_DESC) / T_IN)
          cx = tgtX
          cy = tgtY - u * RH * 0.2
          sc = lerp(0.62, 0.2, u)
          op = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3
          shade = 1 - 0.55 * u
        } else {
          cx = tgtX
          cy = tgtY
          sc = 0.2
          op = 0
          shade = 0.45
        }
        const openP = easeInOut(clamp((u0 - T_OPEN_AT) / T_OPEN))
        const closeP = easeInOut(clamp((u0 - T_CLOSE_AT) / T_OPEN))
        pn.style.transform = `perspective(${700 * s}px) rotateY(${-82 * openP * (1 - closeP)}deg)`
        glowW = clamp((u0 - T_CLOSE_AT - T_OPEN) / T_LIGHT)
        if (!opened && u0 > T_CLOSE_AT + T_OPEN + T_LIGHT * 0.7) {
          opened = true
          onEnterRef.current()
        }
      }
      rb.style.transform = `translate(${cx - R / 2}px,${cy - RH / 2}px) rotate(${rot}deg) scale(${sc})`
      rb.style.opacity = String(op)
      rb.style.filter = `drop-shadow(0 6px 8px rgba(0,0,0,.18)) brightness(${shade})`
      // 줌인: 로봇이 문 옆에 오면 화면이 문 쪽으로 확대되고, 문을 누른 뒤에도 확대된 채로 유지
      const zp = tClick < 0 ? easeInOut(clamp((t - T_ENTER) / T_ZOOM)) : 1
      const z = lerp(1, Z, zp)
      w.style.transform = `translate(${lerp(0, vw * 0.6 - Z * mx, zp)}px,${lerp(0, vh * 0.55 - Z * my, zp)}px) scale(${z})`
      w.style.setProperty('--z', String(z))
      const flick = glowW * (0.9 + Math.sin(t * 5) * 0.05)
      for (const e of wg) e.style.opacity = String(flick)
      for (const e of wd) e.style.opacity = String(1 - glowW)
      // 모션이 도는 동안만 "건너뛰기" 표시 (바뀔 때만 다시 그림)
      const showSkip = !opened && !(tClick < 0 && t >= T_ENTER + T_ZOOM)
      if (showSkip !== skipOn) {
        skipOn = showSkip
        setSkipShown(showSkip)
      }
    }

    const loop = (now: number) => {
      frame((now - tStart) / 1000)
      raf = requestAnimationFrame(loop)
    }

    function play() {
      cancelAnimationFrame(raf)
      tClick = -1
      opened = false
      capKey = ''
      dr.classList.remove(styles.off)
      dw0.style.visibility = pn.style.visibility = 'hidden'
      pn.style.transform = 'none'
      tStart = performance.now() - (reduce ? 3000 : 0) // 동작 줄이기 설정이면 등장 모션을 건너뜀
      raf = requestAnimationFrame(loop)
    }

    function onDoor() {
      if (tClick >= 0) return
      tClick = (performance.now() - tStart) / 1000
      dr.classList.add(styles.off)
      dw0.style.visibility = pn.style.visibility = 'visible'
      if (reduce) {
        opened = true
        for (const e of wg) e.style.opacity = '1'
        for (const e of wd) e.style.opacity = '0'
        onEnterRef.current()
      }
    }
    let t1 = 0, t2 = 0, t3 = 0
    function endSplash() {
      clearTimeout(t1)
      splashUp = false
      setSplash('hide')
      play()
      t2 = window.setTimeout(() => setSplash('gone'), 700)
    }

    /* 건너뛰기: 스플래시 → 바로 모션 / 로봇 등장·줌인 → 문 앞 대기 / 문 열림·입장 → 바로 로그인 창 */
    function skip() {
      if (opened) return
      if (splashUp) {
        endSplash()
        return
      }
      const now = (performance.now() - tStart) / 1000
      if (tClick < 0) {
        if (now < T_ENTER + T_ZOOM) tStart = performance.now() - (T_ENTER + T_ZOOM) * 1000
      } else {
        tClick = now - (T_CLOSE_AT + T_OPEN + T_LIGHT) // 문이 닫히고 불이 켜진 모습으로 바로 넘어가 로그인 창을 띄움
      }
    }
    api.current = { play, onDoor, skip }

    // 처음 열 때만 스플래시(아이콘 + 이름)를 보여 준 뒤, 사라지는 동안 모션 시작
    function begin() {
      layout()
      rb.style.opacity = '0'
      if (autoDoorRef.current) {
        play()
        t3 = window.setTimeout(onDoor, reduce ? 0 : AUTO_DOOR_S * 1000)
        return
      }
      if (reduce) {
        splashUp = false
        setSplash('gone')
        play()
        return
      }
      t1 = window.setTimeout(endSplash, SPLASH_MS)
    }
    layout()
    if (im.complete) begin()
    else im.onload = begin
    window.addEventListener('resize', layout)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      im.onload = null
      window.removeEventListener('resize', layout)
    }
  }, [])

  // 로그인 창이 닫히면 처음부터 다시
  const wasPaused = useRef(paused)
  useEffect(() => {
    if (wasPaused.current && !paused) api.current.play()
    wasPaused.current = paused
  }, [paused])

  return (
    // 화면 아무 곳이나 누르면 건너뜀 (문·버튼은 각자 동작)
    <div className={styles.scene} onClick={(e) => !(e.target as HTMLElement).closest('button') && api.current.skip()}>
      <div ref={world} className={styles.world}>
        <img ref={img} src={house} alt="ZIP 집" className={styles.house} draggable={false} />
        {WINDOWS.map((_, i) => (
          <div
            key={`d${i}`}
            ref={(el) => {
              dims.current[i] = el
            }}
            className={styles.dim}
          />
        ))}
        {WINDOWS.map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              glows.current[i] = el
            }}
            className={styles.glow}
          />
        ))}
        <div ref={doorway} className={styles.doorway} />
        <div ref={panel} className={styles.doorPanel} />
        <button ref={door} type="button" className={styles.door} onClick={() => api.current.onDoor()} aria-label="문을 눌러 로그인하기">
          <span className={styles.doorLabel}>눌러서 입장</span>
        </button>
        <img ref={robot} src={robotImg} alt="ZIP 도우미 로봇" className={styles.robot} />
      </div>

      {/* 확대되지 않는 글자와 버튼 */}
      {skipShown && (
        <button type="button" className={styles.skip} onClick={() => api.current.skip()}>
          건너뛰기 ›
        </button>
      )}
      <button type="button" className={styles.replay} onClick={() => api.current.play()}>
        다시 보기
      </button>
      <p key={caption.key} className={styles.caption} aria-live="polite">
        {caption.text}
      </p>
      <button type="button" className={styles.signup} onClick={onSignup}>
        처음이세요? <b>회원가입</b>
      </button>

      {splash !== 'gone' && (
        <div className={`${styles.splash} ${splash === 'hide' ? styles.splashHide : ''}`} role="img" aria-label="ZIP 자취생 생활 도우미">
          <img className={styles.sIcon} src={appIcon} alt="" />
          <div className={styles.sName}>ZIP</div>
          <div className={styles.sSub}>자취생 생활 도우미</div>
          <div className={styles.sTag}>나의 자취 생활을 한곳에.</div>
        </div>
      )}
    </div>
  )
}
