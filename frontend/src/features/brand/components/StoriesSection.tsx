import { motion } from 'motion/react'
import { SectionHead } from './SectionHead'
import { STORIES, STORIES_HEAD, type BrandStory } from '../content'
import styles from './StoriesSection.module.css'

/** 자취 이야기 카드. 옆으로 밀어서 넘기기 (PC 는 마우스 휠 Shift 또는 트랙패드) */
export function StoriesSection() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <SectionHead kicker={STORIES_HEAD.kicker} title={STORIES_HEAD.title} body={STORIES_HEAD.body} />
      </div>
      <ul className={styles.track}>
        {STORIES.map((story, i) => (
          <StoryCard key={story.id} story={story} index={i} />
        ))}
      </ul>
    </section>
  )
}

function StoryCard({ story, index }: { story: BrandStory; index: number }) {
  return (
    <motion.li
      className={styles.card}
      initial={{ opacity: 0, x: 60 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
    >
      {/* 사진 자리: 실제 사진이 생기면 <img> 로 바꾸기 */}
      <div className={styles.media} style={{ background: story.gradient }}>
        <span aria-hidden="true">{story.emoji}</span>
      </div>
      <div className={styles.body}>
        <span className={styles.tag}>{story.tag}</span>
        <h3 className={styles.title}>{story.title}</h3>
        <p className={styles.quote}>“{story.quote}”</p>
        <p className={styles.author}>{story.author}</p>
      </div>
    </motion.li>
  )
}
