import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

type MetricCardProps = {
  label: string
  value: string
  detail: string
  change: string
  direction: 'up' | 'down' | 'flat'
  tone?: 'blush' | 'sage' | 'linen'
  onClick?: () => void
}

const tones = {
  blush: 'bg-blush/30 border-blush/70',
  sage: 'bg-sage/60 border-sage',
  linen: 'bg-shell border-stone-200'
}

export function MetricCard({ label, value, detail, change, direction, tone = 'linen', onClick }: MetricCardProps) {
  const ChangeIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
  return (
    <button type="button" onClick={onClick} className={`group rounded-2xl border p-5 text-left shadow-panel transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blushDeep ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-medium text-stone-600">{label}</span>
        <ChangeIcon className="h-4 w-4 text-stone-500 transition group-hover:text-ink" aria-hidden="true" />
      </div>
      <p className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-stone-600">
        <span>{detail}</span>
        <span className="font-semibold text-ink">{change}</span>
      </div>
    </button>
  )
}
