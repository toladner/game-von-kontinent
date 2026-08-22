import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameState, PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'
import type { Port } from '@engine/types'
import { isPort } from '@engine/mapbuild'
import { project } from '@engine/geo'
import { voyageProgress } from '@engine/state'
import land from '@content/geo/land.json'
import { PLAYER_COLORS } from '@app/store'

const BOARD_W = 1200
const MIN_K = 0.8
const MAX_K = 8
/** Below this the sea pips are noise; above it they help you judge distance. */
const PIP_ZOOM = 2.2
const LABEL_ZOOM = 1.9

interface LandFile {
  readonly features: readonly { readonly continent: string; readonly polygons: number[][][][] }[]
}

const CONTINENT_FILL: Record<string, string> = {
  europa: 'var(--color-eu)',
  afrika: 'var(--color-af)',
  nordamerika: 'var(--color-na)',
  suedamerika: 'var(--color-sa)',
  asien: 'var(--color-as)',
  ozeanien: 'var(--color-oc)',
}

interface Point {
  x: number
  y: number
}

export interface BoardProps {
  readonly ctx: EngineContext
  readonly state: GameState
  readonly legalTargets: readonly string[]
  readonly onPick: (nodeId: string) => void
  readonly focusNode?: string | null
  readonly highlightPorts?: readonly string[]
  readonly now?: number
  readonly onPickPort?: (portId: string) => void
  readonly course?: readonly string[]
  /**
   * Bumping this recentres the plan on `focusNode`. The turn changing is the
   * usual reason: you should never have to hunt for your own ship.
   */
  readonly focusNonce?: number
}

