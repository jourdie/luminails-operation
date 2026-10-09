import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '../../lib/utils'

export function TextEffect({ children, className, delay = 0, preset = 'fade-in-blur' }: { children: ReactNode; className?: string; delay?: number; preset?: 'fade' | 'fade-in-blur' | 'slide' }) {
  const reducedMotion = useReducedMotion()
  const segments = String(children).split(/(\s+)/)
  const hidden = preset === 'slide' ? { opacity: 0, y: 8 } : preset === 'fade-in-blur' ? { opacity: 0, filter: 'blur(6px)' } : { opacity: 0 }
  return <motion.span className={cn('inline', className)} initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { delayChildren: delay, staggerChildren: reducedMotion ? 0 : 0.035 } } }} aria-label={String(children)}>
    {segments.map((segment, index) => segment.trim() ? <motion.span key={`${segment}-${index}`} variants={reducedMotion ? undefined : { hidden, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } }} transition={{ duration: 0.34, ease: 'easeOut' }}>{segment}</motion.span> : <span key={`${segment}-${index}`} aria-hidden="true">{segment}</span>)}
  </motion.span>
}
