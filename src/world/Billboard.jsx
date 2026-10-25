import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { PHOTOS } from '../config/GameConfig'
import { BILLBOARD_POS } from '../config/Constants'

function PhotoFrame({ src, position }) {
  const [tex, setTex] = useState(null)

  useEffect(() => {
    let alive = true
    new THREE.TextureLoader().load(
      src,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        if (alive) setTex(t)
      },
      undefined,
      (error) => console.error(`Could not load billboard image: ${src}`, error)
    )
    return () => {
      alive = false
    }
  }, [src])

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[2.6, 3.2]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh key={tex ? 'loaded' : 'empty'}>
        <planeGeometry args={[2.4, 3]} />
        <meshBasicMaterial map={tex} color={tex ? '#ffffff' : '#b9b9b9'} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Billboard() {
  return (
    <group position={BILLBOARD_POS} rotation={[0, 2.0, 0]}>
      {[-3.6, 3.6].map((x) => (
        <mesh key={x} position={[x, 2, -0.25]}>
          <boxGeometry args={[0.25, 4, 0.25]} />
          <meshStandardMaterial color="#5b4636" />
        </mesh>
      ))}
      <mesh position={[0, 3.6, -0.1]}>
        <boxGeometry args={[8.8, 4, 0.2]} />
        <meshStandardMaterial color="#f4e3c1" />
      </mesh>
      <mesh position={[0, 3.6, 0]}>
        <boxGeometry args={[8.4, 3.6, 0.2]} />
        <meshStandardMaterial color="#2b2f3a" />
      </mesh>
      <Text
        position={[0, 5.9, 0]}
        fontSize={0.5}
        color="#ffffff"
        outlineWidth={0.04}
        outlineColor="#2b2f3a"
        anchorX="center"
        anchorY="middle"
      >
        MEET AHMAD
      </Text>
      {PHOTOS.map((src, i) => (
        <PhotoFrame key={src} src={src} position={[(i - 1) * 2.8, 3.6, 0.12]} />
      ))}
    </group>
  )
}
