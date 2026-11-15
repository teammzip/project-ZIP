import { placeIconPath } from '../placeIcons'

/** 종류 아이콘. 색은 currentColor (부모 글자색) */
export function PlaceIcon({ cat, size = 18, className }: { cat: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', verticalAlign: '-0.2em' }}>
      <path d={placeIconPath(cat)} />
    </svg>
  )
}
