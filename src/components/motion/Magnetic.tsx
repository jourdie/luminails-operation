import { type PointerEvent, type ReactNode, useRef } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { cn } from '../../lib/utils'

export function Magnetic({ children, className, intensity = 0.16, range = 120 }: { children: ReactNode; className?: string; intensity?: number; range?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 260, damping: 20, mass: 0.35 })
  const springY = useSpring(y, { stiffness: 260, damping: 20, mass: 0.35 })
  const reducedMotion = useReducedMotion()
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || !ref.current) return
    const bounds = ref.current.getBoundingClientRect()
    const dx = event.clientX - (bounds.left + bounds.width / 2)
    const dy = event.clientY - (bounds.top + bounds.height / 2)
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > range) return
    x.set((dx / Math.max(bounds.width, 1)) * bounds.width * intensity)
    y.set((dy / Math.max(bounds.height, 1)) * bounds.height * intensity)
  }
  const reset = () => { x.set(0); y.set(0) }
  return <motion.div ref={ref} className={cn(className)} style={{ x: springX, y: springY }} onPointerMove={move} onPointerLeave={reset}>{children}</motion.div>
}
