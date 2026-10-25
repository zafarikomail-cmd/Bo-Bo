import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { GEO } from './WorldConfig'
import { GrassSurface, SandSurface } from './Beach'

// foam line that moves in and out at the shore
function Foam() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    const s = 1.06 + Math.sin(t * 0.9) * 0.025
    m.scale.set(s, s, 1)
    m.material.opacity = 0.32 + Math.sin(t * 0.9 + 1) * 0.12
  })
  return (
    <mesh ref={ref} geometry={GEO.foam} rotation-x={-Math.PI / 2} position-y={-0.14} renderOrder={4}>
      <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

/* ---------- the island ---------- */
export function Island() {
  const shelf = { color: '#4fe3d2', transparent: true, opacity: 0.25, depthWrite: false }
  return (
    <>
      {/* shallow turquoise water around the island */}
      <mesh geometry={GEO.shelf3} rotation-x={-Math.PI / 2} position-y={-0.22} renderOrder={1}>
        <meshBasicMaterial {...shelf} />
      </mesh>
      <mesh geometry={GEO.shelf2} rotation-x={-Math.PI / 2} position-y={-0.2} renderOrder={2}>
        <meshBasicMaterial {...shelf} />
      </mesh>
      <mesh geometry={GEO.shelf1} rotation-x={-Math.PI / 2} position-y={-0.18} renderOrder={3}>
        <meshBasicMaterial {...shelf} />
      </mesh>

      <Foam />

      {/* sand: real photo-scanned textures (plain color if the files are missing) */}
      <SandSurface />
      <GrassSurface />
    </>
  )
}
