import { useEffect, useRef } from 'react'
import { useAnimations } from '@react-three/drei'
import { fixMaterials } from '../utils/materials'
import { useCharacterModel } from './useCharacterModel'

/* a character that just stands and idles (the receptionist) */
export function Character({ file, position, scale = 1, rotation = 0 }) {
  const group = useRef()
  const { object, scale: fit, clips } = useCharacterModel(file)
  const { actions, names } = useAnimations(clips, group)

  useEffect(() => {
    fixMaterials(object, file)
    const idle = names.find((n) => /idle/i.test(n)) || names[0]
    if (idle) actions[idle]?.reset().fadeIn(0.3).play()
  }, [object, actions, names, file])

  return (
    <group ref={group} position={position} rotation={[0, rotation, 0]} scale={scale}>
      <group scale={fit}>
        <primitive object={object} />
      </group>
    </group>
  )
}
