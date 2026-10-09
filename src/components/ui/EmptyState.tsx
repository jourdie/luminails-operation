import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-shell px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linen"><Inbox className="h-6 w-6 text-blushDeep" /></div>
      <h2 className="mt-5 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
