import { Children, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '../../lib/utils'

type AnimatedGroupProps = {
  children: ReactNode
  className?: string
  preset?: 'fade' | 'slide' | 'scale' | 'blur-slide'
}

const itemVariants = {
  fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  slide: { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } },
  scale: { hidden: { opacity: 0, scale: 0.96 }, visible: { opacity: 1, scale: 1 } },
  'blur-slide': { hidden: { opacity: 0, y: 12, filter: 'blur(8px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } }
}

export function AnimatedGroup({ children, className, preset = 'slide' }: AnimatedGroupProps) {
  const reducedMotion = useReducedMotion()
  const variants = itemVariants[preset]
  return <motion.div initial={false} animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.06 } } }} className={cn(className)}>
    {Children.map(children, (child, index) => <motion.div key={index} initial={false} animate="visible" variants={reducedMotion ? undefined : variants} transition={{ duration: 0.35, ease: 'easeOut', delay: reducedMotion ? 0 : index * 0.06 }}>{child}</motion.div>)}
  </motion.div>
}
