import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGLTF, Text } from '@react-three/drei'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { modelUrl } from '../utils/assetUtils'
import { fixMaterials } from '../utils/materials'
import { PLANE_FILE, PLANE_SIZE, PLANE_YAW } from '../config/GameConfig'
import { Safe } from '../components/Safe'

/* ---------- plane with banner ---------- */
// the banner trails behind the plane; x is where it starts (its edge nearest the plane)
function Banner({ x, message }) {
  return (
    <group position={[x - 3.6, 0, 0]}>
      <mesh>
        <planeGeometry args={[7.2, 1]} />
        <meshBasicMaterial color="#fff8ec" />
      </mesh>
      <Text position={[0, 0, 0.01]} fontSize={0.35} color="#333333" anchorX="center" anchorY="middle">
        {message}
      </Text>
    </group>
  )
}

// the simple built-in plane (used if Airplane.glb is missing)
function SimplePlane({ message }) {
  return (
    <>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.25, 1.2, 8, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh>
        <boxGeometry args={[0.4, 0.05, 2.4]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      <mesh position={[-0.8, 0.25, 0]}>
        <boxGeometry args={[0.3, 0.5, 0.05]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      <Banner x={-1} message={message} />
    </>
  )
}

// your Airplane.glb: resized, centered, and the banner is attached to its tail.
// The plane must fly toward +x; yaw turns the model until its nose points that way.
function GlbPlane({ message, yaw }) {
  const { scene } = useGLTF(modelUrl(PLANE_FILE))
  const fit = useMemo(() => {
    fixMaterials(scene, 'plane', null)
    const clone = SkeletonUtils.clone(scene)
    const turned = new THREE.Group()
    turned.rotation.y = yaw
    turned.add(clone)
    const holder = new THREE.Group()
    holder.add(turned)
    holder.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(holder)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const k = PLANE_SIZE / Math.max(size.x, size.z, 0.001)
    turned.remove(clone)
    return { clone, k, center, tail: (size.x * k) / 2 }
  }, [scene, yaw])

  return (
    <>
      <group scale={fit.k}>
        <group position={[-fit.center.x, -fit.center.y, -fit.center.z]}>
          <group rotation={[0, yaw, 0]}>
            <primitive object={fit.clone} />
          </group>
        </group>
      </group>
      <Banner x={-fit.tail - 0.1} message={message} />
    </>
  )
}

export function FlyingPlane({ message, onError }) {
  const ref = useRef()
  const yawRef = useRef(PLANE_YAW)
  const [yaw, setYaw] = useState(PLANE_YAW)

  // press P to turn the plane model by 90 degrees (the new angle is printed in the Console)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'KeyP') return
      yawRef.current = (yawRef.current + Math.PI / 2) % (Math.PI * 2)
      console.log('PLANE_YAW =', Math.round(yawRef.current * 100) / 100)
      setYaw(yawRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.x -= delta * 8
    if (ref.current.position.x < -150) ref.current.position.x = 150
  })

  // turned around so the banner faces you when you look at the sea
  return (
    <group ref={ref} position={[150, 11, 75]} rotation={[0, Math.PI, 0]} scale={2.4}>
      <Safe fallback={<SimplePlane message={message} />} onError={onError}>
        <Suspense fallback={<SimplePlane message={message} />}>
          <GlbPlane message={message} yaw={yaw} />
        </Suspense>
      </Safe>
    </group>
  )
}
