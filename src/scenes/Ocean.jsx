import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { extend, useFrame, useLoader } from '@react-three/fiber'
import { Water } from 'three-stdlib'
import { BASE } from '../utils/assetUtils'
import { AT, SUN } from '../config/GameConfig'
import { GEO } from '../world/WorldConfig'

extend({ Water })

/* ---------- water ---------- */
// endless ocean
export function Ocean() {
  const ref = useRef()
  const normals = useLoader(THREE.TextureLoader, BASE + 'textures/waternormals.jpg')
  const geom = useMemo(() => new THREE.PlaneGeometry(8000, 8000), [])
  const config = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping
    return {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(...SUN).normalize(),
      sunColor: 0xffffff,
      waterColor: AT.water,
      distortionScale: 3.2,
      fog: false,
    }
  }, [normals])

  useEffect(() => {
    if (ref.current) ref.current.material.uniforms.size.value = 2
  }, [])

  useFrame((_, delta) => {
    if (ref.current) ref.current.material.uniforms.time.value += delta * 0.5
  })

  return (
    <water ref={ref} args={[geom, config]} rotation-x={-Math.PI / 2} position={[0, -0.25, 0]} />
  )
}

export function FlatOcean() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.25, 0]}>
      <planeGeometry args={[8000, 8000]} />
      <meshStandardMaterial color="#0b7a96" />
    </mesh>
  )
}

// turquoise lagoon in the middle of the island
export function LagoonWater() {
  const normals = useLoader(THREE.TextureLoader, BASE + 'textures/waternormals.jpg')
  const tex = useMemo(() => {
    const t = normals.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(0.12, 0.12)
    t.needsUpdate = true
    return t
  }, [normals])

  useFrame((_, delta) => {
    tex.offset.x += delta * 0.01
    tex.offset.y += delta * 0.006
  })

  return (
    <mesh geometry={GEO.lagoon} rotation-x={-Math.PI / 2} position-y={-0.05} renderOrder={5}>
      <meshStandardMaterial
        color="#2fd9c8"
        transparent
        opacity={0.72}
        roughness={0.15}
        metalness={0.1}
        normalMap={tex}
        normalScale={[0.35, 0.35]}
        depthWrite={false}
      />
    </mesh>
  )
}

export function LagoonPlain() {
  return (
    <mesh geometry={GEO.lagoon} rotation-x={-Math.PI / 2} position-y={-0.05} renderOrder={5}>
      <meshStandardMaterial color="#2fd9c8" transparent opacity={0.72} depthWrite={false} />
    </mesh>
  )
}
