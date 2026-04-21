import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface CrabWalkerProps {
  size?: number
  duration?: number
  className?: string
}

// Gesture timeline. Each inspect window has 5 sub-points so oscillating
// gestures (dance, munch, startle) can move during the pause.
//   idx  0    1    2    3    4    5    6     7    8    9    10   11    12   13  14  15
//   t    0  .15  .17  .19  .21  .22  .23   .35  .37  .39  .41  .42   .43   1   1   1
// Windows: inspect-1 = idx 1..5, inspect-2 = idx 7..11. Others rest.
const INSPECT_TIMES = [
  0, 0.15, 0.17, 0.19, 0.21, 0.22, 0.23, 0.35, 0.37, 0.39, 0.41, 0.42, 0.43, 1, 1, 1,
]

const REST_LEFT = -6
const REST_RIGHT = 6
const REST_EYE = 1

type Gesture = 'wave' | 'greet' | 'munch' | 'nap' | 'dance' | 'sniff' | 'startle'

// Each gesture supplies 5 values (for the 5 inspect-window sub-points).
interface GestureShape {
  left: [number, number, number, number, number]
  right: [number, number, number, number, number]
  eye: [number, number, number, number, number]
}

const GESTURES: Record<Gesture, GestureShape> = {
  wave:    { left: [-6, -6, -6, -6, -6],    right: [-28, -28, -28, -28, -28], eye: [1, 1, 1, 1, 1] },
  greet:   { left: [22, 22, 22, 22, 22],    right: [-22, -22, -22, -22, -22], eye: [1, 1, 1, 1, 1] },
  munch:   { left: [-14, -4, -14, -4, -14], right: [14, 4, 14, 4, 14],        eye: [0.75, 0.9, 0.75, 0.9, 0.75] },
  nap:     { left: [-2, -2, -2, -2, -2],    right: [2, 2, 2, 2, 2],           eye: [0.12, 0.12, 0.12, 0.12, 0.12] },
  dance:   { left: [-30, 10, -30, 10, -30], right: [-10, 30, -10, 30, -10],   eye: [1, 1, 1, 1, 1] },
  sniff:   { left: [-8, -12, -8, -12, -8],  right: [8, 12, 8, 12, 8],         eye: [0.5, 0.5, 0.5, 0.5, 0.5] },
  startle: { left: [-45, -40, -30, -18, -8], right: [45, 40, 30, 18, 8],      eye: [0.3, 0.9, 1, 1, 1] },
}

type SceneProp = React.FC<{ x: number; size: number }>

interface Scene {
  id: string
  wp1: number
  wp2: number
  prop1: SceneProp
  prop2: SceneProp
  decor?: SceneProp
  g1: Gesture
  g2: Gesture
}

const SCENES: Scene[] = [
  { id: 'beach',    wp1: 0.28, wp2: 0.62, prop1: Pebble,    prop2: Seaweed,    decor: Bubbles, g1: 'wave',    g2: 'wave'  },
  { id: 'treasure', wp1: 0.35, wp2: 0.78, prop1: Coin,      prop2: SandCastle,                  g1: 'greet',   g2: 'greet' },
  { id: 'reef',     wp1: 0.22, wp2: 0.70, prop1: Starfish,  prop2: Shell,                       g1: 'nap',     g2: 'munch' },
  { id: 'garden',   wp1: 0.40, wp2: 0.82, prop1: Flower,    prop2: Mushroom,                    g1: 'sniff',   g2: 'wave'  },
  { id: 'music',    wp1: 0.30, wp2: 0.58, prop1: MusicNote, prop2: Boombox,                     g1: 'dance',   g2: 'dance' },
  { id: 'fishing',  wp1: 0.45, wp2: 0.85, prop1: FishingHook, prop2: Fish,                      g1: 'startle', g2: 'greet' },
]

