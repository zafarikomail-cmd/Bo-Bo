import { rng } from '../utils/mathUtils'
import { TREE_COUNT } from '../config/GameConfig'
import { SPAWN, BILLBOARD_POS, DESK_POS } from '../config/Constants'
import { shoreR, grassR, lagoonR } from './WorldConfig'

/* ---------- forest (same every time) ---------- */
const TREE_FILES = ['environment/tree1.glb', 'environment/tree2.glb', 'environment/tree3.glb']

// palms placed by hand so they frame the spawn area on both sides
const FRAME_TREES = [
  { file: 'environment/tree1.glb', x: 3.9, z: 47.5, scale: 1.5, rot: 0.6 },
  { file: 'environment/tree3.glb', x: 7.5, z: 52, scale: 1.3, rot: 2.1 },
  { file: 'environment/tree2.glb', x: -8.5, z: 47.5, scale: 1.6, rot: 4.0 },
  { file: 'environment/tree1.glb', x: -5.6, z: 41.5, scale: 0.9, rot: 1.0 },
]

function makeForest() {
  const r = rng(11)
  const trees = []
  // keep the spawn, billboard and desk areas open
  const clear = [
    [SPAWN[0], SPAWN[1], 13],
    [BILLBOARD_POS[0], BILLBOARD_POS[2], 9],
    [DESK_POS[0], DESK_POS[2], 8],
  ]
  let tries = 0
  while (trees.length < TREE_COUNT && tries < 10000) {
    tries++
    const a = r() * Math.PI * 2
    const lo = lagoonR(a) + 8
    const hi = shoreR(a) - 4
    const d = Math.sqrt(lo * lo + r() * (hi * hi - lo * lo))
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d

    // on the outer sand: only a few palms, and none on the open beach in front
    if (d > grassR(a) + 1) {
      const fromSouth = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)))
      if (fromSouth < 0.9 || r() > 0.3) continue
    }
    if (clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) continue
    if (trees.some((t) => Math.hypot(x - t.x, z - t.z) < 2.2)) continue

    const tall = r() > 0.4
    const scale = (tall ? 0.8 + r() * 0.7 : 0.3 + r() * 0.25) * 1.2
    trees.push({
      file: TREE_FILES[Math.floor(r() * TREE_FILES.length)],
      x,
      z,
      rot: r() * 6.28,
      scale,
      rad: 0.25 + 0.25 * scale,
    })
  }
  FRAME_TREES.forEach((t) => trees.push({ ...t, rad: 0.25 + 0.25 * t.scale }))
  return trees
}

export const FOREST = makeForest()
