import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameState, PlayerState } from '@engine/state'
import type { EngineContext } from '@engine/context'
import type { Port } from '@engine/types'
import { isPort } from '@engine/mapbuild'
import { project } from '@engine/geo'
import { flagship, voyageProgress } from '@engine/state'
import land from '@content/geo/land.json'
import { PLAYER_COLORS } from '@app/store'

const BOARD_W = 1200
const MIN_K = 0.8
const MAX_K = 8
/**
 * How far past the top and bottom edges the camera may be pushed, as a share
 * of the visible height. Enough to lift a polar harbour clear of the Kopfzeile
 * or out from under a peeking sheet; not so much that the plan can be flicked
 * off the screen entirely.
 */
const EDGE_ROOM = 0.3
/** Below this the sea pips crowd together; above it they read as steps. */
const PIP_ZOOM = 1.15
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
  /**
   * Whose course is drawn in full and animated. Every other visible voyage is
   * still drawn, faintly, in the colour of the house sailing it.
   */
  readonly coursePlayerId?: string | null
  /**
   * Bumping this recentres the plan on `focusNode`. The turn changing is the
   * usual reason: you should never have to hunt for your own ship.
   */
  readonly focusNonce?: number
  /**
   * A single harbour the player has asked to look at, from the Wohin? list.
   * Drawn apart from the green hints, and worth going to find.
   */
  readonly markedPort?: string | null
  /** Bumping this glides the plan to `markedPort`. */
  readonly markNonce?: number
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
  coursePlayerId = null,
  focusNonce = 0,
  markedPort = null,
  markNonce = 0,
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

  // --- the camera ----------------------------------------------------------
  //
  // The plan is shown through a viewBox computed from the container's own
  // shape, so it always *covers* the screen. A fixed viewBox would be letter-
  // boxed: on a tall telephone a 1200x816 board fits to the width and leaves
  // dead bands above and below.

  const hostRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => setSize({ w: host.clientWidth || 1, h: host.clientHeight || 1 })
    measure()

    // ResizeObserver is not everywhere — older browsers and jsdom lack it —
    // and a plain resize listener is a perfectly good fallback.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      window.addEventListener('orientationchange', measure)
      return () => {
        window.removeEventListener('resize', measure)
        window.removeEventListener('orientationchange', measure)
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  /** Pixels per board unit at which the plan just fills the container. */
  const coverScale = Math.max(size.w / BOARD_W, size.h / H) || 1

  const [cam, setCam] = useState({ k: 1, cx: BOARD_W / 2, cy: H / 2 })
  const camRef = useRef(cam)
  camRef.current = cam
  const animation = useRef(0)

  const clampCam = useCallback(
    (next: { k: number; cx: number; cy: number }) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, next.k))
      const scale = coverScale * k
      const vw = size.w / scale
      const vh = size.h / scale

      /*
       * The plan is not the only thing on the screen. The Kopfzeile sits over
       * the top of it and a sheet or the action bar over the bottom, so a
       * camera clamped exactly to the board can only ever show Vancouver or
       * Kapstadt *underneath* that furniture — you can see the harbour but
       * never get a clean tap at it. Letting the window run past the edge by
       * a slice of its own height gives those rows somewhere to go.
       *
       * Vertical only: the top and bottom are where the chrome is, and
       * overscrolling sideways would just walk the plan off into blank paper
       * for no gain.
       */
      const padY = vh * EDGE_ROOM

      const cx =
        vw >= BOARD_W ? BOARD_W / 2 : Math.min(BOARD_W - vw / 2, Math.max(vw / 2, next.cx))
      const cy =
        vh >= H
          ? Math.min(H / 2 + padY, Math.max(H / 2 - padY, next.cy))
          : Math.min(H - vh / 2 + padY, Math.max(vh / 2 - padY, next.cy))
      return { k, cx, cy }
    },
    [coverScale, size.w, size.h, H],
  )

  const scale = coverScale * cam.k
  const viewW = (size.w || BOARD_W) / scale
  const viewH = (size.h || H) / scale
  const viewX = cam.cx - viewW / 2
  const viewY = cam.cy - viewH / 2

  /** Client pixels to board units. */
  const toBoard = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return { x: camRef.current.cx, y: camRef.current.cy }
      const s = coverScale * camRef.current.k
      const w = rect.width / s
      const h = rect.height / s
      return {
        x: camRef.current.cx - w / 2 + (clientX - rect.left) / s,
        y: camRef.current.cy - h / 2 + (clientY - rect.top) / s,
      }
    },
    [coverScale],
  )

  const stopAnimation = () => {
    if (animation.current) cancelAnimationFrame(animation.current)
    animation.current = 0
  }

  /** Zoom while holding one board point still under the finger. */
  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      stopAnimation()
      const rect = svgRef.current?.getBoundingClientRect()
      const anchor = toBoard(clientX, clientY)
      setCam((c) => {
        const k = Math.min(MAX_K, Math.max(MIN_K, c.k * factor))
        if (!rect) return clampCam({ ...c, k })
        const s = coverScale * k
        const w = rect.width / s
        const h = rect.height / s
        return clampCam({
          k,
          cx: anchor.x - (clientX - rect.left) / s + w / 2,
          cy: anchor.y - (clientY - rect.top) / s + h / 2,
        })
      })
    },
    [clampCam, coverScale, toBoard],
  )

  /**
   * Glide the camera to a node.
   *
   * `lift` pushes the camera centre below the node so the node itself rides
   * higher on screen — which is what you want when the lower part of the
   * screen is about to be a sheet.
   */
  const centreOn = useCallback(
    (nodeId: string | null | undefined, zoom?: number, lift = 0) => {
      const p = at(nodeId)
      if (!p) return
      stopAnimation()
      const from = { ...camRef.current }
      const k = zoom ?? Math.max(camRef.current.k, 2.6)
      const to = clampCam({ k, cx: p.x, cy: p.y + (lift * (size.h || H)) / (coverScale * k) })
      const started = performance.now()
      const step = (t: number) => {
        const e = Math.min(1, (t - started) / 480)
        const ease = 1 - (1 - e) ** 3
        setCam({
          k: from.k + (to.k - from.k) * ease,
          cx: from.cx + (to.cx - from.cx) * ease,
          cy: from.cy + (to.cy - from.cy) * ease,
        })
        if (e < 1) animation.current = requestAnimationFrame(step)
      }
      animation.current = requestAnimationFrame(step)
    },
    [at, clampCam, coverScale, size.h, H],
  )

  useEffect(() => stopAnimation, [])

  /** Live pointers on the surface. One pans, two pinch. */
  const pointers = useRef(new Map<number, Point>())
  const panFrom = useRef<{ client: Point; cx: number; cy: number } | null>(null)
  const pinchFrom = useRef<{ dist: number; k: number } | null>(null)
  const moved = useRef(false)

  // At the start of a turn, go and find the ship rather than making the
  // player hunt for it.
  useEffect(() => {
    if (!focusNode) return
    centreOn(focusNode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce, size.w, size.h])

  // Asked to look at a harbour: go there, and leave it above the sheet.
  useEffect(() => {
    if (!markNonce || !markedPort) return
    centreOn(markedPort, 2.2, 0.16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markNonce])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    stopAnimation()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false

    if (pointers.current.size === 1) {
      panFrom.current = {
        client: { x: e.clientX, y: e.clientY },
        cx: camRef.current.cx,
        cy: camRef.current.cy,
      }
      pinchFrom.current = null
      return
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (a && b) {
        pinchFrom.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: camRef.current.k }
      }
      panFrom.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const start = pinchFrom.current
      if (!a || !b || !start) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      moved.current = true
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const wanted = Math.min(MAX_K, Math.max(MIN_K, start.k * (dist / start.dist)))
      zoomAt(wanted / camRef.current.k, mid.x, mid.y)
      return
    }

    const start = panFrom.current
    if (!start) return
    const dxPx = e.clientX - start.client.x
    const dyPx = e.clientY - start.client.y
    if (Math.abs(dxPx) > 6 || Math.abs(dyPx) > 6) moved.current = true
    const s = coverScale * camRef.current.k
    setCam((c) => clampCam({ ...c, cx: start.cx - dxPx / s, cy: start.cy - dyPx / s }))
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const wasTap = !moved.current && pointers.current.size === 1
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchFrom.current = null
    if (pointers.current.size === 0) panFrom.current = null

    const rest = [...pointers.current.values()][0]
    if (rest) {
      panFrom.current = { client: rest, cx: camRef.current.cx, cy: camRef.current.cy }
    }

    if (wasTap) handleTap(e.clientX, e.clientY)
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY)
  }

  /**
   * Taps are resolved here rather than on each dot.
   *
   * Per-element handlers cannot work while the surface holds a pointer
   * capture, and a fingertip is far wider than a three-pixel circle anyway.
   * Picking the nearest candidate within a thumb's reach is both more robust
   * and much easier to hit.
   */
  const handleTap = (clientX: number, clientY: number) => {
    const point = toBoard(clientX, clientY)
    const s = coverScale * camRef.current.k
    const reach = 26 / s // about a fingertip, whatever the zoom

    const candidates: { id: string; x: number; y: number }[] = []
    if (legalTargets.length > 0) {
      for (const id of legalTargets) {
        const p = positions.get(id)
        if (p) candidates.push({ id, ...p })
      }
    } else if (onPickPort) {
      for (const { port, p } of ports) candidates.push({ id: port.id, ...p })
    }
    if (candidates.length === 0) return

    let best: { id: string; d: number } | null = null
    for (const c of candidates) {
      const d = Math.hypot(c.x - point.x, c.y - point.y)
      if (!best || d < best.d) best = { id: c.id, d }
    }
    if (!best || best.d > reach) return

    if (legalTargets.length > 0) onPick(best.id)
    else onPickPort?.(best.id)
  }

  // --- derived, cheap ------------------------------------------------------

  const targetSet = useMemo(() => new Set(legalTargets), [legalTargets])
  const hintSet = useMemo(() => new Set(highlightPorts), [highlightPorts])
  const occupiedPorts = useMemo(
    () => new Set(state.players.map((p) => flagship(p).nodeId)),
    [state.players],
  )

  // Every vessel of every house, not just the flagships.
  const ships = state.players
    .flatMap((p, playerIndex) =>
      p.fleet.map((vehicle, vehicleIndex) => ({ p, vehicle, playerIndex, vehicleIndex })),
    )
    .map(({ p, vehicle, playerIndex, vehicleIndex }) => {
      // A rival's ship you cannot see is simply not drawn.
      if (vehicle.hidden) return null
      const here = at(vehicle.nodeId)
      if (!here) return null
      const voyage = vehicle.voyage ?? null
      const next = voyage ? at(voyage.route[0]) : null

      let pos = here
      if (voyage && next) {
        const t = voyageProgress(voyage, now || voyage.legStartedAt)
        pos = { x: here.x + (next.x - here.x) * t, y: here.y + (next.y - here.y) * t }
      }
      const from = voyage && next ? here : at(vehicle.cameFrom)
      return {
        player: p,
        vehicle,
        pos,
        from,
        sailing: Boolean(voyage),
        nudge: vehicleIndex * 5 + playerIndex * 4 - 2,
      }
    })

  /** Centre of the surface in client pixels, for the zoom buttons. */
  const midX = () => {
    const r = svgRef.current?.getBoundingClientRect()
    return r ? r.left + r.width / 2 : 0
  }
  const midY = () => {
    const r = svgRef.current?.getBoundingClientRect()
    return r ? r.top + r.height / 2 : 0
  }

  /**
   * Every course currently being sailed, in the colour of the house sailing it.
   *
   * Read off the state rather than handed in, which is what lets a house with
   * two ships see both, and rivals' courses show up as well — under Sicht
   * realistisch the projection has already set `voyage` to null on anything
   * the viewer has no business seeing, so there is nothing here to leak.
   *
   * The player's own course is drawn in full and the dashes march along it
   * towards the destination; the others are faint and still, so the chart says
   * where everyone is heading without three ships shouting at once.
   */
  const courses = useMemo(() => {
    const out: { key: string; d: string; ink: string; own: boolean; end: Point | null }[] = []
    for (const player of state.players) {
      const ink = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]!.ink
      for (const vehicle of player.fleet) {
        if (vehicle.hidden || !vehicle.voyage) continue
        let d = ''
        let last: Point | null = null
        for (const id of [vehicle.nodeId, ...vehicle.voyage.route]) {
          const p = positions.get(id)
          if (!p) continue
          d += `${last ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
          last = p
        }
        if (!d.includes('L')) continue
        out.push({ key: vehicle.id, d, ink, own: player.id === coursePlayerId, end: last })
      }
    }
    // The player's own course last, so it lies over the others.
    return out.sort((a, b) => Number(a.own) - Number(b.own))
  }, [state.players, positions, coursePlayerId])

  return (
    <div ref={hostRef} className="board-shell relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full touch-none select-none"
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

        <g>
          <SeaAndLand H={H} landPaths={landPaths} lanePath={lanePath} xy={xy} />

          {scale >= PIP_ZOOM && (
            <g fill="var(--color-route)">
              {seaDots.map((d) => (
                <circle
                  key={d.id}
                  cx={d.p.x}
                  cy={d.p.y}
                  // Keep a steady size on screen however far one is zoomed in.
                  r={Math.min(3.4, Math.max(1.8, 2.6 / scale))}
                  stroke="#ffffff"
                  strokeWidth={Math.min(0.9, 0.6 / scale)}
                  opacity={0.95}
                />
              ))}
            </g>
          )}

          {courses.map((c) => (
            <g key={`c-${c.key}`} pointerEvents="none">
              {/* Ein weicher Streifen darunter, damit die Linie über Land
                  und über See gleich gut lesbar bleibt. */}
              <path
                d={c.d}
                fill="none"
                stroke={c.ink}
                strokeWidth={c.own ? 5 : 3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={c.own ? 0.2 : 0.12}
              />
              <path
                d={c.d}
                fill="none"
                stroke={c.ink}
                strokeWidth={c.own ? 2 : 1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 5"
                opacity={c.own ? 0.95 : 0.45}
                style={
                  c.own ? { animation: 'course-ants 1.1s linear infinite' } : undefined
                }
              />
              {c.own && c.end && (
                <>
                  <circle cx={c.end.x} cy={c.end.y} r={7} fill={c.ink} opacity={0.15} />
                  <circle
                    cx={c.end.x}
                    cy={c.end.y}
                    r={5}
                    fill="none"
                    stroke={c.ink}
                    strokeWidth={1.6}
                    opacity={0.9}
                  />
                </>
              )}
            </g>
          ))}

          {[...targetSet].map((id) => {
            const p = positions.get(id)
            if (!p) return null
            return (
              <g key={`t-${id}`} className="cursor-pointer">
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
            const marked = port.id === markedPort
            const labelled =
              scale >= LABEL_ZOOM ||
              occupiedPorts.has(port.id) ||
              targetSet.has(port.id) ||
              hintSet.has(port.id) ||
              marked ||
              port.id === focusNode
            return (
              <g key={port.id} className={onPickPort ? 'cursor-pointer' : undefined}>
                {/* The one the player asked about: gold, and breathing, so it
                    is findable on a plan with a hundred harbours on it. */}
                {marked && (
                  <>
                    <circle cx={p.x} cy={p.y} r={11} fill="#a9863f" opacity={0.22} />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={8}
                      fill="none"
                      stroke="#a9863f"
                      strokeWidth={2.2}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={8}
                      fill="none"
                      stroke="#a9863f"
                      strokeWidth={1.4}
                      style={{ animation: 'pulse-ring 1.8s ease-out infinite' }}
                    />
                  </>
                )}
                {hintSet.has(port.id) && !marked && (
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
                key={s.vehicle.id}
                player={s.player}
                x={s.pos.x}
                y={s.pos.y}
                heading={s.from ? Math.atan2(s.pos.y - s.from.y, s.pos.x - s.from.x) : 0}
                active={s.vehicle.id === flagship(s.player).id && s.vehicle.nodeId === focusNode}
                nudge={s.nudge}
                laden={s.vehicle.cargo.length}
                sailing={s.sailing}
                believed={s.vehicle.unseen === true}
              />
            ) : null,
          )}

          <CompassRose x={BOARD_W * 0.06} y={H * 0.82} />
        </g>

        <rect
          x={viewX}
          y={viewY}
          width={viewW}
          height={viewH}
          fill="url(#vignette)"
          pointerEvents="none"
        />
      </svg>

      {/*
       * Steuerung des Plans: eine Leiste wie oben, aus demselben Grund.
       *
       * Sie stand in der unteren rechten Ecke, wo ein aufgezogenes Blatt sie
       * verdeckt — auch der Blick, den »Hafen auf der Karte wählen« öffnet,
       * lässt das Blatt auf halber Höhe stehen. Auf halber Höhe am Rand steht
       * sie über allem, was von unten kommt, und unter der Kopfleiste.
       *
       * »Ganzer Plan« ist fort: zweimal Minus tut dasselbe, und der Knopf war
       * der einzige, der einen dorthin warf, wo das eigene Schiff nicht ist.
       */}
      <div className="paper pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 flex-col divide-y divide-black/15 overflow-hidden rounded-lg shadow-lg">
        <button
          className="pointer-events-auto px-2.5 py-1.5 text-lg leading-none transition-colors hover:bg-black/5"
          onClick={() => zoomAt(1.4, midX(), midY())}
          aria-label="Näher heran"
        >
          +
        </button>
        <button
          className="pointer-events-auto px-2.5 py-1.5 text-lg leading-none transition-colors hover:bg-black/5"
          onClick={() => zoomAt(1 / 1.4, midX(), midY())}
          aria-label="Weiter weg"
        >
          −
        </button>
        <button
          className="pointer-events-auto px-2.5 py-1.5 text-base leading-none transition-colors hover:bg-black/5"
          onClick={() => centreOn(focusNode, 3)}
          aria-label="Zum eigenen Schiff"
          title="Zum eigenen Schiff"
        >
          ⚓
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
        strokeWidth={1.8}
        strokeDasharray="0.1 3.2"
        opacity={0.85}
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
  believed = false,
}: {
  player: PlayerState
  x: number
  y: number
  heading: number
  active: boolean
  nudge: number
  laden: number
  sailing: boolean
  /** Sicht "realistisch": drawn where she was last reported, not where she is. */
  believed?: boolean
}) {
  const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]?.ink ?? '#1b1b1b'
  const deg = (heading * 180) / Math.PI
  const flip = Math.abs(deg) > 90 ? -1 : 1
  return (
    <g
      transform={`translate(${x} ${y - 4 + nudge}) scale(${flip} 1)`}
      style={{
        transition: sailing ? 'none' : 'transform 260ms ease-out',
        opacity: believed ? 0.45 : 1,
      }}
    >
      {active && <circle cx={0} cy={3} r={11} fill="#fff8e0" opacity={0.55} />}
      {sailing && <path d="M-16 5 q6 -2 12 0 q-6 2 -12 0" fill="#ffffff" opacity={0.5} />}
      {believed && (
        <>
          {/* Last reported position: a pencilled guess, not a fix. */}
          <circle
            cx={0}
            cy={3}
            r={10}
            fill="none"
            stroke={color}
            strokeWidth={0.9}
            strokeDasharray="2 2"
            opacity={0.8}
          />
          <text x={9} y={-4} fontSize={9} fill={color} opacity={0.9}>
            ?
          </text>
        </>
      )}
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
