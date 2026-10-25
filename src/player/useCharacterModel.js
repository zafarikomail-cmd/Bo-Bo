import { useMemo } from 'react'
import * as THREE from 'three'
import { useFBX, useGLTF } from '@react-three/drei'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import { isFbx, modelUrl } from '../utils/assetUtils'
import { ANIM_FILES, CHARACTER_HEIGHT } from '../config/CharacterConfig'

// Mixamo animations come as separate .fbx files. This renames their bones so they fit the
// character, and removes the "walking away from the start point" movement (the game moves the body).
function prepareClip(source, name, root) {
  const bones = {}
  root.traverse((o) => {
    if (o.isBone) bones[o.name.replace(/^mixamorig\d*/, '')] = o.name
  })
  const tracks = []
  source.tracks.forEach((tr) => {
    const dot = tr.name.lastIndexOf('.')
    if (dot < 0) return
    const key = tr.name.slice(0, dot).replace(/^mixamorig\d*/, '')
    const prop = tr.name.slice(dot)
    const target = bones[key]
    if (!target) return // this bone does not exist on the character
    const t = tr.clone()
    t.name = target + prop
    if (key === 'Hips' && prop === '.position') {
      const v = t.values
      for (let i = 0; i < v.length; i += 3) {
        v[i] = v[0]
        v[i + 2] = v[2]
      }
    }
    tracks.push(t)
  })
  if (tracks.length === 0) console.warn('Animation', name, 'does not fit this character (no matching bones)')
  return new THREE.AnimationClip(name, source.duration, tracks)
}

// Loads a character: an .fbx (Mixamo) gets the idle / walk / run files, a .gltf uses its own animations.
// The file never changes while a component is alive, so the hooks always run in the same order.
export function useCharacterModel(file) {
  /* eslint-disable react-hooks/rules-of-hooks */
  if (isFbx(file)) {
    const raw = useFBX(modelUrl(file))
    const idleFbx = useFBX(modelUrl(ANIM_FILES.idle))
    const walkFbx = useFBX(modelUrl(ANIM_FILES.walk))
    const runFbx = useFBX(modelUrl(ANIM_FILES.run))
    const crouchWalkFbx = useFBX(modelUrl(ANIM_FILES.crouchWalk))
    const crouchedWalkFbx = useFBX(modelUrl(ANIM_FILES.crouchedWalk))
    const crouchIdleFbx = useFBX(modelUrl(ANIM_FILES.crouchIdle))
    const crouchEnterFbx = useFBX(modelUrl(ANIM_FILES.crouchEnter))
    const crouchExitFbx = useFBX(modelUrl(ANIM_FILES.crouchExit))
    return useMemo(() => {
      const object = SkeletonUtils.clone(raw)
      object.updateMatrixWorld(true)
      // resize to a normal human height, whatever units the file uses
      const box = new THREE.Box3().setFromObject(object)
      const h = box.max.y - box.min.y
      const scale = Number.isFinite(h) && h > 0.001 ? CHARACTER_HEIGHT / h : 0.01
      const clips = [
        [idleFbx, 'idle'],
        [walkFbx, 'walk'],
        [runFbx, 'run'],
        [crouchWalkFbx, 'crouchWalk'],
        [crouchedWalkFbx, 'crouchedWalk'],
        [crouchIdleFbx, 'crouchIdle'],
        [crouchEnterFbx, 'crouchEnter'],
        [crouchExitFbx, 'crouchExit'],
      ]
        .filter(([f]) => f.animations && f.animations[0])
        .map(([f, name]) => prepareClip(f.animations[0], name, object))
      console.log(file, '-> height', h, 'scale', scale, 'clips', clips.map((c) => c.name + ':' + c.tracks.length))
      return { object, scale, clips, fbx: true }
    }, [
      raw,
      idleFbx,
      walkFbx,
      runFbx,
      crouchWalkFbx,
      crouchedWalkFbx,
      crouchIdleFbx,
      crouchEnterFbx,
      crouchExitFbx,
      file,
    ])
  }
  const { scene, animations } = useGLTF(modelUrl(file))
  return useMemo(
    () => ({ object: SkeletonUtils.clone(scene), scale: 1, clips: animations, fbx: false }),
    [scene, animations]
  )
}