export function CrabWalker({ size = 26, duration = 28, className }: CrabWalkerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  const [sceneIdx, setSceneIdx] = React.useState(0)

  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Rotate to a new scene after each full walk-cycle.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setSceneIdx(i => (i + 1) % SCENES.length)
    }, duration * 1000)
    return () => window.clearInterval(id)
  }, [duration])

  const maxX = Math.max(0, width - size)
  const scene = SCENES[sceneIdx]!
  const wp1X = maxX * scene.wp1
  const wp2X = maxX * scene.wp2

  // Walk x-track with two pauses (outbound only).
  const xKeyframes = [0, wp1X, wp1X, wp2X, wp2X, maxX, maxX, wp2X, wp1X, 0]
  const xTimes     = [0, 0.15, 0.22, 0.35, 0.42, 0.50, 0.52, 0.70, 0.85, 1]
  const scaleKeyframes = [1, 1, -1, -1, 1]
  const scaleTimes     = [0, 0.50, 0.52, 0.98, 1]

  // Stitch gesture keyframes onto the 16-point INSPECT_TIMES skeleton.
  const g1 = GESTURES[scene.g1]
  const g2 = GESTURES[scene.g2]

  const buildGestureKeys = (
    rest: number,
    a: readonly [number, number, number, number, number],
    b: readonly [number, number, number, number, number],
  ) => [
    rest,
    a[0], a[1], a[2], a[3], a[4],
    rest,
    b[0], b[1], b[2], b[3], b[4],
    rest, rest, rest, rest,
  ]

  const leftClawKeys  = buildGestureKeys(REST_LEFT,  g1.left,  g2.left)
  const rightClawKeys = buildGestureKeys(REST_RIGHT, g1.right, g2.right)
  const eyeKeys       = buildGestureKeys(REST_EYE,   g1.eye,   g2.eye)

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none relative w-full overflow-hidden', className)}
      style={{ height: size }}
      aria-hidden
    >
      {/* Sand line */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: 0,
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(124,45,18,0.18) 8%, rgba(124,45,18,0.18) 92%, transparent)',
        }}
      />

      {maxX > 0 && (
        <React.Fragment key={scene.id + '-' + sceneIdx}>
          <scene.prop1 x={wp1X + size / 2} size={size} />
          <scene.prop2 x={wp2X + size / 2} size={size} />
          {scene.decor && <scene.decor x={wp2X + size / 2} size={size} />}

          <motion.div
            className="absolute left-0 top-0"
            style={{ width: size, height: size }}
            animate={{ x: xKeyframes, scaleX: scaleKeyframes }}
            transition={{
              x: { duration, times: xTimes, repeat: Infinity, ease: 'linear' },
              scaleX: { duration, times: scaleTimes, repeat: Infinity, ease: 'linear' },
            }}
          >
            <CrabBody
              size={size}
              duration={duration}
              leftClawKeys={leftClawKeys}
              rightClawKeys={rightClawKeys}
              eyeKeys={eyeKeys}
              sleepy={scene.g1 === 'nap' || scene.g2 === 'nap'}
              napWindow={scene.g1 === 'nap' ? 1 : scene.g2 === 'nap' ? 2 : null}
              startleWindow={scene.g1 === 'startle' ? 1 : scene.g2 === 'startle' ? 2 : null}
            />
          </motion.div>
        </React.Fragment>
      )}
    </div>
  )
}

// ---------------- CRAB BODY ----------------

interface CrabBodyProps {
  size: number
  duration: number
  leftClawKeys: number[]
  rightClawKeys: number[]
  eyeKeys: number[]
  sleepy: boolean
  napWindow: 1 | 2 | null
  startleWindow: 1 | 2 | null
}

