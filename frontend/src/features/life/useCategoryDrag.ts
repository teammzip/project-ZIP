import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useLedgerCategories, useLedgerCategoryStore, type LedgerScope } from './ledgerCategories'

/** 기본 분류와 사용자 분류 모두 같은 목록 안에서 순서를 바꾼다. */
export function useCategoryDrag(scope: LedgerScope) {
  const source = useRef<{ name: string; userId: string | undefined } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const move = useLedgerCategoryStore((s) => s.move)
  const categories = useLedgerCategories(scope)
  const clear = () => { source.current = null; setDragging(null) }
  return (name: string) => ({
    draggable: true,
    'data-category-dragging': dragging === name || undefined,
    title: '드래그하여 순서 변경 · Alt + 좌우 방향키로 이동',
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      source.current = { name, userId: useAuthStore.getState().user?.id }
      setDragging(name)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', name)
    },
    onDragOver: (event: DragEvent<HTMLButtonElement>) => {
      if (!source.current) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    },
    onDrop: (event: DragEvent<HTMLButtonElement>) => {
      if (!source.current) return
      event.preventDefault()
      event.stopPropagation()
      if (source.current.userId === useAuthStore.getState().user?.id) move(scope, source.current.name, name)
      clear()
    },
    onDragEnd: clear,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      const index = categories.findIndex((cat) => cat.name === name)
      const target = categories[index + (event.key === 'ArrowLeft' ? -1 : 1)]
      if (target) { event.preventDefault(); move(scope, name, target.name) }
    },
  })
}
