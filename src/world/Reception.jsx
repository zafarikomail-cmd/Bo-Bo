import { Suspense } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { isFbx } from '../utils/assetUtils'
import { RECEPTIONIST_FILE } from '../config/CharacterConfig'
import { ABOUT_TITLE } from '../config/GameConfig'
import { DESK_POS } from '../config/Constants'
import { Safe } from '../components/Safe'
import { Character } from '../player/Character'

export function Reception({ onError, showCharacter = false }) {
  // cartoon characters are lowered a bit into the sand so their legs are hidden
  const lower = isFbx(RECEPTIONIST_FILE) ? 0 : -0.35
  return (
    <group position={DESK_POS} rotation={[0, -2.0, 0]}>
      {/* the receptionist behind the desk (if her file fails to load, the cartoon Emma takes the seat) */}
      {showCharacter && (
        <Suspense fallback={null}>
          <Safe
            fallback={<Character file="characters/emma.gltf" position={[0, -0.35, -0.85]} />}
            onError={() => onError && onError(`Could not load ${RECEPTIONIST_FILE} (receptionist).`)}
          >
            <Character file={RECEPTIONIST_FILE} position={[0, lower, -0.85]} />
          </Safe>
        </Suspense>
      )}

      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[3.2, 1, 1.1]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      <mesh position={[0, 1.04, 0]}>
        <boxGeometry args={[3.4, 0.1, 1.3]} />
        <meshStandardMaterial color="#d9b382" />
      </mesh>
      <Text
        position={[0, 0.55, 0.56]}
        fontSize={0.28}
        color="#fff3dc"
        anchorX="center"
        anchorY="middle"
      >
        RECEPTION
      </Text>

      {/* paper she is showing */}
      <group position={[0.95, 1.7, -0.3]} rotation={[-0.1, -0.25, 0]}>
        <mesh>
          <planeGeometry args={[1, 1.3]} />
          <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
        <Text position={[0, 0.48, 0.01]} fontSize={0.14} color="#222222" anchorX="center">
          {ABOUT_TITLE}
        </Text>
        {[0.2, 0.03, -0.14, -0.31].map((y) => (
          <mesh key={y} position={[0, y, 0.01]}>
            <planeGeometry args={[0.75, 0.04]} />
            <meshBasicMaterial color="#9aa0a6" />
          </mesh>
        ))}
      </group>
    </group>
  )
}