function CrabBody({
  size,
  duration,
  leftClawKeys,
  rightClawKeys,
  eyeKeys,
  sleepy,
  napWindow,
  startleWindow,
}: CrabBodyProps) {
  const shell = '#f97316'
  const shellDark = '#c2410c'
  const shellLight = '#fb923c'
  const outline = '#7c2d12'

  const legWiggle = { duration: 0.42, repeat: Infinity, ease: 'easeInOut' as const }
  const innerClaw = { duration: 0.95, repeat: Infinity, ease: 'easeInOut' as const }
  const bobCycle = {
    animate: { y: [0, -1.2, 0, -1.2, 0] },
    transition: { duration: 0.42, repeat: Infinity, ease: 'easeInOut' as const },
  }
  const gestureTransition = {
    duration,
    times: INSPECT_TIMES,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  }

  // Nap: show Zzz rising above the shell during the nap window.
  const zzzCenter = napWindow === 1 ? 0.19 : napWindow === 2 ? 0.39 : null

  // Startle: jolt the whole body slightly upward.
  const startleCenter = startleWindow === 1 ? 0.19 : startleWindow === 2 ? 0.39 : null
  const startleYKeys = startleCenter !== null
    ? [0, 0, -3, -1.5, 0, 0, 0]
    : null
  const startleYTimes = startleCenter !== null
    ? [0, Math.max(0, startleCenter - 0.04), startleCenter - 0.02, startleCenter, startleCenter + 0.02, startleCenter + 0.04, 1]
    : null

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 56"
      fill="none"
      {...bobCycle}
    >
      {/* Optional body-level jolt for startle, on top of the bob. */}
      <motion.g
        animate={startleYKeys ? { y: startleYKeys } : undefined}
        transition={startleYTimes ? { duration, times: startleYTimes, repeat: Infinity, ease: 'easeOut' } : undefined}
      >
        {/* ---- LEGS ---- */}
        <motion.g
          style={{ transformOrigin: '32px 34px', transformBox: 'fill-box' }}
          animate={{ rotate: [-10, 8, -10] }}
          transition={legWiggle}
          stroke={outline}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M20 30 Q12 30 6 26" />
          <path d="M20 36 Q10 38 4 38" />
          <path d="M22 42 Q14 46 8 50" />
        </motion.g>
        <motion.g
          style={{ transformOrigin: '32px 34px', transformBox: 'fill-box' }}
          animate={{ rotate: [10, -8, 10] }}
          transition={legWiggle}
          stroke={outline}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M44 30 Q52 30 58 26" />
          <path d="M44 36 Q54 38 60 38" />
          <path d="M42 42 Q50 46 56 50" />
        </motion.g>

        {/* ---- CLAWS ---- */}
        <motion.g
          style={{ transformOrigin: '22px 22px', transformBox: 'fill-box' }}
          animate={{ rotate: leftClawKeys }}
          transition={gestureTransition}
        >
          <motion.g
            style={{ transformOrigin: '22px 22px', transformBox: 'fill-box' }}
            animate={{ rotate: [-3, 3, -3] }}
            transition={innerClaw}
          >
            <path d="M22 28 Q14 22 10 14" stroke={outline} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            <path
              d="M10 14 Q2 12 2 6 Q6 2 12 6 Q14 10 14 14 Q10 18 10 14 Z"
              fill={shell}
              stroke={outline}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <path d="M4 8 Q8 8 11 11" stroke={outline} strokeWidth={1.2} strokeLinecap="round" fill="none" />
          </motion.g>
        </motion.g>

        <motion.g
          style={{ transformOrigin: '42px 22px', transformBox: 'fill-box' }}
          animate={{ rotate: rightClawKeys }}
          transition={gestureTransition}
        >
          <motion.g
            style={{ transformOrigin: '42px 22px', transformBox: 'fill-box' }}
            animate={{ rotate: [3, -3, 3] }}
            transition={innerClaw}
          >
            <path d="M42 28 Q50 22 54 14" stroke={outline} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            <path
              d="M54 14 Q62 12 62 6 Q58 2 52 6 Q50 10 50 14 Q54 18 54 14 Z"
              fill={shell}
              stroke={outline}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
            <path d="M60 8 Q56 8 53 11" stroke={outline} strokeWidth={1.2} strokeLinecap="round" fill="none" />
          </motion.g>
        </motion.g>

        {/* ---- BODY / SHELL ---- */}
        <ellipse cx={32} cy={34} rx={16} ry={12} fill={shell} stroke={outline} strokeWidth={2} />
        <ellipse cx={26} cy={29} rx={3.5} ry={2} fill={shellLight} opacity={0.75} />
        <path
          d="M18 38 Q32 44 46 38"
          stroke={shellDark}
          strokeWidth={1.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />

        {/* ---- EYES ---- */}
        <line x1={27} y1={26} x2={26} y2={19} stroke={outline} strokeWidth={1.8} strokeLinecap="round" />
        <line x1={37} y1={26} x2={38} y2={19} stroke={outline} strokeWidth={1.8} strokeLinecap="round" />
        <motion.g
          animate={{ scaleY: eyeKeys }}
          transition={gestureTransition}
          style={{ transformOrigin: '32px 17px', transformBox: 'fill-box' }}
        >
          <circle cx={26} cy={17} r={2.6} fill="#fff" stroke={outline} strokeWidth={1} />
          <circle cx={38} cy={17} r={2.6} fill="#fff" stroke={outline} strokeWidth={1} />
          <circle cx={26.5} cy={17.3} r={1.2} fill="#1c1917" />
          <circle cx={38.5} cy={17.3} r={1.2} fill="#1c1917" />
        </motion.g>

        {/* ---- MOUTH ---- */}
        {sleepy ? (
          <path d="M29 39 Q32 37 35 39" stroke={outline} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        ) : (
          <path d="M29 38 Q32 40 35 38" stroke={outline} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        )}
      </motion.g>

      {/* ---- Zzz ---- */}
      {zzzCenter !== null && (
        <motion.g
          animate={{
            opacity: [0, 0, 1, 1, 0, 0],
            y:       [-2, -2, -6, -10, -14, -14],
          }}
          transition={{
            duration,
            times: [
              0,
              Math.max(0, zzzCenter - 0.035),
              zzzCenter - 0.01,
              zzzCenter + 0.01,
              zzzCenter + 0.035,
              1,
            ],
            repeat: Infinity,
            ease: 'easeOut',
          }}
          fill={outline}
          style={{ transformOrigin: '46px 14px', transformBox: 'fill-box' }}
        >
          <text x={46} y={14} fontSize={7} fontWeight={700} fontFamily="sans-serif">z</text>
          <text x={50} y={10} fontSize={5.5} fontWeight={700} fontFamily="sans-serif">z</text>
        </motion.g>
      )}

      {/* ---- Exclamation (startle) ---- */}
      {startleCenter !== null && (
        <motion.g
          animate={{ opacity: [0, 0, 1, 1, 0, 0], scale: [0.6, 0.6, 1.2, 1, 0.9, 0.9] }}
          transition={{
            duration,
            times: [
              0,
              Math.max(0, startleCenter - 0.03),
              startleCenter - 0.005,
              startleCenter + 0.015,
              startleCenter + 0.04,
              1,
            ],
            repeat: Infinity,
            ease: 'easeOut',
          }}
          style={{ transformOrigin: '48px 10px', transformBox: 'fill-box' }}
        >
          <rect x={47} y={4} width={2.4} height={7} rx={1.2} fill="#dc2626" />
          <circle cx={48.2} cy={13.4} r={1.2} fill="#dc2626" />
        </motion.g>
      )}
    </motion.svg>
  )
}

