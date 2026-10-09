import { useSearchParams } from 'react-router-dom'
import { defaultCutoffDate, isIsoDate } from '../lib/date'

export function useCutoffDate() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryDate = searchParams.get('asOf')
  const cutoffDate = isIsoDate(queryDate) ? queryDate : defaultCutoffDate

  function setCutoffDate(nextDate: string) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextDate === defaultCutoffDate) nextParams.delete('asOf')
    else nextParams.set('asOf', nextDate)
    setSearchParams(nextParams)
  }

  return { cutoffDate, setCutoffDate }
}
