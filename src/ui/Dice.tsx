import { useEffect, useState } from 'react'

const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.26, 0.26],
    [0.5, 0.5],
    [0.74, 0.74],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.5, 0.5],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  6: [
    [0.28, 0.24],
    [0.72, 0.24],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.76],
    [0.72, 0.76],
  ],
}

/**
 * A bone die that actually tumbles before it settles. The face it lands on is
 * decided by the engine; the animation only reports the result.
 */
export function Die({ value, size = 56 }: { value: number; size?: number }) {
  const [face, setFace] = useState(value)
  const [rolling, setRolling] = useState(false)

  useEffect(() => {
    setRolling(true)
    let ticks = 0
    const spin = setInterval(() => {
      ticks += 1
      setFace(1 + Math.floor(Math.random() * 6))
      if (ticks > 6) {
        clearInterval(spin)
        setFace(value)
        setRolling(false)
      }
    }, 70)
    return () => clearInterval(spin)
  }, [value])

  const s = size
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      className={rolling ? 'anim-tumble' : ''}
      role="img"
      aria-label={`Gewürfelt: ${value}`}
    >
      <rect
        x="6"
        y="6"
        width="88"
        height="88"
        rx="16"
        fill="#f3ead2"
        stroke="#2a2118"
        strokeWidth="4"
      />
      <rect x="12" y="12" width="76" height="30" rx="10" fill="#fffaf0" opacity="0.5" />
      {(PIPS[face] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x * 100} cy={y * 100} r="8.5" fill="#2a2118" />
      ))}
    </svg>
  )
}