// ---------------- SCENE PROPS ----------------

function Pebble({ x, size }: { x: number; size: number }) {
  const w = Math.max(5, size * 0.32)
  const h = w * 0.55
  return (
    <svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h }}
      viewBox="0 0 16 9"
      aria-hidden
    >
      <ellipse cx={8} cy={7.5} rx={7.2} ry={1.6} fill="#78716c" opacity={0.82} />
      <ellipse cx={8} cy={5} rx={6.8} ry={4.2} fill="#a8a29e" stroke="#57534e" strokeWidth={0.6} />
      <ellipse cx={5.8} cy={3.8} rx={1.8} ry={0.9} fill="#d6d3d1" opacity={0.7} />
    </svg>
  )
}

function Seaweed({ x, size }: { x: number; size: number }) {
  const h = size * 0.92
  const w = Math.max(10, size * 0.5)
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h, transformOrigin: '50% 100%' }}
      viewBox="0 0 20 24"
      aria-hidden
      animate={{ rotate: [-3, 3, -3] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d="M10 24 Q6 18 10 12 Q14 6 10 0" stroke="#16a34a" strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <path d="M10 22 Q14 17 10 13" stroke="#22c55e" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.85} />
      <path d="M10 16 Q6 13 10 9" stroke="#4ade80" strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.7} />
    </motion.svg>
  )
}

