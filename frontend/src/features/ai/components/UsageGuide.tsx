import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GUIDE_CATEGORIES, type GuideFeature } from '../usageGuide'
import styles from './UsageGuide.module.css'

type Props = { onBack: () => void; onNavigate: () => void }

export function UsageGuide({ onBack, onNavigate }: Props) {
  const [category, setCategory] = useState<string | null>(null)
  const [feature, setFeature] = useState<GuideFeature | null>(null)
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [feature])

  return (
    <section className={styles.guide} aria-labelledby={id}>
      <header className={styles.header}>
        <h2 id={id}>사용 방법</h2>
        <button type="button" className={styles.back} onClick={onBack}>AI 대화로 돌아가기</button>
      </header>
      <div className={styles.body} ref={body}>
        {feature ? (
          <>
            <button type="button" className={styles.back} onClick={() => setFeature(null)}>
              <span aria-hidden="true">← </span>기능 목록으로
            </button>
            <article className={styles.answer} aria-labelledby={id + '-feature'}>
              <h3 id={id + '-feature'} ref={heading} tabIndex={-1}>{feature.name}</h3>
              <p className={styles.path}>{feature.path}</p>
              <ol className={styles.steps}>
                {feature.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              {feature.note && <p className={styles.note}>{feature.note}</p>}
              {feature.to && <Link className={styles.go} to={feature.to} onClick={(event) => {
                if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
                  onNavigate()
                }
              }}>{feature.link}</Link>}
            </article>
          </>
        ) : (
          <>
            <h3 className={styles.prompt} ref={heading} tabIndex={-1}>어떤 기능을 사용하고 싶으세요?</h3>
            <ul className={styles.categories}>
              {GUIDE_CATEGORIES.map((group, index) => {
                const expanded = category === group.name
                const groupId = `${id}-category-${index}`
                return (
                  <li key={group.name}>
                    <button type="button" className={styles.category} aria-expanded={expanded} aria-controls={groupId}
                      onClick={() => setCategory(expanded ? null : group.name)}>
                      {group.name}
                      <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                    </button>
                    <div id={groupId} className={styles.features} hidden={!expanded}>
                      {group.features.map((item) => (
                        <button type="button" className={styles.feature} key={item.name} onClick={() => setFeature(item)}>
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
