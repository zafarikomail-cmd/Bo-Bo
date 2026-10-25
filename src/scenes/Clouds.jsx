import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { rng } from '../utils/mathUtils'

/* ---------- soft white clouds (made on the fly, no files needed) ---------- */
function makeCloudTex() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  const r = rng(3)
  for (let i = 0; i < 28; i++) {
    const x = 70 + r() * 370
    const rad = 35 + r() * 55
    const y = 150 - Math.sin(((x - 70) / 370) * Math.PI) * 40 + (r() - 0.5) * 30
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, 'rgba(255,255,255,0.65)')
    grad.addColorStop(0.6, 'rgba(255,255,255,0.3)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, y, rad, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function Clouds() {
  const group = useRef()
  const tex = useMemo(() => makeCloudTex(), [])
  const items = useMemo(() => {
    const r = rng(21)
    return Array.from({ length: 16 }, () => {
      const a = r() * Math.PI * 2
      const d = 900 + r() * 500
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: 120 + r() * 280, w: 380 + r() * 420 }
    })
  }, [])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.003
  })

  return (
    <group ref={group}>
      {items.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.w, c.w * 0.4, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} fog={false} opacity={0.92} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}
