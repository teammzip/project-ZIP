import { motion } from 'motion/react'
import { STORIES, STORIES_HEAD, type BrandStory } from '../content'
import { Phone } from './Phone'
import { SectionHead } from './SectionHead'
import styles from './StoriesSection.module.css'

/** 자취 이야기: 큰 흰 판 위 2 x 2 카드. 카드마다 연한 판 위로 앱 화면 두 대가 올라오고, 아래 작은 글씨 · 제목 · 설명 (모바일 1줄) */
export function StoriesSection() {
  return (
    <section className={styles.section} id="stories">
      <div className={styles.sheet}>
        <SectionHead {...STORIES_HEAD} align="split" />
        <div className={styles.grid}>
          {STORIES.map((s, i) => (
            <Card key={s.id} story={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Card({ story, index }: { story: BrandStory; index: number }) {
  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: (index % 2) * 0.1 }}
    >
      <div className={styles.panel}>
        <Phone screen={story.screens[0]} className={styles.phone} />
        <Phone screen={story.screens[1]} className={styles.phone} />
      </div>
      <p className={styles.meta}>{story.meta}</p>
      <h3 className={styles.title}>{story.title}</h3>
      <p className={styles.body}>{story.body}</p>
    </motion.article>
  )
}
