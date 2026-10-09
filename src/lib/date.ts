export const defaultCutoffDate = '2026-10-09'

export function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export function isOnOrBefore(date: string, cutoffDate: string): boolean {
  return date.slice(0, 10) <= cutoffDate
}

export function formatDateId(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed)
}

export function formatCutoffLabel(date: string): string {
  return `Sampai ${formatDateId(date)}`
}
