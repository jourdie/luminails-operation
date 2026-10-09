import { useCallback, useState } from 'react'
import { getLocalDatabase, saveLocalDatabase, type LocalDatabase } from '../lib/localDb'

export function useLocalDatabase() {
  const [database, setDatabase] = useState<LocalDatabase>(getLocalDatabase)

  const updateDatabase = useCallback((updater: (current: LocalDatabase) => LocalDatabase) => {
    setDatabase((current) => {
      const next = updater(current)
      saveLocalDatabase(next)
      return next
    })
  }, [])

  return { database, updateDatabase }
}
