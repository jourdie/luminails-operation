import type { ReactNode } from 'react'
import { TextEffect } from '../motion/TextEffect'

export function PageHeader({ eyebrow = 'Luminails Ops', title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-7 md:flex-row md:items-end">
      <div>
        <p className="text-sm font-medium text-stone-500">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight"><TextEffect>{title}</TextEffect></h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{description}</p>
      </div>
      {action}
    </div>
  )
}
