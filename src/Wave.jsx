import { Component, Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { assetUrl } from './assetUrl.js'

/* ============ EDIT THESE ============ */
const WAVE_FILE = assetUrl('/models/water-wave.glb')
const WAVE_WIDTH = 30 // width of ONE wave piece (world units)
const WAVE_COPIES = 5 // how many pieces side by side along the shore
const WAVE_Z = -4 // 0 = water's edge, more negative = further out in the lake
const WAVE_Y = -0.05 // raise it a little if the wave sinks into the water
const WAVE_ROTATION_Y = 0 // try Math.PI if the wave faces the wrong way
const WAVE_COLOR = null // for example '#2aa9c9' to recolor, or null to keep the original
const WAVE_OPACITY = 0.9
const WAVE_BOB = true // gentle up-and-down motion (only if the file has no animation)
/* ==================================== */

function WavePiece({ x }) {
  const group = useRef()
  const { scene, animations } = useGLTF(WAVE_FILE)
  const { actions } = useAnimations(animations, group)

  const copy = useMemo(() => scene.clone(true), [scene])

  // measure the model and fit it to WAVE_WIDTH
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const s = WAVE_WIDTH / (size.x || 1)
    return {
      scale: s,
      position: [-center.x * s, -box.min.y * s, -center.z * s],
      size,
    }
  }, [scene])

  useEffect(() => {
    console.log('wave size (x, y, z):', fit.size.x, fit.size.y, fit.size.z)
    console.log('wave animations:', animations.map((a) => a.name))
    copy.traverse((o) => {
      if (!o.isMesh || !o.material) return
      const list = Array.isArray(o.material) ? o.material : [o.material]
      list.forEach((m) => {
        m.transparent = true
        m.opacity = WAVE_OPACITY
        m.side = THREE.DoubleSide
        if (m.metalness !== undefined) m.metalness = 0
        if (WAVE_COLOR && m.color) m.color.set(WAVE_COLOR)
      })
    })
    Object.values(actions).forEach((a) => a?.reset().play())
  }, [copy, actions, animations, fit])

  return (
    <group ref={group} position={[x, 0, 0]}>
      <primitive object={copy} scale={fit.scale} position={fit.position} />
    </group>
  )
}

function WaveFallback() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, WAVE_Y, WAVE_Z]}>
      <planeGeometry args={[WAVE_WIDTH * WAVE_COPIES, 1]} />
      <meshBasicMaterial color="#d8f5f2" transparent opacity={0.35} />
    </mesh>
  )
}

class WaveErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('Optional wave model failed to load; showing a simple wave fallback.', error)
  }

  render() {
    return this.state.failed ? <WaveFallback /> : this.props.children
  }
}

function WaveScene() {
  const outer = useRef()

  useFrame((state) => {
    if (!outer.current || !WAVE_BOB) return
    const t = state.clock.elapsedTime
    outer.current.position.y = WAVE_Y + Math.sin(t * 0.8) * 0.08
  })

  const spacing = WAVE_WIDTH * 0.95
  return (
    <group ref={outer} position={[0, WAVE_Y, WAVE_Z]} rotation={[0, WAVE_ROTATION_Y, 0]}>
      {Array.from({ length: WAVE_COPIES }, (_, i) => (
        <WavePiece key={i} x={(i - (WAVE_COPIES - 1) / 2) * spacing} />
      ))}
    </group>
  )
}

export default function Wave() {
  return (
    <WaveErrorBoundary>
      <Suspense fallback={<WaveFallback />}>
        <WaveScene />
      </Suspense>
    </WaveErrorBoundary>
  )
}