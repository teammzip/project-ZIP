import styles from './PagePlaceholder.module.css'

type Props = {
  title: string
  description: string
  /** 옮겨 올 기존 시안 파일 (프로젝트 루트 기준) */
  legacy?: string[]
}

/** 아직 React 로 옮기지 않은 화면의 임시 자리. 화면을 만들면 이 컴포넌트를 지우면 됩니다. */
export function PagePlaceholder({ title, description, legacy }: Props) {
  return (
    <section className={styles.box}>
      <h1>{title}</h1>
      <p>{description}</p>
      {legacy && (
        <div className={styles.legacy}>
          <b>옮겨 올 시안 파일</b>
          <ul>
            {legacy.map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
