import { memo, useCallback, useMemo, useRef, useState } from 'react'
import type { GameState, PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'
import { isPort } from '@engine/mapbuild'
import { project } from '@engine/geo'
import land from '@content/geo/land.json'
import { PLAYER_COLORS } from '@app/store'

const BOARD_W = 1200

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

export interface BoardProps {
  readonly ctx: EngineContext
  readonly state: GameState
  readonly legalTargets: readonly string[]
  readonly onPick: (nodeId: string) => void
  readonly focusNode?: string | null
  /** Harbours the Kontor suggests steering for; drawn with a green ring. */
  readonly highlightPorts?: readonly string[]
}

export function Board({
  ctx,
  state,
  legalTargets,
  onPick,
  focusNode,
  highlightPorts = [],
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
    const m = new Map<string, { x: number; y: number }>()
    for (const n of map.nodes) m.set(n.id, xy(n.lat, n.lon))
    return m
  }, [map.nodes, xy])

  const landPaths = useMemo(() => {
    const file = land as unknown as LandFile
    return file.features.map((feature) => {
      let d = ''
      for (const poly of feature.polygons) {
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => {
            const p = xy(lat!, lon!)
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
    () => map.nodes.filter((n) => !isPort(n)).map((n) => ({ id: n.id, ...positions.get(n.id)! })),
    [map.nodes, positions],
  )

  const ports = useMemo(
    () => map.nodes.filter(isPort).map((p) => ({ port: p, ...positions.get(p.id)! })),
    [map.nodes, positions],
  )

  // --- pan & zoom ---------------------------------------------------------
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const pinch = useRef<{ dist: number; k: number } | null>(null)
  const moved = useRef(false)

  const clamp = (v: { k: number; tx: number; ty: number }) => {
    const k = Math.min(6, Math.max(0.8, v.k))
    const maxX = BOARD_W * (k - 1)
    const maxY = H * (k - 1)
    return {
      k,
      tx: Math.min(0, Math.max(-maxX, v.tx)),
      ty: Math.min(0, Math.max(-maxY, v.ty)),
    }
  }

  const zoomAt = (factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = Math.min(6, Math.max(0.8, v.k * factor))
      const scale = k / v.k
      return clamp({ k, tx: cx - (cx - v.tx) * scale, ty: cy - (cy - v.ty) * scale })
    })
  }

  const toLocal = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * BOARD_W,
      y: ((clientY - rect.top) / rect.height) * H,
    }
  }

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch' && e.isPrimary === false) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toLocal(e.clientX, e.clientY)
    drag.current = { x: p.x, y: p.y, tx: view.tx, ty: view.ty }
    moved.current = false
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const p = toLocal(e.clientX, e.clientY)
    const dx = p.x - drag.current.x
    const dy = p.y - drag.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true
    setView((v) => clamp({ ...v, tx: drag.current!.tx + dx, ty: drag.current!.ty + dy }))
  }

  const endDrag = () => {
    drag.current = null
    pinch.current = null
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const p = toLocal(e.clientX, e.clientY)
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y)
  }

  const onTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length !== 2) return
    const [a, b] = [e.touches[0]!, e.touches[1]!]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const mid = toLocal((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
    if (!pinch.current) {
      pinch.current = { dist, k: view.k }
      return
    }
    zoomAt(dist / pinch.current.dist, mid.x, mid.y)
    pinch.current = { dist, k: view.k }
  }

  const targetSet = useMemo(() => new Set(legalTargets), [legalTargets])
  const hintSet = useMemo(() => new Set(highlightPorts), [highlightPorts])
  const showAllLabels = view.k >= 1.9

  const ships = state.players.map((p) => ({
    player: p,
    pos: positions.get(p.ship.nodeId)!,
    from: p.ship.cameFrom ? positions.get(p.ship.cameFrom) : undefined,
  }))

  const occupied = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of state.players) m.set(p.ship.nodeId, (m.get(p.ship.nodeId) ?? 0) + 1)
    return m
  }, [state.players])

  return (
    <div className="board-shell relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BOARD_W} ${H}`}
        className="h-full w-full touch-none select-none"
        style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
        onTouchMove={onTouchMove}
        onTouchEnd={endDrag}
        role="img"
        aria-label="Spielplan mit Schiffahrtslinien"
      >
        <defs>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" result="n" />
            <feColorMatrix in="n" type="saturate" values="0" result="g" />
            <feComposite in="g" in2="SourceGraphic" operator="in" />
          </filter>
          <linearGradient id="seaSheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#2a5f6b" stopOpacity="0.14" />
          </linearGradient>
          <radialGradient id="vignette" cx="50%" cy="45%" r="75%">
            <stop offset="60%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#3a2d18" stopOpacity="0.35" />
          </radialGradient>
        </defs>

        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* Ozean */}
          <rect width={BOARD_W} height={H} fill="var(--color-ocean)" />
          <rect width={BOARD_W} height={H} fill="url(#seaSheen)" />

          {/* Gradnetz */}
          <g stroke="#6ba9b6" strokeWidth={0.4} opacity={0.35}>
            {Array.from({ length: 13 }, (_, i) => {
              const lat = -60 + i * 10
              const y = xy(lat, 0).y
              return <line key={`p${lat}`} x1={0} y1={y} x2={BOARD_W} y2={y} />
            })}
            {Array.from({ length: 20 }, (_, i) => {
              const lon = -180 + i * 20
              const x = xy(0, lon).x
              return <line key={`m${lon}`} x1={x} y1={0} x2={x} y2={H} />
            })}
          </g>

          {/* Landmassen */}
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

          {/* Schiffahrtslinien */}
          <path className="sea-lane" d={lanePath} strokeWidth={0.9} opacity={0.75} />
          <g fill="var(--color-route)">
            {seaDots.map((d) => (
              <circle key={d.id} cx={d.x} cy={d.y} r={1.5} opacity={0.85} />
            ))}
          </g>

          {/* Erlaubte Ziele */}
          <g>
            {[...targetSet].map((id) => {
              const p = positions.get(id)
              if (!p) return null
              return (
                <g key={`t-${id}`} onPointerUp={() => !moved.current && onPick(id)}>
                  <circle cx={p.x} cy={p.y} r={9} fill="#ffffff" opacity={0.28} />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={5.5}
                    fill="none"
                    stroke="#1c6b4d"
                    strokeWidth={1.8}
                    style={{ animation: 'pulse-ring 1.6s ease-out infinite' }}
                  />
                  <circle cx={p.x} cy={p.y} r={11} fill="transparent" className="cursor-pointer" />
                </g>
              )
            })}
          </g>

          {/* Häfen */}
          <g>
            {ports.map(({ port, x, y }) => {
              const here = state.players.some((p) => p.ship.nodeId === port.id)
              const labelled =
                showAllLabels ||
                here ||
                targetSet.has(port.id) ||
                hintSet.has(port.id) ||
                port.id === focusNode
              return (
                <g key={port.id}>
                  {hintSet.has(port.id) && (
                    <circle
                      cx={x}
                      cy={y}
                      r={6}
                      fill="none"
                      stroke="#1c6b4d"
                      strokeWidth={1.2}
                      opacity={0.75}
                    />
                  )}
                  <circle cx={x} cy={y} r={2.6} fill="var(--color-rot)" stroke="#5a2018" strokeWidth={0.5} />
                  {labelled && (
                    <text
                      className="port-label"
                      x={x + 4}
                      y={y + 2.6}
                      textAnchor={port.labelAnchor ?? 'start'}
                    >
                      {port.name}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Schiffe */}
          <g>
            {ships.map(({ player, pos, from }, i) => (
              <Ship
                key={player.id}
                player={player}
                x={pos.x}
                y={pos.y}
                heading={from ? Math.atan2(pos.y - from.y, pos.x - from.x) : 0}
                active={state.players[state.activeIndex]?.id === player.id}
                laden={player.cargo.length}
                nudge={(occupied.get(player.ship.nodeId) ?? 1) > 1 ? i * 5 - 2 : 0}
              />
            ))}
          </g>

          <CompassRose x={BOARD_W * 0.06} y={H * 0.82} />
          <Cartouche x={BOARD_W * 0.045} y={H * 0.06} />
        </g>

        <rect width={BOARD_W} height={H} fill="url(#vignette)" pointerEvents="none" />
      </svg>

      <div className="pointer-events-none absolute right-3 bottom-3 flex flex-col gap-1.5">
        <button
          className="btn pointer-events-auto !px-2.5 !py-1 text-lg leading-none"
          onClick={() => zoomAt(1.3, BOARD_W / 2, H / 2)}
          aria-label="Näher heran"
        >
          +
        </button>
        <button
          className="btn pointer-events-auto !px-2.5 !py-1 text-lg leading-none"
          onClick={() => zoomAt(1 / 1.3, BOARD_W / 2, H / 2)}
          aria-label="Weiter weg"
        >
          −
        </button>
        <button
          className="btn pointer-events-auto !px-2.5 !py-1 text-xs leading-none"
          onClick={() => setView({ k: 1, tx: 0, ty: 0 })}
          aria-label="Ganzer Plan"
        >
          ⤢
        </button>
      </div>
    </div>
  )
}

const Ship = memo(function Ship({
  player,
  x,
  y,
  heading,
  active,
  nudge,
  laden,
}: {
  player: PlayerState
  x: number
  y: number
  heading: number
  active: boolean
  nudge: number
  laden: number
}) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!.ink
  const deg = (heading * 180) / Math.PI
  const flip = Math.abs(deg) > 90 ? -1 : 1
  return (
    <g
      transform={`translate(${x} ${y - 4 + nudge}) scale(${flip} 1)`}
      style={{ transition: 'transform 260ms ease-out' }}
    >
      {active && <circle cx={0} cy={3} r={11} fill="#fff8e0" opacity={0.55} />}
      <g transform="translate(-8 -6) scale(0.5)">
        <path d="M2 22h30l-5 8H7z" fill={color} />
        <path d="M8 21V8h14l7 7v6z" fill={color} opacity={0.85} />
        <rect x="12" y="0" width="2.5" height="9" fill={color} />
        <rect x="19" y="2" width="2.5" height="7" fill={color} />
        {/* Deckslast: sichtbare Kisten, so viele wie geladen */}
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

function CompassRose({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.5} pointerEvents="none">
      <circle r={22} fill="none" stroke="#2a5f6b" strokeWidth={0.8} />
      <circle r={15} fill="none" stroke="#2a5f6b" strokeWidth={0.4} />
      <path d="M0 -21 L4 0 L0 21 L-4 0 Z" fill="#2a5f6b" opacity={0.75} />
      <path d="M-21 0 L0 -3.5 L21 0 L0 3.5 Z" fill="#2a5f6b" opacity={0.4} />
      <text
        y={-25}
        textAnchor="middle"
        fontSize={8}
        fill="#1d4b55"
        fontFamily="var(--font-display)"
      >
        N
      </text>
    </g>
  )
}

function Cartouche({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <text
        fontFamily="var(--font-display)"
        fontSize={26}
        fill="#1d3f4a"
        opacity={0.55}
        fontStyle="italic"
      >
        Von Kontinent
      </text>
      <text
        y={26}
        fontFamily="var(--font-display)"
        fontSize={26}
        fill="#1d3f4a"
        opacity={0.55}
        fontStyle="italic"
      >
        zu Kontinent
      </text>
      <line x1={0} y1={36} x2={150} y2={36} stroke="#1d3f4a" strokeWidth={0.8} opacity={0.4} />
    </g>
  )
}
