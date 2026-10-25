import { DESK_POS, DESK_RADIUS } from '../config/Constants'
import { shoreR, lagoonR } from '../world/WorldConfig'
import { FOREST } from '../world/forestData'

/* keep the player on the island, out of the lagoon */
export function keepOnIsland(p) {
  const a = Math.atan2(p.z, p.x)
  const r = Math.hypot(p.x, p.z)
  const max = shoreR(a) - 1
  const min = lagoonR(a) + 1.5
  if (r > max) {
    p.x = Math.cos(a) * max
    p.z = Math.sin(a) * max
  } else if (r < min) {
    p.x = Math.cos(a) * min
    p.z = Math.sin(a) * min
  }
}

/* trees are solid */
export function pushOutOfTrees(p) {
  for (const t of FOREST) {
    const dx = p.x - t.x
    const dz = p.z - t.z
    const d = Math.hypot(dx, dz)
    const m = t.rad + 0.4
    if (d < m && d > 0.0001) {
      p.x = t.x + (dx / d) * m
      p.z = t.z + (dz / d) * m
    }
  }
}

/* can't walk through the reception desk */
export function pushOutOfDesk(p) {
  const ox = p.x - DESK_POS[0]
  const oz = p.z - DESK_POS[2]
  const d = Math.hypot(ox, oz)
  if (d < DESK_RADIUS && d > 0.001) {
    p.x = DESK_POS[0] + (ox / d) * DESK_RADIUS
    p.z = DESK_POS[2] + (oz / d) * DESK_RADIUS
  }
}