function Bubbles({ x, size }: { x: number; size: number }) {
  const bubbles = [
    { r: 1.6, delay: 0,   dur: 4.2, drift: 3 },
    { r: 1.1, delay: 1.4, dur: 3.6, drift: -4 },
    { r: 1.3, delay: 2.6, dur: 4.8, drift: 2 },
  ]
  return (
    <div
      className="absolute"
      style={{ left: x - size / 2, bottom: 0, width: size, height: size }}
      aria-hidden
    >
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: size / 2 - b.r,
            bottom: size * 0.65,
            width: b.r * 2,
            height: b.r * 2,
            border: '1px solid rgba(125,211,252,0.9)',
            background: 'rgba(186,230,253,0.45)',
          }}
          animate={{ y: [0, -size * 0.9], x: [0, b.drift], opacity: [0, 0.9, 0.9, 0] }}
          transition={{
            duration: b.dur,
            delay: b.delay,
            repeat: Infinity,
            ease: 'easeOut',
            times: [0, 0.2, 0.85, 1],
          }}
        />
      ))}
    </div>
  )
}

function Coin({ x, size }: { x: number; size: number }) {
  const r = Math.max(4, size * 0.22)
  const side = r * 2 + 2
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - side / 2, bottom: 2, width: side, height: side }}
      viewBox="0 0 20 20"
      aria-hidden
      animate={{ rotate: [0, 6, -6, 0] }}
      transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <circle cx={10} cy={10} r={8} fill="#fcd34d" stroke="#a16207" strokeWidth={1.2} />
      <circle cx={10} cy={10} r={5.5} fill="none" stroke="#ca8a04" strokeWidth={0.8} />
      <text x={10} y={13.2} fontSize={8} fontWeight={800} fontFamily="sans-serif" fill="#78350f" textAnchor="middle">$</text>
      <motion.circle
        cx={7}
        cy={7}
        r={1.1}
        fill="#fffbeb"
        animate={{ opacity: [0.2, 0.9, 0.2] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.svg>
  )
}

function SandCastle({ x, size }: { x: number; size: number }) {
  const w = Math.max(14, size * 0.7)
  const h = size * 0.85
  return (
    <svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h }}
      viewBox="0 0 24 22"
      aria-hidden
    >
      <rect x={6} y={8} width={12} height={13} fill="#fcd34d" stroke="#a16207" strokeWidth={1} />
      <rect x={6} y={6} width={2.5} height={3} fill="#fcd34d" stroke="#a16207" strokeWidth={1} />
      <rect x={10.75} y={6} width={2.5} height={3} fill="#fcd34d" stroke="#a16207" strokeWidth={1} />
      <rect x={15.5} y={6} width={2.5} height={3} fill="#fcd34d" stroke="#a16207" strokeWidth={1} />
      <path d="M10 21 L10 16 Q12 14 14 16 L14 21 Z" fill="#78350f" />
      <line x1={12} y1={6} x2={12} y2={1} stroke="#7c2d12" strokeWidth={1} />
      <path d="M12 1 L17 2.5 L12 4 Z" fill="#ef4444" />
    </svg>
  )
}

