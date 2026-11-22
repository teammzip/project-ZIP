import { CalendarBoard } from '@/features/life'
import { useSearchParams } from 'react-router-dom'

export function CalendarPage() {
  const [params] = useSearchParams()
  return <CalendarBoard key={params.get('date') ?? ''} />
}
