import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import { fixMaterials } from '../utils/materials'
import { makeShadowTex } from '../utils/textures'
import { MOVE, EYE_HEIGHT, CROUCH, PHYSICS } from '../config/CharacterConfig'
import { SPAWN, PLATFORM_R, PLATFORM_H, DESK_POS } from '../config/Constants'
import { keepOnIsland, pushOutOfTrees, pushOutOfDesk } from '../systems/Collision'
import { controls } from '../systems/Controls'
import { useCharacterModel } from './useCharacterModel'
import { FirstPersonWeapon } from './FirstPersonWeapon'

const clamp = THREE.MathUtils.clamp

/* the character you control
   settings: { cameraMode: 'first' | 'third', sensitivity, distance, lockMouse }
   crouch:   true while crouching
   paused:   true while the settings panel is open (no input is read) */
export function Player({ phase, file, settings, crouch, paused, onNearDesk, onReady }) {
  const group = useRef()
  const body = useRef()
  const { gl } = useThree()
  const { object, scale, clips, fbx } = useCharacterModel(file)
  const mv = fbx ? MOVE.fbx : MOVE.gltf
  const { actions, names } = useAnimations(clips, group)
  const keys = useRef({})
  const [weapon, setWeapon] = useState('pistol')
  const weaponAction = useRef({ id: 0, type: 'shoot' })
  // yaw: where the camera looks (sideways). pitch: third-person height. look: first-person up / down
  const cam = useRef({ yaw: Math.PI, pitch: 0.18, dist: settings.distance, look: 0 })
  const current = useRef(null)
  const near = useRef(false)
  const moved = useRef(false)
  const settle = useRef(0)
  const crouchT = useRef(0) // 0 standing .. 1 fully crouched (smooth)
  const crouchPose = useRef(false)
  const crouchTransition = useRef(null)
  const velocity = useRef(new THREE.Vector3())
  const wasSpaceDown = useRef(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const crouchRef = useRef(crouch)
  crouchRef.current = crouch
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const pos = useRef(new THREE.Vector3(SPAWN[0], PLATFORM_H, SPAWN[1]))
  const camPos = useMemo(() => new THREE.Vector3(), [])
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const lookRef = useMemo(() => new THREE.Vector3(SPAWN[0], PLATFORM_H + 1.3, SPAWN[1]), [])
  const shadow = useMemo(() => makeShadowTex(), [])

  const idleName =
    names.find((n) => /^idle$/i.test(n)) || names.find((n) => /idle/i.test(n)) || names[0]
  const walkName =
    names.find((n) => /^walk$/i.test(n)) ||
    names.find((n) => /walk/i.test(n) && !/attack|gun/i.test(n)) ||
    names.find((n) => /run/i.test(n) && !/attack|gun/i.test(n))
  const runName =
    names.find((n) => /^run$/i.test(n)) ||
    names.find((n) => /run|sprint/i.test(n) && !/attack|gun|shoot|sword|stab/i.test(n))
  const crouchWalkName = names.find((n) => /^crouchedWalk$/i.test(n)) ||
    names.find((n) => /crouch.*walk|walk.*crouch/i.test(n))
  const crouchIdleName = names.find((n) => /^crouchIdle$/i.test(n)) ||
    names.find((n) => /crouch.*idle|idle.*crouch/i.test(n))
  const crouchEnterName = names.find((n) => /^crouchEnter$/i.test(n))
  const crouchExitName = names.find((n) => /^crouchExit$/i.test(n))

  const play = (name, speed = 1) => {
    if (!name) return
    const next = actions[name]
    if (!next) return
    if (current.current === name && next.isRunning()) {
      next.timeScale = speed
      return
    }
    next.reset().fadeIn(0.2).play()
    next.timeScale = speed
    if (current.current && current.current !== name) actions[current.current]?.fadeOut(0.2)
    current.current = name
  }

  // tidy up the character's materials (no plastic shine, no vanishing when animated)
  useEffect(() => {
    fixMaterials(object, 'player')
  }, [object])

  useEffect(() => {
    onReady?.()
  }, [object, onReady])

  useEffect(() => {
    console.log('player animations:', names)
  }, [names])

  useEffect(() => {
    if (phase === 'play') settle.current = 1.2
  }, [phase])

  // the camera distance slider in the settings
  useEffect(() => {
    cam.current.dist = settings.distance
  }, [settings.distance])

  // leave mouse-lock when going back to third person or opening the settings
  useEffect(() => {
    if ((settings.cameraMode !== 'first' || paused) && document.pointerLockElement === gl.domElement) {
      document.exitPointerLock()
    }
  }, [settings.cameraMode, paused, gl])

  // keyboard
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && phaseRef.current === 'play' && !pausedRef.current) e.preventDefault()
      if (
        phaseRef.current === 'play' &&
        !pausedRef.current &&
        settingsRef.current.cameraMode === 'first'
      ) {
        if (e.code === 'Digit1') setWeapon('pistol')
        else if (e.code === 'Digit2') setWeapon('akm')
        else if (e.code === 'KeyR') {
          weaponAction.current = { id: weaponAction.current.id + 1, type: 'reload' }
        }
      }
      keys.current[e.code] = true
    }
    const up = (e) => (keys.current[e.code] = false)
    const clear = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // mouse + touch look:
  //  - third person: drag to orbit the camera
  //  - first person (mouse): click to lock the cursor, then just move the mouse
  //  - touch: drag a finger anywhere on the scene (the joystick has its own finger)
  // scroll zooms the third-person camera
  useEffect(() => {
    const el = gl.domElement
    let lookId = null
    let lastX = 0
    let lastY = 0
    const locked = () => document.pointerLockElement === el
    const active = () => phaseRef.current === 'play' && !pausedRef.current

    const rotate = (dx, dy) => {
      const s = settingsRef.current
      const k = 0.005 * s.sensitivity
      const c = cam.current
      c.yaw -= dx * k
      if (s.cameraMode === 'first') c.look = clamp(c.look + dy * k, -1.4, 1.4)
      else c.pitch = clamp(c.pitch + dy * k, 0.05, 1.2)
    }
    const down = (e) => {
      if (!active()) return
      const s = settingsRef.current
      if (
        e.button === 0 &&
        s.cameraMode === 'first' &&
        (locked() || !s.lockMouse)
      ) {
        weaponAction.current = { id: weaponAction.current.id + 1, type: 'shoot' }
      }
      if (e.pointerType === 'mouse' && s.cameraMode === 'first' && s.lockMouse && !locked()) {
        const p = el.requestPointerLock?.()
        if (p && p.catch) p.catch(() => {})
      }
      if (lookId === null) {
        lookId = e.pointerId
        lastX = e.clientX
        lastY = e.clientY
      }
    }
    const move = (e) => {
      if (!active()) return
      if (locked()) {
        if (e.pointerType === 'mouse') rotate(e.movementX, e.movementY)
        return
      }
      if (e.pointerId !== lookId) return
      rotate(e.clientX - lastX, e.clientY - lastY)
      lastX = e.clientX
      lastY = e.clientY
    }
    const up = (e) => {
      if (e.pointerId === lookId) lookId = null
    }
    const wheel = (e) => {
      if (!active()) return
      cam.current.dist = clamp(cam.current.dist + e.deltaY * 0.01, 4, 16)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])

  useFrame((state, delta) => {
    const physicsDelta = Math.min(delta, 0.1)
    const physicsSteps = Math.max(1, Math.ceil(physicsDelta / (1 / 60)))
    const physicsStep = physicsDelta / physicsSteps
    const k = keys.current
    const c = cam.current
    const first = settingsRef.current.cameraMode === 'first'
    const enabled = phaseRef.current === 'play' && !pausedRef.current
    const crouching = crouchRef.current

    // smooth stand <-> crouch
    crouchT.current += ((crouching ? 1 : 0) - crouchT.current) * (1 - Math.exp(-10 * delta))
    const ct = crouchT.current

    // Q / E also rotate the camera
    if (enabled) c.yaw += ((k.KeyQ ? 1 : 0) - (k.KeyE ? 1 : 0)) * 1.5 * delta

    // keyboard (digital) + touch joystick (analog) -> forward / sideways amounts
    let f = 0
    let r = 0
    if (enabled) {
      f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + controls.moveY
      r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + controls.moveX
    }
    const mag = Math.hypot(f, r)
    const amount = Math.min(1, mag) // how hard you push (0..1)
    const moving = amount > 0.08
    const joyMag = Math.hypot(controls.moveX, controls.moveY)
    const running =
      moving && !crouching && (k.ShiftLeft || k.ShiftRight || controls.run || joyMag > 0.92)

    // movement relative to where the camera looks, in any direction
    const sin = Math.sin(c.yaw)
    const cos = Math.cos(c.yaw)
    let mx = -sin * f + cos * r
    let mz = -cos * f - sin * r

    const turnTo = (target, rate) => {
      let diff = target - group.current.rotation.y
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      group.current.rotation.y += diff * (1 - Math.exp(-rate * delta))
    }

    if (moving) {
      moved.current = true
      mx /= mag
      mz /= mag
    }

    const wasGrounded = pos.current.y <= (
      Math.hypot(pos.current.x - SPAWN[0], pos.current.z - SPAWN[1]) < PLATFORM_R ? PLATFORM_H : 0
    ) + 0.001 && velocity.current.y <= 0
    const spaceDown = enabled && (k.Space || controls.jump)
    if (spaceDown && !wasSpaceDown.current && wasGrounded && !crouching) {
      velocity.current.y = PHYSICS.jumpSpeed
    }
    wasSpaceDown.current = spaceDown

    const targetSpeed = (running ? mv.run : mv.walk) * amount * (crouching ? CROUCH.speed : 1)
    const desiredX = mx * targetSpeed
    const desiredZ = mz * targetSpeed
    for (let i = 0; i < physicsSteps; i++) {
      const onPadBeforeStep =
        Math.hypot(pos.current.x - SPAWN[0], pos.current.z - SPAWN[1]) < PLATFORM_R
      const floorBeforeStep = onPadBeforeStep ? PLATFORM_H : 0
      const grounded = pos.current.y <= floorBeforeStep + 0.001 && velocity.current.y <= 0
      const control = grounded ? 1 : PHYSICS.airControl
      const response = moving ? PHYSICS.groundAcceleration : PHYSICS.groundDeceleration
      const blend = 1 - Math.exp(-response * control * physicsStep)
      velocity.current.x += (desiredX - velocity.current.x) * blend
      velocity.current.z += (desiredZ - velocity.current.z) * blend

      const previousX = pos.current.x
      const previousZ = pos.current.z
      pos.current.x += velocity.current.x * physicsStep
      pos.current.z += velocity.current.z * physicsStep
      pushOutOfDesk(pos.current)
      pushOutOfTrees(pos.current)
      keepOnIsland(pos.current)
      if (pos.current.x !== previousX + velocity.current.x * physicsStep) velocity.current.x = 0
      if (pos.current.z !== previousZ + velocity.current.z * physicsStep) velocity.current.z = 0

      const onPad = Math.hypot(pos.current.x - SPAWN[0], pos.current.z - SPAWN[1]) < PLATFORM_R
      const groundY = onPad ? PLATFORM_H : 0
      velocity.current.y -= PHYSICS.gravity * physicsStep
      pos.current.y += velocity.current.y * physicsStep
      if (pos.current.y <= groundY) {
        pos.current.y = groundY
        velocity.current.y = 0
      }
    }
    const onGround = velocity.current.y === 0
    const actualMoving = Math.hypot(velocity.current.x, velocity.current.z) > 0.08
    group.current.position.copy(pos.current)

    if (first) {
      // first person: the body always faces where you look, and is hidden from your own eyes
      group.current.rotation.y = c.yaw + Math.PI
      moved.current = true
    } else if (actualMoving || moving) {
      const facingX = actualMoving ? velocity.current.x : mx
      const facingZ = actualMoving ? velocity.current.z : mz
      turnTo(Math.atan2(facingX, facingZ), 10)
    } else if (!moved.current) {
      // Before the first step, face the sea.
      turnTo(0, 5)
    }

    // Crouch height comes from the crouch animation; don't squash the character model.
    if (body.current) {
      body.current.visible = !first
      body.current.scale.setScalar(scale)
    }

    if (crouching !== crouchPose.current) {
      crouchPose.current = crouching
      const transitionName = crouching ? crouchEnterName : crouchExitName
      const transitionAction = transitionName && actions[transitionName]
      if (transitionAction) {
        if (current.current) actions[current.current]?.fadeOut(0.12)
        transitionAction.reset()
        transitionAction.setLoop(THREE.LoopOnce, 1)
        transitionAction.clampWhenFinished = true
        transitionAction.fadeIn(0.12).play()
        current.current = transitionName
        crouchTransition.current = transitionAction
      }
    }

    if (crouchTransition.current) {
      const transitionAction = crouchTransition.current
      if (!transitionAction.isRunning() || transitionAction.time >= transitionAction.getClip().duration) {
        crouchTransition.current = null
      }
    }
    if (!crouchTransition.current) {
      if (!actualMoving) play(crouching ? crouchIdleName || idleName : idleName)
      else if (crouching) play(crouchWalkName || walkName || idleName, mv.walkAnim * 0.75)
      else if (!onGround) play(runName || walkName || idleName, mv.walkAnim)
      else if (running) (runName ? play(runName, mv.runAnim) : play(walkName || idleName, mv.walkAnim * 1.7))
      else play(walkName || idleName, mv.walkAnim * Math.max(0.5, amount))
    }

    // near the reception? show the paper card
    const nd = Math.hypot(pos.current.x - DESK_POS[0], pos.current.z - DESK_POS[2]) < 5
    if (nd !== near.current) {
      near.current = nd
      onNearDesk(nd)
    }

    // camera
    if (settle.current > 0) settle.current -= delta
    let fovTarget
    let posRate
    if (first) {
      // eyes of the character
      const eye = EYE_HEIGHT - (EYE_HEIGHT - CROUCH.eye) * ct
      camPos.set(pos.current.x, pos.current.y + eye, pos.current.z)
      posRate = settle.current > 0 ? 4 : 30
      state.camera.position.lerp(camPos, 1 - Math.exp(-posRate * delta))
      const cp = Math.cos(c.look)
      lookRef.set(
        state.camera.position.x - Math.sin(c.yaw) * cp,
        state.camera.position.y - Math.sin(c.look),
        state.camera.position.z - Math.cos(c.yaw) * cp
      )
      state.camera.lookAt(lookRef)
      fovTarget = running ? 78 : 70
    } else {
      // camera orbits around the character
      camTarget.set(pos.current.x, pos.current.y + 1.3 - 0.35 * ct, pos.current.z)
      camPos.set(
        camTarget.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist,
        camTarget.y + Math.sin(c.pitch) * c.dist,
        camTarget.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist
      )
      posRate = settle.current > 0 ? 3 : 8
      const lookRate = settle.current > 0 ? 4 : 25
      state.camera.position.lerp(camPos, 1 - Math.exp(-posRate * delta))
      lookRef.lerp(camTarget, 1 - Math.exp(-lookRate * delta))
      state.camera.lookAt(lookRef)
      fovTarget = running ? 58 : 50
    }
    state.camera.fov += (fovTarget - state.camera.fov) * (1 - Math.exp(-5 * delta))
    state.camera.updateProjectionMatrix()
  })

  return (
    <>
      <group ref={group} position={[SPAWN[0], PLATFORM_H, SPAWN[1]]}>
        <group ref={body} scale={scale}>
          <primitive object={object} />
        </group>
        {/* soft shadow under the feet */}
        <mesh rotation-x={-Math.PI / 2} position-y={0.08} renderOrder={6}>
          <planeGeometry args={[2.2, 2.2]} />
          <meshBasicMaterial map={shadow} transparent depthWrite={false} />
        </mesh>
      </group>
      {settings.cameraMode === 'first' && (
        <FirstPersonWeapon weapon={weapon} actionSignal={weaponAction} />
      )}
    </>
  )
}