function Starfish({ x, size }: { x: number; size: number }) {
  const s = Math.max(10, size * 0.55)
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - s / 2, bottom: 1, width: s, height: s, transformOrigin: '50% 80%' }}
      viewBox="0 0 24 24"
      aria-hidden
      animate={{ rotate: [-4, 4, -4] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path
        d="M12 2 L14.5 9 L22 9.5 L16 14 L18 21.5 L12 17 L6 21.5 L8 14 L2 9.5 L9.5 9 Z"
        fill="#fb7185"
        stroke="#9f1239"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <circle cx={10} cy={11} r={0.7} fill="#9f1239" />
      <circle cx={14} cy={11} r={0.7} fill="#9f1239" />
      <circle cx={12} cy={14} r={0.6} fill="#9f1239" />
    </motion.svg>
  )
}

function Shell({ x, size }: { x: number; size: number }) {
  const w = Math.max(12, size * 0.58)
  const h = w * 0.85
  return (
    <svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h }}
      viewBox="0 0 24 20"
      aria-hidden
    >
      <path
        d="M12 19 L2 9 Q2 3 12 3 Q22 3 22 9 Z"
        fill="#fbcfe8"
        stroke="#9d174d"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <path d="M12 19 L5 9" stroke="#9d174d" strokeWidth={0.8} />
      <path d="M12 19 L8 6" stroke="#9d174d" strokeWidth={0.8} />
      <path d="M12 19 L12 4" stroke="#9d174d" strokeWidth={0.8} />
      <path d="M12 19 L16 6" stroke="#9d174d" strokeWidth={0.8} />
      <path d="M12 19 L19 9" stroke="#9d174d" strokeWidth={0.8} />
      <ellipse cx={12} cy={19} rx={2.5} ry={0.8} fill="#9d174d" />
    </svg>
  )
}

function Flower({ x, size }: { x: number; size: number }) {
  const w = Math.max(14, size * 0.62)
  const h = size
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h, transformOrigin: '50% 100%' }}
      viewBox="0 0 24 28"
      aria-hidden
      animate={{ rotate: [-3, 3, -3] }}
      transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* stem */}
      <path d="M12 28 Q12 20 12 12" stroke="#166534" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      {/* leaf */}
      <path d="M12 20 Q6 18 6 14 Q10 15 12 20 Z" fill="#22c55e" stroke="#166534" strokeWidth={0.8} />
      {/* petals */}
      <g stroke="#b91c1c" strokeWidth={0.8}>
        <ellipse cx={12} cy={6}  rx={2.5} ry={3.5} fill="#f87171" />
        <ellipse cx={6.5} cy={10} rx={3.5} ry={2.5} fill="#f87171" />
        <ellipse cx={17.5} cy={10} rx={3.5} ry={2.5} fill="#f87171" />
        <ellipse cx={9} cy={14} rx={2.5} ry={3.5} fill="#f87171" />
        <ellipse cx={15} cy={14} rx={2.5} ry={3.5} fill="#f87171" />
      </g>
      <circle cx={12} cy={10} r={2} fill="#fbbf24" stroke="#b45309" strokeWidth={0.6} />
    </motion.svg>
  )
}

function Mushroom({ x, size }: { x: number; size: number }) {
  const w = Math.max(14, size * 0.6)
  const h = size * 0.9
  return (
    <svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h }}
      viewBox="0 0 24 24"
      aria-hidden
    >
      {/* stem */}
      <path d="M8 24 L8 14 Q8 11 12 11 Q16 11 16 14 L16 24 Z" fill="#fef3c7" stroke="#78350f" strokeWidth={1.1} />
      {/* cap */}
      <path d="M2 14 Q12 -1 22 14 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth={1.2} strokeLinejoin="round" />
      {/* spots */}
      <circle cx={8} cy={10} r={1.6} fill="#fff" />
      <circle cx={14} cy={6} r={1.3} fill="#fff" />
      <circle cx={17} cy={11} r={1.4} fill="#fff" />
    </svg>
  )
}

