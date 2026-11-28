import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { getLedger, type LedgerRow } from './ledgerApi'

function spendMonthKey(owner: string | undefined, sessionKey: string | null, month: string) {
  return ['ledger', owner, sessionKey, 'spend', month] as const
}

export function ledgerSpendOptions(owner: string | undefined, sessionKey: string | null, month: string, timeZone: string, ready: boolean) {
  return queryOptions<LedgerRow[]>({
    queryKey: [...spendMonthKey(owner, sessionKey, month), timeZone],
    queryFn: ({ signal }) => getLedger('spend', month, timeZone, 'fixed', signal),
    enabled: !!owner && !!sessionKey && ready,
    refetchInterval: 60_000,
    retry: false,
  })
}

export function invalidateLedgerSpendMonths(client: QueryClient, owner: string | undefined, sessionKey: string | null, ...dates: string[]) {
  const months = new Set(dates.map((date) => date.slice(0, 7)))
  return Promise.all([...months].map((month) => client.invalidateQueries({ queryKey: spendMonthKey(owner, sessionKey, month) })))
}
