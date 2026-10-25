import { useId, useState, type ReactNode } from 'react'
import type { Consent, ConsentErrors } from '../consent'
import { POLICY, PRIVACY, PRIVACY_CONSENT, TERMS, type LegalDoc } from '../content'
import { LegalDocView } from './LegalDocView'
import styles from './Consent.module.css'


type Props = {
  value: Consent
  onChange: (next: Consent) => void
  errors?: ConsentErrors
}

/** 가입 약관 동의
 * 필수 약관 전체 동의 + [필수] 서비스 이용약관 · 개인정보 처리방침(안내 확인) · 커뮤니티·AI 운영 정책 · 만 14세 이상.
 * "상세보기"를 누르면 그 자리에서 약관이 펼쳐짐. 회원가입 페이지와 소셜 첫 가입 화면이 같이 씀 */
export function ConsentFields({ value, onChange, errors = {} }: Props) {
  const all = value.terms && value.privacy && value.policy && value.age
  const set = (key: keyof Consent) => (v: boolean) => onChange({ ...value, [key]: v })

  return (
    <fieldset className={styles.agree}>
      <legend className="sr-only">가입 약관 동의</legend>
      <label className={`${styles.chk} ${styles.all}`}>
        <input type="checkbox" checked={all} onChange={(e) => onChange({ terms: e.target.checked, privacy: e.target.checked, policy: e.target.checked, age: e.target.checked })} />
        <span>필수 약관 전체 동의</span>
      </label>

      <Item title="서비스 이용약관" tag="필수 동의" label="서비스 이용약관에 동의합니다." doc={TERMS} checked={value.terms} onCheck={set('terms')} error={errors.terms} />

      <Item title="개인정보 처리방침" tag="안내 확인" label="개인정보 처리방침 안내를 확인했습니다." doc={PRIVACY} checked={value.privacy} onCheck={set('privacy')} error={errors.privacy}>
        <p className={styles.notice}>가입할 때 수집하는 정보와 이용 목적, 보관 기간을 안내해 드려요.</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">목적</th>
              <th scope="col">보유 기간</th>
            </tr>
          </thead>
          <tbody>
            {PRIVACY_CONSENT.rows.map((r) => (
              <tr key={r.item}>
                <td>{r.item}</td>
                <td>{r.purpose}</td>
                <td>{r.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.refuse}>{PRIVACY_CONSENT.refuse}</p>
      </Item>

      <Item title="커뮤니티·AI 운영 정책" tag="필수 동의" label="커뮤니티·AI 운영 정책에 동의합니다." doc={POLICY} checked={value.policy} onCheck={set('policy')} error={errors.policy} />

      <div className={styles.item}>
        <label className={styles.chk}>
          <input type="checkbox" checked={value.age} onChange={(e) => set('age')(e.target.checked)} aria-invalid={errors.age ? true : undefined} />
          <span>
            <em className={styles.req}>[필수]</em> 만 14세 이상입니다.
          </span>
        </label>
        {errors.age && <p className={styles.error}>{errors.age}</p>}
      </div>

      <p className={styles.ageNote}>14세 미만은 회원 가입이 제한됩니다.</p>
    </fieldset>
  )
}

type ItemProps = {
  title: string
  tag: string
  label: string
  doc: LegalDoc
  checked: boolean
  onCheck: (v: boolean) => void
  error?: string
  children?: ReactNode
}

function Item({ title, tag, label, doc, checked, onCheck, error, children }: ItemProps) {
  const [open, setOpen] = useState(false)
  const boxId = useId()
  return (
    <div className={styles.item}>
      <div className={styles.head}>
        <b>
          {title} <em className={styles.req}>[{tag}]</em>
        </b>
        <button type="button" className={styles.more} aria-expanded={open} aria-controls={boxId} onClick={() => setOpen((v) => !v)}>
          상세보기
          <i />
        </button>
      </div>
      {children}
      <label className={styles.chk}>
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-invalid={error ? true : undefined} />
        <span>
          <em className={styles.req}>[필수]</em> {label}
        </span>
      </label>
      {open && (
        <div id={boxId} className={styles.box}>
          <LegalDocView doc={doc} compact />
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
