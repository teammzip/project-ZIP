import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui'
import common from '@/styles/common.module.css'
import { useLifeStore } from '../store'

type Props = {
  /** 닉네임은 로그인 정보(auth)에 있어서 쓰는 쪽이 넘겨 줌 */
  name: string
  onSaveName: (name: string) => void
}

/** 내 정보: 닉네임, 우리 동네, 월세 납부일·금액, 알림 켜기 */
export function SettingsForm({ name, onSaveName }: Props) {
  const settings = useLifeStore((s) => s.settings)
  const saveSettings = useLifeStore((s) => s.saveSettings)
  const [form, setForm] = useState({
    name,
    region: settings.region,
    rentDay: String(settings.rentDay),
    rent: String(settings.rent),
    notiOn: settings.notiOn,
    moveIn: settings.moveIn,
    contractEnd: settings.contractEnd,
  })
  const [saved, setSaved] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextName = form.name.trim()
    if (nextName.length < 2) return
    if (nextName !== name) onSaveName(nextName)
    saveSettings({
      region: form.region.trim(),
      rentDay: Math.min(31, Math.max(1, Number(form.rentDay) || 15)),
      rent: Math.max(0, Number(form.rent) || 0),
      notiOn: form.notiOn,
      moveIn: form.moveIn || settings.moveIn,
      contractEnd: form.contractEnd || settings.contractEnd,
    })
    setSaved('저장됐어요.')
    setTimeout(() => setSaved(''), 2000)
  }

  return (
    <form className={common.form} onSubmit={submit}>
      <label>
        이름(닉네임)
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={2} maxLength={12} required />
      </label>
      <label>
        우리 동네
        <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} maxLength={30} placeholder="예) 서울 마포구" />
      </label>
      <div className={common.two}>
        <label>
          월세 납부일 (매월)
          <input type="number" value={form.rentDay} onChange={(e) => setForm({ ...form, rentDay: e.target.value })} min={1} max={31} required />
        </label>
        <label>
          월세 (만원)
          <input type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })} min={0} max={9999} required />
        </label>
      </div>
      <div className={common.two}>
        <label>
          입주한 달
          <input type="month" value={form.moveIn} onChange={(e) => setForm({ ...form, moveIn: e.target.value })} />
        </label>
        <label>
          계약 끝나는 달
          <input type="month" value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} />
        </label>
      </div>
      <label className={common.check}>
        <input type="checkbox" checked={form.notiOn} onChange={(e) => setForm({ ...form, notiOn: e.target.checked })} /> 알림 받기
      </label>
      <Button type="submit" block>
        저장
      </Button>
      <p className={common.saved} role="status">
        {saved}
      </p>
    </form>
  )
}
