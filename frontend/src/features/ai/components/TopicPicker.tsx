import { useId, useRef, type MouseEvent, type RefObject } from 'react'
import { topicById, type Topic, type TopicSuggestion } from '../topics'
import styles from './TopicPicker.module.css'

const groups = [
  { name: '살림', ids: ['trash', 'cook', 'clean'] },
  { name: '동네·주거', ids: ['nearby', 'contract', 'landlord'] },
  { name: '생활비·가계부', ids: ['bill', 'summary'] },
  { name: '도움말', ids: ['guide', 'qna'] },
]

export function SelectedTopicChip({ topic, onClear }: { topic: Topic; onClear: () => void }) {
  return (
    <div className={styles.selection}>
      <button type="button" className={styles.selected} onClick={onClear} aria-label={topic.name + ' 주제 해제'}>
        {topic.name}
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

export function SuggestedTopicChip({ suggestion, onPick, disabled }: {
  suggestion: TopicSuggestion
  onPick: (topic: Topic, keyword: string) => void
  disabled?: boolean
}) {
  const topic = topicById(suggestion.topicId)
  if (!topic) return null
  return (
    <div className={styles.suggestion}>
      <button type="button" className={styles.selected} disabled={disabled} onClick={() => onPick(topic, suggestion.keyword)}>
        {topic.name} 선택
      </button>
    </div>
  )
}

type Props = {
  activeId?: string | null
  suggestPhoto?: boolean
  disabled?: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  onPick: (topic: Topic) => void
}

export function TopicPicker({ activeId, suggestPhoto, disabled, triggerRef, onPick }: Props) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)

  const positionPanel = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    panel.current?.style.setProperty('--trigger-left', rect.left + 'px')
    panel.current?.style.setProperty('--trigger-top', rect.top + 'px')
  }

  const renderTopic = (topicId: string) => {
    const topic = topicById(topicId)
    if (!topic) return null
    return (
      <button
        key={topic.id}
        type="button"
        className={styles.keyword}
        aria-pressed={activeId === topic.id}
        disabled={disabled}
        onClick={() => {
          panel.current?.hidePopover()
          onPick(topic)
        }}
      >
        {topic.name}
        {suggestPhoto && topic.photo && <span className={styles.photoHint}>사진 추천</span>}
      </button>
    )
  }

  return (
    <div className={styles.picker} role="group" aria-label="질문 주제">
      <button
        ref={triggerRef}
        type="button"
        className={styles.all}
        popoverTarget={id}
        aria-haspopup="dialog"
        onClick={positionPanel}
        disabled={disabled}
      >
        전체 주제
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-labelledby={id + '-title'}
        className={styles.panel}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          panel.current?.hidePopover()
          triggerRef.current?.focus()
        }}
      >
        <header className={styles.header}>
          <h2 id={id + '-title'}>전체 주제</h2>
          <button type="button" className={styles.close} popoverTarget={id} popoverTargetAction="hide" autoFocus aria-label="전체 주제 닫기">×</button>
        </header>
        {groups.map(({ name, ids }) => (
          <section key={name} className={styles.group}>
            <h3>{name}</h3>
            <div className={styles.keywords}>{ids.map(renderTopic)}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
