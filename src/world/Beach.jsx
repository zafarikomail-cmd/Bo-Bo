import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader, useThree } from '@react-three/fiber'
import { rng } from '../utils/mathUtils'
import { BASE } from '../utils/assetUtils'
import { SAND_TILE } from '../config/GameConfig'
import { Safe } from '../components/Safe'
import { GEO } from './WorldConfig'

/* ---------- realistic sand ----------
   Needs 3 files in public/textures/ (Poly Haven "coast_sand_01", CC0):
   sand_diff.jpg, sand_nor.jpg, sand_rough.jpg */
function makeBlotchTex() {
  // very large soft patches (damp / darker areas) so the tiling is not obvious
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  const r = rng(9)
  for (let i = 0; i < 38; i++) {
    const x = r() * 512
    const y = r() * 512
    const rad = 40 + r() * 110
    for (const dx of [-512, 0, 512]) {
      for (const dy of [-512, 0, 512]) {
        g.save()
        g.translate(dx, dy)
        const grad = g.createRadialGradient(x, y, 0, x, y, rad)
        grad.addColorStop(0, 'rgba(110, 80, 45, 0.32)')
        grad.addColorStop(1, 'rgba(110, 80, 45, 0)')
        g.fillStyle = grad
        g.beginPath()
        g.arc(x, y, rad, 0, Math.PI * 2)
        g.fill()
        g.restore()
      }
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / 70, 1 / 70)
  return t
}

function PlainSand() {
  return (
    <>
      <mesh geometry={GEO.wet} rotation-x={-Math.PI / 2} position-y={-0.08}>
        <meshStandardMaterial color="#e0c590" />
      </mesh>
      <mesh geometry={GEO.sand} rotation-x={-Math.PI / 2} position-y={0}>
        <meshStandardMaterial color="#f5e1b0" />
      </mesh>
    </>
  )
}

function TexturedSand() {
  const { gl } = useThree()
  const [diff, nor, rough] = useLoader(THREE.TextureLoader, [
    BASE + 'textures/sand_diff.jpg',
    BASE + 'textures/sand_nor.jpg',
    BASE + 'textures/sand_rough.jpg',
  ])
  const blotch = useMemo(() => makeBlotchTex(), [])

  useEffect(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    diff.colorSpace = THREE.SRGBColorSpace
    ;[diff, nor, rough].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(1 / SAND_TILE, 1 / SAND_TILE)
      t.anisotropy = aniso // keeps the grain sharp at flat viewing angles
      t.needsUpdate = true
    })
  }, [diff, nor, rough, gl])

  return (
    <>
      {/* wet sand at the edge (also the floor of the lagoon): same sand, darker */}
      <mesh geometry={GEO.wet} rotation-x={-Math.PI / 2} position-y={-0.08}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#b8a07c" roughness={0.8} />
      </mesh>
      {/* dry sand with a hole for the lagoon */}
      <mesh geometry={GEO.sand} rotation-x={-Math.PI / 2} position-y={0}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#ffffff" />
      </mesh>
      {/* big soft patches on top to break up the repeating pattern */}
      <mesh geometry={GEO.sand} rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={1}>
        <meshBasicMaterial map={blotch} transparent depthWrite={false} />
      </mesh>
    </>
  )
}

export function SandSurface() {
  return (
    <Suspense fallback={<PlainSand />}>
      <Safe fallback={<PlainSand />}>
        <TexturedSand />
      </Safe>
    </Suspense>
  )
}

function PlainGrass() {
  return (
    <>
      <mesh geometry={GEO.grass} rotation-x={-Math.PI / 2} position-y={0.03}>
        <meshStandardMaterial color="#6a9a45" />
      </mesh>
      <mesh geometry={GEO.grass2} rotation-x={-Math.PI / 2} position-y={0.06}>
        <meshStandardMaterial color="#4f8236" />
      </mesh>
    </>
  )
}

function TexturedGrass() {
  const { gl } = useThree()
  const [diff, nor, rough] = useLoader(THREE.TextureLoader, [
    BASE + 'textures/grass_diff.jpg',
    BASE + 'textures/grass_nor.jpg',
    BASE + 'textures/grass_rough.jpg',
  ])

  useEffect(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    diff.colorSpace = THREE.SRGBColorSpace
    ;[diff, nor, rough].forEach((texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(1 / SAND_TILE, 1 / SAND_TILE)
      texture.anisotropy = aniso
      texture.needsUpdate = true
    })
  }, [diff, nor, rough, gl])

  return (
    <>
      <mesh geometry={GEO.grass} rotation-x={-Math.PI / 2} position-y={0.03}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} />
      </mesh>
      <mesh geometry={GEO.grass2} rotation-x={-Math.PI / 2} position-y={0.06}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#c4d4b8" />
      </mesh>
    </>
  )
}

export function GrassSurface() {
  return (
    <Suspense fallback={<PlainGrass />}>
      <Safe fallback={<PlainGrass />}>
        <TexturedGrass />
      </Safe>
    </Suspense>
  )
}