function MusicNote({ x, size }: { x: number; size: number }) {
  const w = Math.max(10, size * 0.5)
  const h = size * 0.95
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h, transformOrigin: '50% 100%' }}
      viewBox="0 0 20 26"
      aria-hidden
      animate={{ y: [0, -2, 0, -2, 0], rotate: [-5, 5, -5] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d="M14 3 L14 18" stroke="#1e293b" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M14 3 Q19 4 19 9" stroke="#1e293b" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <ellipse cx={11} cy={19} rx={4} ry={3} fill="#1e293b" transform="rotate(-18 11 19)" />
    </motion.svg>
  )
}

function Boombox({ x, size }: { x: number; size: number }) {
  const w = Math.max(20, size * 0.95)
  const h = size * 0.75
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - w / 2, bottom: 0, width: w, height: h, transformOrigin: '50% 100%' }}
      viewBox="0 0 32 24"
      aria-hidden
      animate={{ scale: [1, 1.05, 1, 1.05, 1] }}
      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* handle */}
      <path d="M10 6 Q16 2 22 6" stroke="#334155" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {/* body */}
      <rect x={3} y={6} width={26} height={16} rx={2} fill="#475569" stroke="#1e293b" strokeWidth={1.2} />
      {/* speakers */}
      <circle cx={10} cy={14} r={4} fill="#1e293b" stroke="#0f172a" strokeWidth={0.8} />
      <circle cx={10} cy={14} r={1.5} fill="#94a3b8" />
      <circle cx={22} cy={14} r={4} fill="#1e293b" stroke="#0f172a" strokeWidth={0.8} />
      <circle cx={22} cy={14} r={1.5} fill="#94a3b8" />
      {/* LED */}
      <motion.circle
        cx={16}
        cy={9}
        r={0.9}
        animate={{ fill: ['#22c55e', '#f59e0b', '#22c55e'] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
    </motion.svg>
  )
}

function FishingHook({ x, size }: { x: number; size: number }) {
  const w = Math.max(10, size * 0.4)
  const h = size
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - w / 2, top: 0, width: w, height: h, transformOrigin: '50% 0%' }}
      viewBox="0 0 10 26"
      aria-hidden
      animate={{ rotate: [-2, 2, -2] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* line */}
      <line x1={5} y1={0} x2={5} y2={17} stroke="#64748b" strokeWidth={0.6} />
      {/* hook */}
      <path
        d="M5 17 L5 21 Q5 25 2 25 Q-0.5 25 0.5 22"
        stroke="#475569"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
      {/* barb */}
      <path d="M2 24 L1 22.2" stroke="#475569" strokeWidth={1.1} strokeLinecap="round" />
    </motion.svg>
  )
}

function Fish({ x, size }: { x: number; size: number }) {
  const w = Math.max(16, size * 0.8)
  const h = size * 0.55
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - w / 2, bottom: size * 0.18, width: w, height: h }}
      viewBox="0 0 32 18"
      aria-hidden
      animate={{ x: [0, 3, 0, -3, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* tail */}
      <motion.path
        d="M2 9 L8 3 L8 15 Z"
        fill="#0ea5e9"
        stroke="#0369a1"
        strokeWidth={1}
        strokeLinejoin="round"
        animate={{ rotate: [-10, 10, -10] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '8px 9px', transformBox: 'fill-box' }}
      />
      {/* body */}
      <ellipse cx={18} cy={9} rx={10} ry={5.5} fill="#38bdf8" stroke="#0369a1" strokeWidth={1.2} />
      {/* eye */}
      <circle cx={24} cy={7.5} r={1.3} fill="#fff" stroke="#0369a1" strokeWidth={0.6} />
      <circle cx={24.4} cy={7.7} r={0.7} fill="#0f172a" />
      {/* gill */}
      <path d="M16 6 Q14 9 16 12" stroke="#0369a1" strokeWidth={0.7} fill="none" />
    </motion.svg>
  )
}
