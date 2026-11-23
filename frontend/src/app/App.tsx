import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { LoanInterestSync } from '@/features/loan'
import { queryClient } from '@/lib/queryClient'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoanInterestSync />
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
