import { CalendarDays } from 'lucide-react'
import { formatCutoffLabel } from '../../lib/date'

export function CutoffDatePicker({ cutoffDate, onChange }: { cutoffDate: string; onChange: (date: string) => void }) {
  return <label className="group inline-flex min-w-[250px] items-center gap-3 rounded-xl border border-stone-200 bg-shell px-3 py-2.5 text-left shadow-sm transition-colors focus-within:border-blushDeep focus-within:ring-2 focus-within:ring-blush/50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linen text-blushDeep"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">Cutoff laporan</span><span className="mt-0.5 block truncate text-sm font-semibold text-ink">{formatCutoffLabel(cutoffDate)}</span></span><input aria-label="Pilih tanggal cutoff" type="date" name="cutoffDate" value={cutoffDate} onChange={(event) => onChange(event.target.value)} className="w-[1.5rem] cursor-pointer border-0 bg-transparent p-0 text-transparent outline-none [color-scheme:light] focus:ring-0" /></label>
}
