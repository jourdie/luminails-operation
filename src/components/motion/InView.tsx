import { type ReactNode, useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { cn } from '../../lib/utils'

export function InView({ children, className, once = true }: { children: ReactNode; className?: string; once?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount: 0.16 })
  const reducedMotion = useReducedMotion()
  return <motion.div ref={ref} className={cn(className)} initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={reducedMotion || isInView ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.4, ease: 'easeOut' }}>{children}</motion.div>
}
