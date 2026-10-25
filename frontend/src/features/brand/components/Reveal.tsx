import { motion, type HTMLMotionProps } from 'motion/react'

type Props = HTMLMotionProps<'div'> & {
  /** 나타나기까지 기다리는 시간(초). 여러 개를 순서대로 띄울 때 0.1 씩 늘리기 */
  delay?: number
  /** 아래에서 떠오르는 거리(px) */
  y?: number
}

/** 화면에 들어오면 아래에서 부드럽게 떠오르는 상자 (한 번만) */
export function Reveal({ delay = 0, y = 32, children, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
