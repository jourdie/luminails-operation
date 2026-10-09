type StatusTone = 'positive' | 'warning' | 'neutral' | 'critical'

const toneClasses: Record<StatusTone, string> = {
  positive: 'border-sage bg-sage/60 text-emerald-900',
  warning: 'border-amber bg-amber/70 text-amber-950',
  neutral: 'border-stone-200 bg-stone-100 text-stone-700',
  critical: 'border-rose-200 bg-rose-50 text-rose-800'
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{label}</span>
}
