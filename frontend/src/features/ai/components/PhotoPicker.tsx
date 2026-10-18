import { useRef } from 'react'
import { Button } from '@/components/ui'
import { usePhotoStore } from '../store'

type Props = {
  label?: string
  variant?: 'primary' | 'line'
  className?: string
  onPicked?: () => void
}

/** 사진 찍기/고르기 버튼. 모바일에서는 카메라가 바로 열림(capture). 고른 사진은 usePhotoStore 에 담김 */
export function PhotoPicker({ label = '사진 찍기 · 고르기', variant = 'primary', className, onPicked }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const setPhoto = usePhotoStore((s) => s.setPhoto)

  return (
    <>
      <Button variant={variant} size={variant === 'primary' ? 'lg' : 'md'} className={className} onClick={() => input.current?.click()}>
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f || !f.type.startsWith('image/')) return
          setPhoto(f)
          onPicked?.()
        }}
      />
    </>
  )
}
