import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { FIRST_PERSON_RIGS } from '../config/CharacterConfig'
import { modelUrl } from '../utils/assetUtils'
import { Safe } from '../components/Safe'

const VIEW_WIDTHS = {
  pistol: 3.4,
  akm: 2,
}
const VIEW_OFFSETS = {
  pistol: [-0.1, -0.8, -1.5],
  akm: [0.6, -0.8, -1.5],
}

function playAnimation(actions, activeAction, name, loop) {
  const action = name && actions[name]
  if (!action) return
  action.reset()
  action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity)
  action.clampWhenFinished = false
  action.fadeIn(0.12).play()
  if (activeAction.current && activeAction.current !== name) {
    actions[activeAction.current]?.fadeOut(0.12)
  }
  activeAction.current = name
}

function Rig({ weapon, actionSignal }) {
  const { camera, scene: rootScene } = useThree()
  const root = useRef()
  const content = useRef()
  const activeAction = useRef(null)
  const lastSignal = useRef(0)
  const cameraPosition = useMemo(() => new THREE.Vector3(), [])
  const cameraQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const worldOffset = useMemo(() => new THREE.Vector3(), [])
  const viewOffset = useMemo(() => new THREE.Vector3(...VIEW_OFFSETS[weapon]), [weapon])
  const viewRotation = useMemo(
    () => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
    []
  )
  const { scene, animations } = useGLTF(modelUrl(FIRST_PERSON_RIGS[weapon]))
  const model = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const { actions, names } = useAnimations(animations, root)
  const idleName = names.find((name) => /idle/i.test(name))
  const shootName = names.find((name) => /shoot|fire/i.test(name))
  const reloadName = names.find((name) => /reload/i.test(name))

  useEffect(() => {
    const group = root.current
    if (!group) return
    rootScene.add(group)
    return () => rootScene.remove(group)
  }, [rootScene])

  useFrame(() => {
    const group = root.current
    if (!group) return
    camera.updateMatrixWorld(true)
    camera.getWorldPosition(cameraPosition)
    camera.getWorldQuaternion(cameraQuaternion)
    worldOffset.copy(viewOffset).applyQuaternion(cameraQuaternion)
    group.position.copy(cameraPosition).add(worldOffset)
    group.quaternion.copy(cameraQuaternion).multiply(viewRotation)
  })

  useEffect(() => {
    const modelGroup = content.current
    if (!modelGroup) return
    model.traverse((object) => {
      if (object.isMesh) object.frustumCulled = false
    })
    const parent = modelGroup.parent
    // Measure in rig-local space, independent of the camera-following parent transform.
    parent?.remove(modelGroup)
    modelGroup.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(modelGroup)
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const scale = VIEW_WIDTHS[weapon] / Math.max(size.x, size.y, size.z, 0.001)
    parent?.add(modelGroup)
    modelGroup.scale.setScalar(scale)
    modelGroup.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
    activeAction.current = null
  }, [model, weapon])

  const play = useCallback(
    (name, loop) => playAnimation(actions, activeAction, name, loop),
    [actions]
  )

  useEffect(() => {
    if (idleName) play(idleName, THREE.LoopRepeat)
  }, [idleName, play])

  useFrame(() => {
    if (actionSignal.current.id !== lastSignal.current) {
      lastSignal.current = actionSignal.current.id
      const name = actionSignal.current.type === 'reload' ? reloadName : shootName
      play(name, THREE.LoopOnce)
    }
    const action = activeAction.current && actions[activeAction.current]
    if (activeAction.current !== idleName && (!action || !action.isRunning())) {
      if (idleName) play(idleName, THREE.LoopRepeat)
    }
  })

  return (
    <group ref={root}>
      <group ref={content}>
        <primitive object={model} />
      </group>
    </group>
  )
}

export function FirstPersonWeapon({ weapon, actionSignal, onError }) {
  return (
    <Safe
      fallback={null}
      onError={() => {
        const file = FIRST_PERSON_RIGS[weapon]
        console.error(`Could not load first-person weapon rig: ${file}`)
        onError?.(file)
      }}
    >
      <Suspense fallback={null}>
        <Rig key={weapon} weapon={weapon} actionSignal={actionSignal} />
      </Suspense>
    </Safe>
  )
}
