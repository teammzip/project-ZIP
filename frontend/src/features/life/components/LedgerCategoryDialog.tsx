import { useState, type FormEvent } from 'react'
import { Button, Modal } from '@/components/ui'
import common from '@/styles/common.module.css'
import { useLedgerCategoryStore, type LedgerScope } from '../ledgerCategories'

export function LedgerCategoryDialog({ scope, onClose, onAdded }: { scope: LedgerScope; onClose: () => void; onAdded: (name: string) => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const add = useLedgerCategoryStore((s) => s.add)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const result = add(scope, name)
    if (result) { setError(result); return }
    onAdded(name.trim().replace(/\s+/g, ' '))
    onClose()
  }
  return <Modal open onClose={onClose} title="카테고리 추가">
    <form className={common.form} onSubmit={submit}>
      <h3>카테고리 추가</h3>
      <label>카테고리 이름<input value={name} onChange={(e) => { setName(e.target.value); setError('') }} maxLength={24} placeholder="예) 반려동물, 장학금" required autoFocus /></label>
      {error && <p className={common.formError} role="alert">{error}</p>}
      <div className={common.actions}><Button type="submit">추가</Button><Button variant="line" onClick={onClose}>취소</Button></div>
    </form>
  </Modal>
}