export function Board({
  ctx,
  state,
  legalTargets,
  onPick,
  focusNode,
  highlightPorts = [],
  now = 0,
  onPickPort,
  course = [],
  focusNonce = 0,
}: BoardProps) {
  const map = ctx.pack.map
  const { bounds } = map

  const H = useMemo(
    () => (BOARD_W * (bounds.maxLat - bounds.minLat)) / (bounds.maxLon - bounds.minLon),
    [bounds],
  )

  const xy = useCallback(
    (lat: number, lon: number) => project({ lat, lon }, bounds, { width: BOARD_W, height: H }),
    [bounds, H],
  )

  const positions = useMemo(() => {
    const m = new Map<string, Point>()
    for (const n of map.nodes) m.set(n.id, xy(n.lat, n.lon))
    return m
  }, [map.nodes, xy])

  const at = useCallback(
    (id: string | null | undefined): Point | null => (id ? (positions.get(id) ?? null) : null),
    [positions],
  )

  // --- static geometry, computed once -------------------------------------

  const landPaths = useMemo(() => {
    const file = land as unknown as LandFile
    return file.features.map((feature) => {
      let d = ''
      for (const poly of feature.polygons) {
        for (const ring of poly) {
          ring.forEach((pair, i) => {
            const lon = pair[0]
            const lat = pair[1]
            if (lon === undefined || lat === undefined) return
            const p = xy(lat, lon)
            d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
          })
          d += 'Z'
        }
      }
      return { continent: feature.continent, d }
    })
  }, [xy])

  const lanePath = useMemo(() => {
    let d = ''
    for (const lane of map.lanes) {
      const a = positions.get(lane.a)
      const b = positions.get(lane.b)
      if (!a || !b) continue
      d += `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
    }
    return d
  }, [map.lanes, positions])

  const seaDots = useMemo(
    () =>
      map.nodes
        .filter((n) => !isPort(n))
        .map((n) => ({ id: n.id, p: positions.get(n.id) }))
        .filter((d): d is { id: string; p: Point } => d.p !== undefined),
    [map.nodes, positions],
  )

  const ports = useMemo(
    () =>
      map.nodes
        .filter(isPort)
        .map((port) => ({ port, p: positions.get(port.id) }))
        .filter((d): d is { port: Port; p: Point } => d.p !== undefined),
    [map.nodes, positions],
  )

  // --- pan & zoom ----------------------------------------------------------

  const svgRef = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 })
  const [smooth, setSmooth] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view

  /** Live pointers on the surface. One pans, two pinch. */
  const pointers = useRef(new Map<number, Point>())
  const panFrom = useRef<{ pointer: Point; tx: number; ty: number } | null>(null)
  const pinchFrom = useRef<{ dist: number; k: number; mid: Point } | null>(null)
  const moved = useRef(false)

  const clamp = useCallback(
    (v: { k: number; tx: number; ty: number }) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k))
      const maxX = Math.max(0, BOARD_W * (k - 1))
      const maxY = Math.max(0, H * (k - 1))
      return {
        k,
        tx: Math.min(0, Math.max(-maxX, v.tx)),
        ty: Math.min(0, Math.max(-maxY, v.ty)),
      }
    },
    [H],
  )

  const toLocal = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
      return {
        x: ((clientX - rect.left) / rect.width) * BOARD_W,
        y: ((clientY - rect.top) / rect.height) * H,
      }
    },
    [H],
  )

  const zoomAround = useCallback(
    (factor: number, centre: Point) => {
      setSmooth(false)
      setView((v) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
        const scale = k / v.k
        return clamp({
          k,
          tx: centre.x - (centre.x - v.tx) * scale,
          ty: centre.y - (centre.y - v.ty) * scale,
        })
      })
    },
    [clamp],
  )

  /** Put a node in the middle of the viewport, smoothly. */
  const centreOn = useCallback(
    (nodeId: string | null | undefined, zoom?: number) => {
      const p = at(nodeId)
      if (!p) return
      setSmooth(true)
      setView((v) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, zoom ?? Math.max(v.k, 2.4)))
        return clamp({ k, tx: BOARD_W / 2 - k * p.x, ty: H / 2 - k * p.y })
      })
    },
    [at, clamp, H],
  )

  // At the start of a turn, go and find the ship rather than making the
  // player hunt for it.
  useEffect(() => {
    if (!focusNode) return
    centreOn(focusNode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce])

  const releasePointer = useCallback((pointerId: number) => {
    pointers.current.delete(pointerId)
    if (pointers.current.size < 2) pinchFrom.current = null
    if (pointers.current.size === 0) panFrom.current = null
  }, [])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const local = toLocal(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, local)
    moved.current = false
    // Capture on the surface itself: a child may unmount mid-gesture.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety, not a requirement */
    }

    if (pointers.current.size === 1) {
      panFrom.current = { pointer: local, tx: viewRef.current.tx, ty: viewRef.current.ty }
      pinchFrom.current = null
      return
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (a && b) {
        pinchFrom.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          k: viewRef.current.k,
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        }
      }
      panFrom.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    const local = toLocal(e.clientX, e.clientY)
    pointers.current.set(e.pointerId, local)

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const start = pinchFrom.current
      if (!a || !b || !start) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      moved.current = true
      setSmooth(false)
      setView((v) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, start.k * (dist / start.dist)))
        const scale = k / v.k
        return clamp({
          k,
          tx: start.mid.x - (start.mid.x - v.tx) * scale,
          ty: start.mid.y - (start.mid.y - v.ty) * scale,
        })
      })
      return
    }

    const start = panFrom.current
    if (!start) return
    const dx = local.x - start.pointer.x
    const dy = local.y - start.pointer.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true
    setSmooth(false)
    setView((v) => clamp({ ...v, tx: start.tx + dx, ty: start.ty + dy }))
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    releasePointer(e.pointerId)
    // A remaining finger takes the pan over cleanly.
    const rest = [...pointers.current.values()][0]
    if (rest) {
      panFrom.current = { pointer: rest, tx: viewRef.current.tx, ty: viewRef.current.ty }
    }
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    zoomAround(e.deltaY < 0 ? 1.15 : 1 / 1.15, toLocal(e.clientX, e.clientY))
  }

  const tapped = (handler: () => void) => () => {
    if (moved.current) return
    handler()
  }

  // --- derived, cheap ------------------------------------------------------

  const targetSet = useMemo(() => new Set(legalTargets), [legalTargets])
  const hintSet = useMemo(() => new Set(highlightPorts), [highlightPorts])
  const occupiedPorts = useMemo(
    () => new Set(state.players.map((p) => p.ship.nodeId)),
    [state.players],
  )

  const ships = state.players.map((p, i) => {
    const here = at(p.ship.nodeId)
    if (!here) return null
    const voyage = p.ship.voyage ?? null
    const next = voyage ? at(voyage.route[0]) : null

    let pos = here
    if (voyage && next) {
      const t = voyageProgress(voyage, now || voyage.legStartedAt)
      pos = { x: here.x + (next.x - here.x) * t, y: here.y + (next.y - here.y) * t }
    }
    const from = voyage && next ? here : at(p.ship.cameFrom)
    return { player: p, pos, from, sailing: Boolean(voyage), index: i }
  })

  const coursePath = useMemo(() => {
    if (course.length < 2) return ''
    let d = ''
    let started = false
    for (const id of course) {
      const p = positions.get(id)
      if (!p) continue
      d += `${started ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      started = true
    }
    return d
  }, [course, positions])

  return (
    <div className="board-shell relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BOARD_W} ${H}`}
        className="h-full w-full touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="img"
        aria-label="Spielplan mit Schiffahrtslinien"
      >
        <defs>
          <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
            <stop offset="60%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#3a2d18" stopOpacity="0.35" />
          </radialGradient>
          <linearGradient id="seaSheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#2a5f6b" stopOpacity="0.14" />
          </linearGradient>
        </defs>

        <g
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`,
            transformOrigin: '0 0',
            transition: smooth ? 'transform 520ms cubic-bezier(0.25,0.9,0.3,1)' : 'none',
          }}
        >
          <SeaAndLand H={H} landPaths={landPaths} lanePath={lanePath} xy={xy} />

          {view.k >= PIP_ZOOM && (
            <g fill="var(--color-route)">
              {seaDots.map((d) => (
                <circle key={d.id} cx={d.p.x} cy={d.p.y} r={1.4} opacity={0.8} />
              ))}
            </g>
          )}

          {coursePath && (
            <path
              d={coursePath}
              fill="none"
              stroke="#1c6b4d"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              opacity={0.85}
            />
          )}

          {[...targetSet].map((id) => {
            const p = positions.get(id)
            if (!p) return null
            return (
              <g key={`t-${id}`} onPointerUp={tapped(() => onPick(id))} className="cursor-pointer">
                <circle cx={p.x} cy={p.y} r={12} fill="#ffffff" opacity={0.25} />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={5.5}
                  fill="none"
                  stroke="#1c6b4d"
                  strokeWidth={1.8}
                  style={{ animation: 'pulse-ring 1.6s ease-out infinite' }}
                />
              </g>
            )
          })}

          {ports.map(({ port, p }) => {
            const labelled =
              view.k >= LABEL_ZOOM ||
              occupiedPorts.has(port.id) ||
              targetSet.has(port.id) ||
              hintSet.has(port.id) ||
              port.id === focusNode
            return (
              <g
                key={port.id}
                onPointerUp={onPickPort ? tapped(() => onPickPort(port.id)) : undefined}
                className={onPickPort ? 'cursor-pointer' : undefined}
              >
                {onPickPort && <circle cx={p.x} cy={p.y} r={11} fill="transparent" />}
                {hintSet.has(port.id) && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill="none"
                    stroke="#1c6b4d"
                    strokeWidth={1.2}
                    opacity={0.75}
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={2.6}
                  fill="var(--color-rot)"
                  stroke="#5a2018"
                  strokeWidth={0.5}
                />
                {labelled && (
                  <text className="port-label" x={p.x + 4} y={p.y + 2.6}>
                    {port.name}
                  </text>
                )}
              </g>
            )
          })}

          {ships.map((s) =>
            s ? (
              <Ship
                key={s.player.id}
                player={s.player}
                x={s.pos.x}
                y={s.pos.y}
                heading={s.from ? Math.atan2(s.pos.y - s.from.y, s.pos.x - s.from.x) : 0}
                active={s.player.ship.nodeId === focusNode}
                nudge={s.index * 4 - 2}
                laden={s.player.cargo.length}
                sailing={s.sailing}
              />
            ) : null,
          )}

          <CompassRose x={BOARD_W * 0.06} y={H * 0.82} />
        </g>

        <rect width={BOARD_W} height={H} fill="url(#vignette)" pointerEvents="none" />
      </svg>

      <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col gap-1.5">
        <button
          className="btn btn-sm pointer-events-auto !px-2.5 text-lg leading-none"
          onClick={() => zoomAround(1.4, { x: BOARD_W / 2, y: H / 2 })}
          aria-label="Näher heran"
        >
          +
        </button>
        <button
          className="btn btn-sm pointer-events-auto !px-2.5 text-lg leading-none"
          onClick={() => zoomAround(1 / 1.4, { x: BOARD_W / 2, y: H / 2 })}
          aria-label="Weiter weg"
        >
          −
        </button>
        <button
          className="btn btn-sm pointer-events-auto !px-2 text-base leading-none"
          onClick={() => centreOn(focusNode, 3)}
          aria-label="Zum eigenen Schiff"
          title="Zum eigenen Schiff"
        >
          ⚓
        </button>
        <button
          className="btn btn-sm pointer-events-auto !px-2 text-xs leading-none"
          onClick={() => {
            setSmooth(true)
            setView({ k: 1, tx: 0, ty: 0 })
          }}
          aria-label="Ganzer Plan"
        >
          ⤢
        </button>
      </div>
    </div>
  )
}

/**
 * Ocean, graticule, continents and sea lanes.
 *
 * None of it changes once the map is built, so it is held apart from the
 * ships: in real-time play the clock re-renders every second, and this is the
 * expensive half of the picture.
 */
const SeaAndLand = memo(function SeaAndLand({
  H,
  landPaths,
  lanePath,
  xy,
}: {
  H: number
  landPaths: readonly { continent: string; d: string }[]
  lanePath: string
  xy: (lat: number, lon: number) => Point
}) {
  return (
    <>
      <rect width={BOARD_W} height={H} fill="var(--color-ocean)" />
      <rect width={BOARD_W} height={H} fill="url(#seaSheen)" />

      <g stroke="#6ba9b6" strokeWidth={0.4} opacity={0.3}>
        {Array.from({ length: 13 }, (_, i) => {
          const y = xy(-60 + i * 10, 0).y
          return <line key={`p${i}`} x1={0} y1={y} x2={BOARD_W} y2={y} />
        })}
        {Array.from({ length: 20 }, (_, i) => {
          const x = xy(0, -180 + i * 20).x
          return <line key={`m${i}`} x1={x} y1={0} x2={x} y2={H} />
        })}
      </g>

      <g stroke="var(--color-coast)" strokeWidth={0.7} strokeLinejoin="round">
        {landPaths.map((f) => (
          <path
            key={f.continent}
            d={f.d}
            fill={CONTINENT_FILL[f.continent] ?? '#d9cfa8'}
            fillRule="evenodd"
          />
        ))}
      </g>

      {/*
        One dotted stroke rather than six hundred little circles: the printed
        board's look at a fraction of the cost on a telephone.
      */}
      <path
        className="sea-lane"
        d={lanePath}
        strokeWidth={1.3}
        strokeDasharray="0.1 3.4"
        opacity={0.75}
      />
    </>
  )
})

const Ship = memo(function Ship({
  player,
  x,
  y,
  heading,
  active,
  nudge,
  laden,
  sailing,
}: {
  player: PlayerState
  x: number
  y: number
  heading: number
  active: boolean
  nudge: number
  laden: number
  sailing: boolean
}) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]?.ink ?? '#1b1b1b'
  const deg = (heading * 180) / Math.PI
  const flip = Math.abs(deg) > 90 ? -1 : 1
  return (
    <g
      transform={`translate(${x} ${y - 4 + nudge}) scale(${flip} 1)`}
      style={{ transition: sailing ? 'none' : 'transform 260ms ease-out' }}
    >
      {active && <circle cx={0} cy={3} r={11} fill="#fff8e0" opacity={0.55} />}
      {sailing && <path d="M-16 5 q6 -2 12 0 q-6 2 -12 0" fill="#ffffff" opacity={0.5} />}
      <g transform="translate(-8 -6) scale(0.5)">
        <path d="M2 22h30l-5 8H7z" fill={color} />
        <path d="M8 21V8h14l7 7v6z" fill={color} opacity={0.85} />
        <rect x="12" y="0" width="2.5" height="9" fill={color} />
        <rect x="19" y="2" width="2.5" height="7" fill={color} />
        {Array.from({ length: Math.min(laden, 4) }, (_, i) => (
          <rect
            key={i}
            x={2.5 + i * 6}
            y={16}
            width="5"
            height="5"
            fill="#c8a877"
            stroke="#4a3520"
            strokeWidth="1"
          />
        ))}
        <path d="M2 22h30l-5 8H7z" fill="none" stroke="#2a2118" strokeWidth="1.4" />
      </g>
    </g>
  )
})

const CompassRose = memo(function CompassRose({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.45} pointerEvents="none">
      <circle r={22} fill="none" stroke="#2a5f6b" strokeWidth={0.8} />
      <circle r={15} fill="none" stroke="#2a5f6b" strokeWidth={0.4} />
      <path d="M0 -21 L4 0 L0 21 L-4 0 Z" fill="#2a5f6b" opacity={0.75} />
      <path d="M-21 0 L0 -3.5 L21 0 L0 3.5 Z" fill="#2a5f6b" opacity={0.4} />
      <text y={-25} textAnchor="middle" fontSize={8} fill="#1d4b55">
        N
      </text>
    </g>
  )
})
