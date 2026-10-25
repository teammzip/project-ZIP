import { motion } from 'motion/react'
import { Reveal } from './Reveal'
import { cx } from '@/lib/cx'
import { STORIES, STORIES_HEAD, type BrandStory } from '../content'
import { Lines } from './SectionHead'
import styles from './StoriesSection.module.css'

/** 자취 이야기 카드 모음: 크기가 다른 카드를 엇갈려 놓고 파란 동그라미로 포인트. 옆으로 밀어서 더 보기 */
export function StoriesSection() {
  const [first, second, third, fourth, fifth] = STORIES
  return (
    <section className={styles.section}>
      <Reveal>
        <h2 className={styles.title}>
          <Lines text={STORIES_HEAD.title} />
        </h2>
      </Reveal>
      <div className={styles.track}>
        <Card story={first} index={0} />
        <div className={styles.column}>
          <motion.div
            className={styles.circle}
            aria-hidden="true"
            initial={{ scale: 0.6, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.2 }}
          >
            +
          </motion.div>
          <Card story={second} index={1} />
        </div>
        <Card story={third} index={2} />
        <Card story={fourth} index={3} />
        <Card story={fifth} index={4} />
      </div>
    </section>
  )
}

function Card({ story, index }: { story: BrandStory; index: number }) {
  return (
    <motion.article
      className={cx(styles.card, styles[story.size])}
      style={story.image ? { backgroundImage: `url(${story.image})` } : { background: story.gradient }}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
      whileHover={{ y: -8 }}
    >
      {!story.image && (
        <span className={styles.emoji} aria-hidden="true">
          {story.emoji}
        </span>
      )}
      <div className={styles.overlay}>
        <h3>
          <Lines text={story.title} />
        </h3>
        <p>{story.author}</p>
        <span className={styles.pill}>이야기 보기</span>
      </div>
    </motion.article>
  )
}
