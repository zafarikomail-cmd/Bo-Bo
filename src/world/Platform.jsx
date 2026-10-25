import { useMemo } from 'react'
import * as THREE from 'three'
import { rng } from '../utils/mathUtils'
import { makeShadowTex } from '../utils/textures'
import { SPAWN, PLATFORM_R, PLATFORM_H } from '../config/Constants'

/* ---------- circular wooden stage ---------- */
function makeWoodTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 1024
  const g = c.getContext('2d')
  const r = rng(5)
  const planks = 9
  const w = 1024 / planks
  for (let i = 0; i < planks; i++) {
    const v = Math.floor(r() * 26) - 13
    g.fillStyle = `rgb(${176 + v}, ${124 + Math.floor(v * 0.8)}, ${76 + Math.floor(v * 0.6)})`
    g.fillRect(i * w, 0, w, 1024)
    // grain
    for (let k = 0; k < 42; k++) {
      const x = i * w + r() * w
      g.strokeStyle = `rgba(90, 55, 28, ${0.1 + r() * 0.18})`
      g.lineWidth = 1 + r() * 2
      g.beginPath()
      g.moveTo(x, 0)
      g.bezierCurveTo(x + (r() - 0.5) * 14, 300, x + (r() - 0.5) * 14, 700, x + (r() - 0.5) * 8, 1024)
      g.stroke()
    }
    // a joint or two across the plank
    for (let j = 0; j < 2; j++) {
      g.fillStyle = 'rgba(45, 25, 10, 0.55)'
      g.fillRect(i * w, r() * 1000, w, 3)
    }
    // dark gap between planks
    g.fillStyle = 'rgba(35, 18, 8, 0.85)'
    g.fillRect(i * w - 2, 0, 4, 1024)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function Platform() {
  const wood = useMemo(() => makeWoodTex(), [])
  const shadow = useMemo(() => makeShadowTex(), [])
  return (
    <group position={[SPAWN[0], 0, SPAWN[1]]}>
      {/* soft contact shadow on the sand */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} renderOrder={6}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} opacity={0.8} />
      </mesh>
      {/* lower step */}
      <mesh position-y={0.075}>
        <cylinderGeometry args={[3.2, 3.25, 0.15, 64]} />
        <meshStandardMaterial attach="material-0" color="#6f4626" roughness={0.9} />
        <meshStandardMaterial attach="material-1" map={wood} roughness={0.85} />
        <meshStandardMaterial attach="material-2" color="#4a2e18" />
      </mesh>
      {/* upper stage */}
      <mesh position-y={0.225}>
        <cylinderGeometry args={[PLATFORM_R, PLATFORM_R + 0.05, 0.15, 64]} />
        <meshStandardMaterial attach="material-0" color="#7a4e2a" roughness={0.9} />
        <meshStandardMaterial attach="material-1" map={wood} roughness={0.8} />
        <meshStandardMaterial attach="material-2" color="#4a2e18" />
      </mesh>
      {/* rim */}
      <mesh rotation-x={Math.PI / 2} position-y={PLATFORM_H}>
        <torusGeometry args={[PLATFORM_R, 0.05, 8, 64]} />
        <meshStandardMaterial color="#5e3b1f" roughness={0.9} />
      </mesh>
    </group>
  )
}
