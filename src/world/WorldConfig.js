import * as THREE from 'three'

/* ---------- island shape (angle a -> radius) ---------- */
export const shoreR = (a) =>
  60 * (1 + 0.07 * Math.sin(3 * a + 0.6) + 0.05 * Math.sin(5 * a + 2.1) + 0.03 * Math.sin(8 * a + 0.2))
export const grassR = (a) => 0.74 * shoreR(a) * (1 + 0.05 * Math.sin(7 * a + 0.5))
export const lagoonR = (a) => 15 * (1 + 0.1 * Math.sin(2 * a + 0.3) + 0.06 * Math.sin(4 * a + 1))

export function outlinePoints(fn, scale = 1, n = 200) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = fn(a) * scale
    // shape y is -z once the mesh is laid flat
    pts.push(new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r))
  }
  return pts
}

export function blobGeometry(outer, hole) {
  const shape = new THREE.Shape(outer)
  if (hole) shape.holes.push(new THREE.Path(hole))
  return new THREE.ShapeGeometry(shape)
}

export const GEO = {
  shelf1: blobGeometry(outlinePoints(shoreR, 1.25)),
  shelf2: blobGeometry(outlinePoints(shoreR, 1.55)),
  shelf3: blobGeometry(outlinePoints(shoreR, 1.9)),
  foam: blobGeometry(outlinePoints(shoreR, 1)),
  wet: blobGeometry(outlinePoints(shoreR, 1.03)),
  sand: blobGeometry(outlinePoints(shoreR), outlinePoints(lagoonR)),
  grass: blobGeometry(outlinePoints(grassR), outlinePoints((a) => lagoonR(a) + 7)),
  grass2: blobGeometry(
    outlinePoints((a) => 0.55 * shoreR(a) * (1 + 0.06 * Math.sin(5 * a + 1.3))),
    outlinePoints((a) => lagoonR(a) + 11)
  ),
  lagoon: blobGeometry(outlinePoints(lagoonR, 1.04)),
}
