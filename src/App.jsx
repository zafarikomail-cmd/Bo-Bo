import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, extend, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Sky, useGLTF, useFBX, useAnimations, Text, useProgress, PerformanceMonitor } from '@react-three/drei'
import { Water } from 'three-stdlib'
import { assetUrl } from './assetUrl.js'

extend({ Water })

/* phone / tablet detection (touch screen as the main input) */
const COARSE =
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches

/* shared input for the on-screen joystick (phones) */
const INPUT = { x: 0, y: 0, run: false }

/* ============ EDIT THESE ============ */
const PLANE_MESSAGE = "Welcome to Ahmad Komail's World"
const PHOTOS = ['/images/photo1.jpg', '/images/photo2.jpg', '/images/photo3.jpg']
const ABOUT_TITLE = 'About Me'
const ABOUT_TEXT = `Hi, I'm Ahmad Komail. I'm a BS Information Technology student at NUTECH, interested in cybersecurity, networking and full-stack development. Before university I worked in television doing archive management, video editing and master control playout, which is where my love for building things that go live began. Today I build web projects and I'm learning React and 3D on the web. This beach is my way of saying hello. Make yourself at home!`
const SKIN_COLOR = '#d9a77c' // default skin tone (used for the simple Quaternius characters)
const TREE_COUNT = COARSE ? 50 : 100 // fewer trees on phones so it stays smooth
const WALK_SPEED = 4
const RUN_SPEED = 9 // hold Shift (PC) or the RUN button (phone)
const TIME_OF_DAY = 'day' // 'day' = blue sky + white clouds, 'sunset' = orange evening
const SAND_TILE = 5 // world units one sand texture covers (bigger = bigger grains)
const GRASS_TILE = 4 // world units one grass texture covers
const GRASS_BLADES = COARSE ? 8000 : 30000 // real 3D grass blades (fewer on phones)
const SHADOWS = !COARSE // real-time shadows from the sun (PC only, phones skip them)
const PLAYER_HEIGHT = 1.75 // your character is scaled to exactly this height (world units ~ meters)
const RECEPTIONIST_HEIGHT = 1.7 // the receptionist too, so everyone matches
const MAX_DPR = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, COARSE ? 1.5 : 1.75)

// Characters the player can choose between on the customization screen.
// .fbx files are Mixamo characters (they use the 3 animation files below).
// .gltf files are Quaternius characters (they bring their own animations).
const CHARACTERS = [
  { name: 'Character 1', file: 'character.fbx' },
  { name: 'Character 2', file: 'character1.fbx' },
]

// Mixamo animation files (names must match the files in public/models exactly)
const ANIMS = { idle: 'Idle.fbx', walk: 'Walking.fbx', run: 'Fast Run.fbx' }
/* ==================================== */

const modelUrl = (f) => encodeURI(assetUrl(`/models/${f}`))

const preloadCharacter = (file) =>
  file.endsWith('.fbx') ? useFBX.preload(modelUrl(file)) : useGLTF.preload(modelUrl(file))

// only the FIRST character and the 3 animations block the loading bar; the other
// characters load quietly in the background once the customize screen is open
preloadCharacter(CHARACTERS[0].file)
if (CHARACTERS.some((c) => c.file.endsWith('.fbx'))) {
  Object.values(ANIMS).forEach((a) => useFBX.preload(modelUrl(a)))
}

const ATMOSPHERES = {
  day: {
    sun: [-70, 20, 90], // low in front of you, over the sea
    sky: { turbidity: 3, rayleigh: 1.2, mie: 0.005, g: 0.8 },
    water: 0x0b9bb8,
    light: '#fff3e0',
    lightI: 2.6,
    lightPos: [-8, 10, -10],
    clouds: true,
  },
  sunset: {
    sun: [-100, 9, 55],
    sky: { turbidity: 8, rayleigh: 3, mie: 0.005, g: 0.8 },
    water: 0x0b6f8f,
    light: '#ffb27a',
    lightI: 1.5,
    lightPos: [-10, 8, 6],
    clouds: false,
  },
}
const AT = ATMOSPHERES[TIME_OF_DAY] || ATMOSPHERES.day
const SUN = AT.sun
const SUN_DIR = new THREE.Vector3(...SUN).normalize()
const LIGHT_DIR = new THREE.Vector3(SUN[0], SUN[1] * 2.2, SUN[2]).normalize() // light comes from higher than the visible sun

const SPAWN = [0, 44]
const PLAYER = { pos: new THREE.Vector3(SPAWN[0], 0, SPAWN[1]) } // the sun's shadow follows this
const HIDE_IN_REFLECTION = new Set() // heavy things the sea does not need to draw a second time
const PLATFORM_R = 2.8
const PLATFORM_H = 0.3
const BILLBOARD_POS = [-13, 0, 50]
const DESK_POS = [13, 0, 50]
const DESK_RADIUS = 2.3

const isNarrow = (w, h) => w / h < 1.05 || w < 720

/* ---------- island shape (angle a -> radius) ---------- */
const shoreR = (a) =>
  60 * (1 + 0.07 * Math.sin(3 * a + 0.6) + 0.05 * Math.sin(5 * a + 2.1) + 0.03 * Math.sin(8 * a + 0.2))
const grassR = (a) => 0.74 * shoreR(a) * (1 + 0.05 * Math.sin(7 * a + 0.5))
const lagoonR = (a) => 15 * (1 + 0.1 * Math.sin(2 * a + 0.3) + 0.06 * Math.sin(4 * a + 1))

function outlinePoints(fn, scale = 1, n = 200) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = fn(a) * scale
    // shape y is -z once the mesh is laid flat
    pts.push(new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r))
  }
  return pts
}

function blobGeometry(outer, hole) {
  const shape = new THREE.Shape(outer)
  if (hole) shape.holes.push(new THREE.Path(hole))
  return new THREE.ShapeGeometry(shape)
}

const GEO = {
  shelf1: blobGeometry(outlinePoints(shoreR, 1.25)),
  shelf2: blobGeometry(outlinePoints(shoreR, 1.55)),
  shelf3: blobGeometry(outlinePoints(shoreR, 1.9)),
  foam: blobGeometry(outlinePoints(shoreR, 1)),
  wet: blobGeometry(outlinePoints(shoreR, 1.03)),
  sand: blobGeometry(outlinePoints(shoreR), outlinePoints(lagoonR)),
  grass: blobGeometry(outlinePoints(grassR), outlinePoints((a) => lagoonR(a) + 7)),
  grass2: blobGeometry(
    outlinePoints((a) => 0.55 * shoreR(a) * (1 + 0.06 * Math.sin(5 * a + 1.3))),
    outlinePoints((a) => lagoonR(a) + 11)
  ),
  lagoon: blobGeometry(outlinePoints(lagoonR, 1.04)),
}

/* keep the player on the island, out of the lagoon */
function keepOnIsland(p) {
  const a = Math.atan2(p.z, p.x)
  const r = Math.hypot(p.x, p.z)
  const max = shoreR(a) - 1
  const min = lagoonR(a) + 1.5
  if (r > max) {
    p.x = Math.cos(a) * max
    p.z = Math.sin(a) * max
  } else if (r < min) {
    p.x = Math.cos(a) * min
    p.z = Math.sin(a) * min
  }
}

/* ---------- forest (same every time) ---------- */
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TREE_FILES = ['tree1.glb', 'tree2.glb', 'tree3.glb']

// palms placed by hand so they frame the customization view on both sides
const FRAME_TREES = [
  { file: 'tree1.glb', x: 3.9, z: 47.5, scale: 1.5, rot: 0.6 },
  { file: 'tree3.glb', x: 7.5, z: 52, scale: 1.3, rot: 2.1 },
  { file: 'tree2.glb', x: -8.5, z: 47.5, scale: 1.6, rot: 4.0 },
  { file: 'tree1.glb', x: -5.6, z: 41.5, scale: 0.9, rot: 1.0 },
]

function makeForest() {
  const r = rng(11)
  const trees = []
  // keep the spawn, billboard and desk areas open
  const clear = [
    [SPAWN[0], SPAWN[1], 13],
    [BILLBOARD_POS[0], BILLBOARD_POS[2], 9],
    [DESK_POS[0], DESK_POS[2], 8],
  ]
  let tries = 0
  while (trees.length < TREE_COUNT && tries < 10000) {
    tries++
    const a = r() * Math.PI * 2
    const lo = lagoonR(a) + 8
    const hi = shoreR(a) - 4
    const d = Math.sqrt(lo * lo + r() * (hi * hi - lo * lo))
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d

    // on the outer sand: only a few palms, and none on the open beach in front
    if (d > grassR(a) + 1) {
      const fromSouth = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)))
      if (fromSouth < 0.9 || r() > 0.3) continue
    }
    if (clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) continue
    if (trees.some((t) => Math.hypot(x - t.x, z - t.z) < 2.2)) continue

    const tall = r() > 0.4
    const scale = (tall ? 0.8 + r() * 0.7 : 0.3 + r() * 0.25) * 1.2
    trees.push({
      file: TREE_FILES[Math.floor(r() * TREE_FILES.length)],
      x,
      z,
      rot: r() * 6.28,
      scale,
      rad: 0.25 + 0.25 * scale,
    })
  }
  FRAME_TREES.forEach((t) => trees.push({ ...t, rad: 0.25 + 0.25 * t.scale }))
  return trees
}
const FOREST = makeForest()

function pushOutOfTrees(p) {
  for (const t of FOREST) {
    const dx = p.x - t.x
    const dz = p.z - t.z
    const d = Math.hypot(dx, dz)
    const m = t.rad + 0.4
    if (d < m && d > 0.0001) {
      p.x = t.x + (dx / d) * m
      p.z = t.z + (dz / d) * m
    }
  }
}

/* ---------- helpers ---------- */
function fixMaterials(scene, label, skin = SKIN_COLOR) {
  const seen = new Set()
  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach((m) => {
      if (m.metalness !== undefined) m.metalness = 0
      if (m.roughness !== undefined) m.roughness = 1
      if (!seen.has(m.name)) {
        seen.add(m.name)
        console.log(label, 'material:', m.name, m.color ? '#' + m.color.getHexString() : '', 'mesh:', o.name)
      }
      if (/skin/i.test(m.name) && m.color) m.color.set(skin)
    })
  })
}

/* ---------- character customization: find the colorable parts ---------- */
const IGNORE_PART = /eye|teeth|tooth|mouth|tongue|pupil|iris|lash/i
const PART_RULES = [
  ['skin', /skin/i, 'Skin tone'],
  ['hair', /hair|beard|mustache|moustache|brow/i, 'Hair'],
  ['hat', /hat|cap|helmet|hood|beanie/i, 'Hat'],
  ['shoes', /shoe|boot|feet|foot|sneaker/i, 'Shoes'],
  ['pants', /pant|trouser|jean|short|leg|skirt/i, 'Pants'],
  ['outfit', /shirt|top|torso|jacket|vest|coat|suit|dress|cloth|body|sweater|hoodie/i, 'Outfit'],
]
const PART_ORDER = ['skin', 'hair', 'hat', 'outfit', 'pants', 'shoes', 'color']

function detectParts(root) {
  const byKey = new Map()
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach((m) => {
      if (!m.color) return
      // textured materials (Mixamo) already look right; tinting them looks muddy, so skip them
      if (m.map) return
      const generic = !m.name || /^material(\.\d+)?$/i.test(m.name)
      const raw = (generic ? o.name || 'Part' : m.name).replace(/\.\d+$/, '')
      if (IGNORE_PART.test(raw)) return
      if (!byKey.has(raw)) {
        const rule = PART_RULES.find(([, re]) => re.test(raw))
        byKey.set(raw, {
          key: raw,
          kind: rule ? rule[0] : 'color',
          label: rule ? rule[2] : raw.replace(/[_-]+/g, ' ').trim(),
          mats: [],
        })
      }
      if (!m.userData.origColor) m.userData.origColor = m.color.clone()
      const part = byKey.get(raw)
      if (!part.mats.includes(m)) part.mats.push(m)
    })
  })
  const list = [...byKey.values()].sort(
    (a, b) => PART_ORDER.indexOf(a.kind) - PART_ORDER.indexOf(b.kind)
  )
  const seen = {}
  list.forEach((p) => {
    seen[p.label] = (seen[p.label] || 0) + 1
    if (seen[p.label] > 1) p.label += ' ' + seen[p.label]
  })
  return list.slice(0, 8)
}

class Safe extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.error('Something failed to load:', err)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Tree({ file, position, scale = 1, rotation = 0, tint = 0.5 }) {
  const { scene } = useGLTF(modelUrl(file))
  const copy = useMemo(() => {
    const c = scene.clone()
    c.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = SHADOWS
      o.receiveShadow = SHADOWS
      const list = Array.isArray(o.material) ? o.material : [o.material]
      const fixed = list.map((m) => {
        const n = m.clone()
        if (n.metalness !== undefined) n.metalness = 0
        if (n.roughness !== undefined) n.roughness = 0.95
        // leaves drawn on see-through textures: cut them out cleanly
        if (n.map && (n.transparent || n.alphaMap)) {
          n.alphaTest = 0.45
          n.transparent = false
          n.depthWrite = true
          n.side = THREE.DoubleSide
        }
        // every tree gets a slightly different shade, like real life
        if (n.color) n.color.offsetHSL((tint - 0.5) * 0.05, (tint - 0.5) * 0.1, (0.5 - tint) * 0.08)
        return n
      })
      o.material = Array.isArray(o.material) ? fixed : fixed[0]
    })
    return c
  }, [scene, tint])
  return <primitive object={copy} position={position} scale={scale} rotation={[0, rotation, 0]} />
}

function Forest() {
  const ref = useRef()
  useEffect(() => {
    const g = ref.current
    HIDE_IN_REFLECTION.add(g)
    return () => HIDE_IN_REFLECTION.delete(g)
  }, [])
  return (
    <group ref={ref}>
      {FOREST.map((t, i) => (
        <Tree
          key={i}
          file={t.file}
          position={[t.x, 0, t.z]}
          scale={t.scale}
          rotation={t.rot}
          tint={((i * 2654435761) >>> 0) / 4294967296}
        />
      ))}
    </group>
  )
}

/* measures a model and returns the scale that makes it exactly `height` units tall */
function fitScale(object, height, fallback = 1) {
  object.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(object)
  const h = (box.max.y - box.min.y) / (object.scale.y || 1)
  return h > 0.01 && isFinite(h) ? height / h : fallback
}

/* standing character (the receptionist) */
function Character({ file, position, scale = 1, rotation = 0, height }) {
  const { scene, animations } = useGLTF(modelUrl(file))
  const fit = useMemo(() => (height ? fitScale(scene, height, scale) : scale), [scene, height, scale])
  const { actions, names } = useAnimations(animations, scene)

  useEffect(() => {
    fixMaterials(scene, file)
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = SHADOWS
        o.frustumCulled = false
      }
    })
    const idle = names.find((n) => /idle/i.test(n)) || names[0]
    if (idle) actions[idle]?.reset().fadeIn(0.3).play()
  }, [scene, actions, names, file])

  return <primitive object={scene} position={position} scale={fit} rotation={[0, rotation, 0]} />
}

/* Mixamo animations can drift forward; lock the hips sideways/forward so the body stays in place */
function makeClip(source, name) {
  const clip = source.animations[0].clone()
  clip.name = name
  clip.tracks.forEach((t) => {
    if (/Hips\.position$/.test(t.name)) {
      const v = t.values
      const x0 = v[0]
      const z0 = v[2]
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0
        v[i + 2] = z0
      }
    }
  })
  return clip
}

/* loads a Mixamo character (.fbx + 3 animation files) or a Quaternius character (.gltf) */
function usePlayerModel(file) {
  /* eslint-disable react-hooks/rules-of-hooks */
  if (file.endsWith('.fbx')) {
    const body = useFBX(modelUrl(file))
    const idleFbx = useFBX(modelUrl(ANIMS.idle))
    const walkFbx = useFBX(modelUrl(ANIMS.walk))
    const runFbx = useFBX(modelUrl(ANIMS.run))
    const clips = useMemo(
      () => [makeClip(idleFbx, 'idle'), makeClip(walkFbx, 'walk'), makeClip(runFbx, 'run')],
      [idleFbx, walkFbx, runFbx]
    )
    return { object: body, scale: 0.01, clips }
  }
  const { scene, animations } = useGLTF(modelUrl(file))
  return { object: scene, scale: 1, clips: animations }
}

function makeShadowTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.5)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.22)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

/* the character you control (and customize) */
function Player({ phase, file, look, onParts, onNearDesk, onReady }) {
  const enabled = phase === 'play'
  const group = useRef()
  const { gl } = useThree()
  const { object, scale, clips } = usePlayerModel(file)
  const fit = useMemo(() => fitScale(object, PLAYER_HEIGHT, scale), [object, scale])
  const { actions, names } = useAnimations(clips, group)
  const keys = useRef({})
  const cam = useRef({ yaw: Math.PI, pitch: 0.18, dist: 8 }) // play camera starts looking at the sea
  const current = useRef(null)
  const near = useRef(false)
  const moved = useRef(false)
  const settle = useRef(0)
  const spinOffset = useRef(0)
  const isDragging = useRef(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const parts = useRef([])
  const pos = useRef(new THREE.Vector3(SPAWN[0], PLATFORM_H, SPAWN[1]))
  const camPos = useMemo(() => new THREE.Vector3(), [])
  const camTarget = useMemo(() => new THREE.Vector3(), [])
  const lookRef = useMemo(() => new THREE.Vector3(SPAWN[0] - 1.7, 1, SPAWN[1]), [])
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

  const play = (name, speed = 1) => {
    if (!name) return
    const next = actions[name]
    if (!next) return
    if (current.current === name) {
      next.timeScale = speed
      return
    }
    next.reset().fadeIn(0.2).play()
    next.timeScale = speed
    if (current.current) actions[current.current]?.fadeOut(0.2)
    current.current = name
  }

  // tell the app this character has finished loading
  useEffect(() => {
    onReady?.()
  }, [object, onReady])

  // the character casts a real shadow and never disappears at the screen edge
  useEffect(() => {
    object.traverse((o) => {
      if (!o.isMesh) return
      o.castShadow = SHADOWS
      o.receiveShadow = SHADOWS
      if (o.isSkinnedMesh) o.frustumCulled = false
    })
  }, [object])

  // find which parts of this character can be recolored
  useEffect(() => {
    if (!file.endsWith('.fbx')) fixMaterials(object, 'player')
    const list = detectParts(object)
    parts.current = list
    onParts(list.map(({ key, label, kind }) => ({ key, label, kind })))
    console.log('player animations:', names)
    console.log('customizable parts:', list.map((p) => p.key + ' -> ' + p.label))
  }, [object, names, onParts, file])

  // apply the colors picked in the customization panel
  useEffect(() => {
    for (const p of parts.current) {
      const chosen = look.colors[p.key]
      p.mats.forEach((m) => {
        if (!m.color) return
        if (chosen) m.color.set(chosen)
        else if (p.kind === 'skin') m.color.set(SKIN_COLOR)
        else if (m.userData.origColor) m.color.copy(m.userData.origColor)
        m.visible = !look.hidden[p.key]
      })
    }
  }, [look, object])

  useEffect(() => {
    if (phase === 'play') settle.current = 1.2
  }, [phase])

  // keyboard
  useEffect(() => {
    const down = (e) => (keys.current[e.code] = true)
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

  // mouse AND touch: one finger/mouse drag rotates the camera (or turns the character
  // on the customization screen), two fingers pinch to zoom, mouse wheel zooms too
  useEffect(() => {
    const el = gl.domElement
    const pts = new Map()
    let pinch = 0
    const spread = () => {
      const [a, b] = [...pts.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      isDragging.current = true
      if (pts.size === 2) pinch = spread()
    }
    const up = (e) => {
      pts.delete(e.pointerId)
      if (pts.size === 0) isDragging.current = false
    }
    const move = (e) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (pts.size === 2) {
        const d = spread()
        if (phaseRef.current === 'play') {
          cam.current.dist = THREE.MathUtils.clamp(cam.current.dist - (d - pinch) * 0.03, 4, 16)
        }
        pinch = d
        return
      }
      if (phaseRef.current === 'play') {
        cam.current.yaw -= dx * 0.005
        cam.current.pitch = THREE.MathUtils.clamp(cam.current.pitch + dy * 0.005, 0.05, 1.2)
      } else if (phaseRef.current === 'customize') {
        spinOffset.current += dx * 0.01
      }
    }
    const wheel = (e) => {
      if (phaseRef.current !== 'play') return
      cam.current.dist = THREE.MathUtils.clamp(cam.current.dist + e.deltaY * 0.01, 4, 16)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('pointermove', move)
    el.addEventListener('wheel', wheel, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('pointermove', move)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])

  useFrame((state, delta) => {
    const k = keys.current
    const c = cam.current
    const t = state.clock.elapsedTime
    const wide = !isNarrow(state.size.width, state.size.height)

    // Q / E also rotate the camera
    if (enabled) c.yaw += ((k.KeyQ ? 1 : 0) - (k.KeyE ? 1 : 0)) * 1.5 * delta

    let f = 0
    let r = 0
    if (enabled) {
      f = THREE.MathUtils.clamp((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + INPUT.y, -1, 1)
      r = THREE.MathUtils.clamp((k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + INPUT.x, -1, 1)
    }

    // movement relative to where the camera looks
    const sin = Math.sin(c.yaw)
    const cos = Math.cos(c.yaw)
    let mx = -sin * f + cos * r
    let mz = -cos * f - sin * r
    const len = Math.hypot(mx, mz)
    const moving = len > 0.001
    const running = moving && (k.ShiftLeft || k.ShiftRight || INPUT.run)

    const turnTo = (target, rate) => {
      let diff = target - group.current.rotation.y
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      group.current.rotation.y += diff * (1 - Math.exp(-rate * delta))
    }

    if (moving) {
      moved.current = true
      const mag = Math.min(len, 1) // joystick pushed halfway = slower
      mx /= len
      mz /= len
      const speed = (running ? RUN_SPEED : WALK_SPEED) * mag
      pos.current.x += mx * speed * delta
      pos.current.z += mz * speed * delta

      // can't walk through the reception desk
      const ox = pos.current.x - DESK_POS[0]
      const oz = pos.current.z - DESK_POS[2]
      const d = Math.hypot(ox, oz)
      if (d < DESK_RADIUS && d > 0.001) {
        pos.current.x = DESK_POS[0] + (ox / d) * DESK_RADIUS
        pos.current.z = DESK_POS[2] + (oz / d) * DESK_RADIUS
      }

      // trees are solid, the lagoon and the sea are off limits
      pushOutOfTrees(pos.current)
      keepOnIsland(pos.current)

      group.current.rotation.y = Math.atan2(mx, mz)
    }

    // step up onto the wooden stage
    const onPad = Math.hypot(pos.current.x - SPAWN[0], pos.current.z - SPAWN[1]) < PLATFORM_R
    pos.current.y += ((onPad ? PLATFORM_H : 0) - pos.current.y) * (1 - Math.exp(-14 * delta))
    group.current.position.copy(pos.current)
    PLAYER.pos.copy(pos.current)

    // body rotation: face the camera on the customization screen
    if (phase !== 'play') {
      if (!isDragging.current) spinOffset.current *= Math.exp(-0.5 * delta)
      turnTo(Math.PI + Math.sin(t * 0.6) * 0.3 + spinOffset.current, 6)
    } else if (!moved.current) {
      turnTo(0, 5)
    }

    if (!moving) play(idleName)
    else if (running) (runName ? play(runName) : play(walkName || idleName, 1.7))
    else play(walkName || idleName)

    // near the reception? show the paper card
    const nd = Math.hypot(pos.current.x - DESK_POS[0], pos.current.z - DESK_POS[2]) < 5
    if (nd !== near.current) {
      near.current = nd
      onNearDesk(nd)
    }

    // camera
    let fovTarget
    if (phase !== 'play') {
      // fixed "character select" camera, character on the left, panel on the right
      camPos.set(SPAWN[0] + 0.4, wide ? 1.7 : 2.0, SPAWN[1] - (wide ? 7.5 : 9.5))
      camTarget.set(SPAWN[0] - (wide ? 1.7 : 0), wide ? 1.0 : 0.0, SPAWN[1])
      fovTarget = wide ? 35 : 40
    } else {
      // camera orbits around the character
      camTarget.set(pos.current.x, pos.current.y + 1.3, pos.current.z)
      camPos.set(
        camTarget.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist,
        camTarget.y + Math.sin(c.pitch) * c.dist,
        camTarget.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist
      )
      fovTarget = running ? 58 : 50
      if (settle.current > 0) settle.current -= delta
    }
    const posRate = phase !== 'play' ? 4 : settle.current > 0 ? 3 : 8
    const lookRate = phase !== 'play' ? 5 : settle.current > 0 ? 4 : 25
    state.camera.position.lerp(camPos, 1 - Math.exp(-posRate * delta))
    lookRef.lerp(camTarget, 1 - Math.exp(-lookRate * delta))
    state.camera.lookAt(lookRef)
    state.camera.fov += (fovTarget - state.camera.fov) * (1 - Math.exp(-5 * delta))
    state.camera.updateProjectionMatrix()
  })

  return (
    <group ref={group} position={[SPAWN[0], PLATFORM_H, SPAWN[1]]} rotation={[0, Math.PI, 0]}>
      <primitive object={object} scale={fit} />
      {/* soft shadow under the feet */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.08} renderOrder={6}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ---------- water ---------- */
// endless ocean
function Ocean() {
  const ref = useRef()
  const normals = useLoader(THREE.TextureLoader, assetUrl('/textures/waternormals.jpg'))
  const geom = useMemo(() => new THREE.PlaneGeometry(8000, 8000), [])
  const config = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping
    return {
      textureWidth: COARSE ? 192 : 384,
      textureHeight: COARSE ? 192 : 384,
      waterNormals: normals,
      sunDirection: new THREE.Vector3(...SUN).normalize(),
      sunColor: 0xffffff,
      waterColor: AT.water,
      distortionScale: 3.2,
      fog: false,
    }
  }, [normals])

  useEffect(() => {
    const w = ref.current
    if (!w) return
    w.material.uniforms.size.value = 2
    // the sea draws the scene a second time for its reflection: skip the trees and grass there
    const original = w.onBeforeRender
    w.onBeforeRender = function (...args) {
      const hidden = [...HIDE_IN_REFLECTION].filter(Boolean)
      hidden.forEach((o) => (o.visible = false))
      original.apply(this, args)
      hidden.forEach((o) => (o.visible = true))
    }
    return () => {
      w.onBeforeRender = original
    }
  }, [])

  useFrame((_, delta) => {
    if (ref.current) ref.current.material.uniforms.time.value += delta * 0.5
  })

  return (
    <water ref={ref} args={[geom, config]} rotation-x={-Math.PI / 2} position={[0, -0.25, 0]} />
  )
}

function FlatOcean() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.25, 0]}>
      <planeGeometry args={[8000, 8000]} />
      <meshStandardMaterial color="#0b7a96" />
    </mesh>
  )
}

// turquoise lagoon in the middle of the island
function LagoonWater() {
  const normals = useLoader(THREE.TextureLoader, assetUrl('/textures/waternormals.jpg'))
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

function LagoonPlain() {
  return (
    <mesh geometry={GEO.lagoon} rotation-x={-Math.PI / 2} position-y={-0.05} renderOrder={5}>
      <meshStandardMaterial color="#2fd9c8" transparent opacity={0.72} depthWrite={false} />
    </mesh>
  )
}

// foam line that moves in and out at the shore
function Foam() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    const s = 1.06 + Math.sin(t * 0.9) * 0.025
    m.scale.set(s, s, 1)
    m.material.opacity = 0.32 + Math.sin(t * 0.9 + 1) * 0.12
  })
  return (
    <mesh ref={ref} geometry={GEO.foam} rotation-x={-Math.PI / 2} position-y={-0.14} renderOrder={4}>
      <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
    </mesh>
  )
}

/* ---------- soft white clouds (made on the fly, no files needed) ---------- */
function makeCloudTex() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  const r = rng(3)
  for (let i = 0; i < 28; i++) {
    const x = 70 + r() * 370
    const rad = 35 + r() * 55
    const y = 150 - Math.sin(((x - 70) / 370) * Math.PI) * 40 + (r() - 0.5) * 30
    const grad = g.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0, 'rgba(255,255,255,0.65)')
    grad.addColorStop(0.6, 'rgba(255,255,255,0.3)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, y, rad, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Clouds() {
  const group = useRef()
  const tex = useMemo(() => makeCloudTex(), [])
  const items = useMemo(() => {
    const r = rng(21)
    return Array.from({ length: 16 }, () => {
      const a = r() * Math.PI * 2
      const d = 900 + r() * 500
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: 120 + r() * 280, w: 380 + r() * 420 }
    })
  }, [])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.003
  })

  return (
    <group ref={group}>
      {items.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.w, c.w * 0.4, 1]}>
          <spriteMaterial map={tex} transparent depthWrite={false} fog={false} opacity={0.92} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}

/* ---------- realistic sand and grass ----------
   Needs these files in public/textures/ (Poly Haven, CC0, 1K JPG):
   sand_diff.jpg, sand_nor.jpg, sand_rough.jpg
   grass_diff.jpg, grass_nor.jpg, grass_rough.jpg */
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

// sets up a diffuse + normal + roughness texture set so it tiles nicely
function prepareTextures(gl, [diff, nor, rough], tile) {
  const aniso = gl.capabilities.getMaxAnisotropy()
  diff.colorSpace = THREE.SRGBColorSpace
  ;[diff, nor, rough].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / tile, 1 / tile)
    t.anisotropy = aniso // keeps the grain sharp at flat viewing angles
    t.needsUpdate = true
  })
}

function PlainSand() {
  return (
    <>
      <mesh geometry={GEO.wet} rotation-x={-Math.PI / 2} position-y={-0.08}>
        <meshStandardMaterial color="#e0c590" />
      </mesh>
      <mesh geometry={GEO.sand} rotation-x={-Math.PI / 2} position-y={0} receiveShadow={SHADOWS}>
        <meshStandardMaterial color="#f5e1b0" />
      </mesh>
    </>
  )
}

function TexturedSand() {
  const { gl } = useThree()
  const tex = useLoader(THREE.TextureLoader, [
    assetUrl('/textures/sand_diff.jpg'),
    assetUrl('/textures/sand_nor.jpg'),
    assetUrl('/textures/sand_rough.jpg'),
  ])
  const [diff, nor, rough] = tex
  const blotch = useMemo(() => makeBlotchTex(), [])
  useMemo(() => prepareTextures(gl, tex, SAND_TILE), [gl, tex])

  return (
    <>
      {/* wet sand at the edge (also the floor of the lagoon): same sand, darker */}
      <mesh geometry={GEO.wet} rotation-x={-Math.PI / 2} position-y={-0.08}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#b8a07c" roughness={0.8} />
      </mesh>
      {/* dry sand with a hole for the lagoon */}
      <mesh geometry={GEO.sand} rotation-x={-Math.PI / 2} position-y={0} receiveShadow={SHADOWS}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#ffffff" />
      </mesh>
      {/* big soft patches on top to break up the repeating pattern */}
      <mesh geometry={GEO.sand} rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={1}>
        <meshBasicMaterial map={blotch} transparent depthWrite={false} />
      </mesh>
    </>
  )
}

function SandSurface() {
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
      <mesh geometry={GEO.grass} rotation-x={-Math.PI / 2} position-y={0.03} receiveShadow={SHADOWS}>
        <meshStandardMaterial color="#5f8f3c" />
      </mesh>
      <mesh geometry={GEO.grass2} rotation-x={-Math.PI / 2} position-y={0.06} receiveShadow={SHADOWS}>
        <meshStandardMaterial color="#4a7a30" />
      </mesh>
    </>
  )
}

function TexturedGrass() {
  const { gl } = useThree()
  const tex = useLoader(THREE.TextureLoader, [
    assetUrl('/textures/grass_diff.jpg'),
    assetUrl('/textures/grass_nor.jpg'),
    assetUrl('/textures/grass_rough.jpg'),
  ])
  const [diff, nor, rough] = tex
  useMemo(() => prepareTextures(gl, tex, GRASS_TILE), [gl, tex])

  return (
    <>
      <mesh geometry={GEO.grass} rotation-x={-Math.PI / 2} position-y={0.03} receiveShadow={SHADOWS}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#ffffff" />
      </mesh>
      {/* the deeper jungle is a little darker */}
      <mesh geometry={GEO.grass2} rotation-x={-Math.PI / 2} position-y={0.06} receiveShadow={SHADOWS}>
        <meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#b9cc98" />
      </mesh>
    </>
  )
}

function GrassGround() {
  return (
    <Suspense fallback={<PlainGrass />}>
      <Safe fallback={<PlainGrass />}>
        <TexturedGrass />
      </Safe>
    </Suspense>
  )
}

/* ---------- real 3D grass blades, swaying in the wind (no files needed) ---------- */
function makeBladeGeometry() {
  // a tapered blade: 3 segments + a pointed tip, dark at the root and light at the tip
  const rows = [
    [0, 0.05],
    [0.22, 0.034],
  ]
  const pos = []
  const col = []
  const dark = new THREE.Color('#2b4716')
  const light = new THREE.Color('#a9cc55')
  rows.forEach(([y, w]) => {
    const c = dark.clone().lerp(light, y / 0.5)
    pos.push(-w, y, 0, w, y, 0)
    col.push(c.r, c.g, c.b, c.r, c.g, c.b)
  })
  pos.push(0, 0.5, 0)
  col.push(light.r, light.g, light.b)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4])
  g.computeVertexNormals()
  return g
}

function GrassBlades() {
  const ref = useRef()
  const time = useMemo(() => ({ value: 0 }), [])
  const geom = useMemo(() => makeBladeGeometry(), [])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = time
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float sway = sin(uTime * 1.7 + ip.x * 0.45 + ip.z * 0.33) * 0.07
                     + sin(uTime * 3.1 + ip.x * 1.3 + ip.z * 0.9) * 0.02;
          transformed.x += sway * position.y * 2.0;
          transformed.z += sway * 0.5 * position.y * 2.0;`
        )
    }
    return m
  }, [time])

  // scatter the blades in little tufts over the grass area (same every time)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const r = rng(77)
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    let n = 0
    while (n < GRASS_BLADES) {
      const a = r() * Math.PI * 2
      const lo = lagoonR(a) + 8
      const hi = grassR(a) - 0.5
      const d = Math.sqrt(lo * lo + r() * (hi * hi - lo * lo))
      const cx = Math.cos(a) * d
      const cz = Math.sin(a) * d
      if (Math.hypot(cx - SPAWN[0], cz - SPAWN[1]) < PLATFORM_R + 1.2) continue
      for (let k = 0; k < 6 && n < GRASS_BLADES; k++) {
        dummy.position.set(cx + (r() - 0.5) * 0.7, 0.04, cz + (r() - 0.5) * 0.7)
        dummy.rotation.set((r() - 0.5) * 0.25, r() * 6.28, (r() - 0.5) * 0.25)
        dummy.scale.set(1 + r() * 0.5, 0.7 + r() * 0.9, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(n, dummy.matrix)
        // a few dry, yellowish blades among the green ones
        if (r() < 0.12) color.setHSL(0.14, 0.5, 0.8)
        else color.setHSL(0.2 + r() * 0.1, 0.5, 0.75 + r() * 0.2)
        mesh.setColorAt(n, color)
        n++
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    HIDE_IN_REFLECTION.add(mesh)
    return () => HIDE_IN_REFLECTION.delete(mesh)
  }, [])

  useFrame((state) => {
    time.value = state.clock.elapsedTime
  })

  return <instancedMesh ref={ref} args={[geom, material, GRASS_BLADES]} frustumCulled={false} />
}

/* ---------- the sun: real light + shadows, a glowing disc and a lens flare ---------- */
function SunLight() {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight(AT.light, AT.lightI)
    l.castShadow = SHADOWS
    l.shadow.mapSize.set(2048, 2048)
    const sc = l.shadow.camera
    sc.left = -32
    sc.right = 32
    sc.top = 32
    sc.bottom = -32
    sc.near = 1
    sc.far = 260
    l.shadow.bias = -0.0004
    l.shadow.normalBias = 0.05
    return l
  }, [])

  // the shadow area follows the player, always lit from the direction of the visible sun
  useFrame(() => {
    const p = PLAYER.pos
    light.target.position.set(p.x, 0, p.z)
    light.position.set(p.x + LIGHT_DIR.x * 110, LIGHT_DIR.y * 110, p.z + LIGHT_DIR.z * 110)
    light.target.updateMatrixWorld()
  })

  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  )
}

function makeGlowTex(stops) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  stops.forEach(([o, col]) => grad.addColorStop(o, col))
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeRingTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(128, 128, 70, 128, 128, 126)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.7, 'rgba(255,255,255,0.35)')
  grad.addColorStop(0.9, 'rgba(255,255,255,0.12)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// the bright sun disc and its soft halo, far away in the sky
function SunGlow() {
  const halo = useMemo(
    () =>
      makeGlowTex([
        [0, 'rgba(255,246,220,0.9)'],
        [0.1, 'rgba(255,238,195,0.6)'],
        [0.3, 'rgba(255,218,160,0.22)'],
        [0.65, 'rgba(255,196,130,0.06)'],
        [1, 'rgba(255,196,130,0)'],
      ]),
    []
  )
  const core = useMemo(
    () =>
      makeGlowTex([
        [0, 'rgba(255,255,255,1)'],
        [0.4, 'rgba(255,253,240,1)'],
        [0.55, 'rgba(255,247,215,0.85)'],
        [1, 'rgba(255,240,200,0)'],
      ]),
    []
  )
  const p = useMemo(() => SUN_DIR.clone().multiplyScalar(1800).toArray(), [])
  const mat = { transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }
  return (
    <group position={p}>
      <sprite scale={[1400, 1400, 1]}>
        <spriteMaterial map={halo} {...mat} />
      </sprite>
      <sprite scale={[170, 170, 1]}>
        <spriteMaterial map={core} {...mat} />
      </sprite>
    </group>
  )
}

// camera lens flare: faint rings and glints that appear when you look toward the sun
// (built from simple sprites, no extra library needed)
function SunFlare() {
  const refs = useRef([])
  const glow = useMemo(
    () =>
      makeGlowTex([
        [0, 'rgba(255,255,255,0.9)'],
        [0.4, 'rgba(255,255,255,0.25)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    []
  )
  const ring = useMemo(() => makeRingTex(), [])
  // d = how far along the line through the screen centre, size = fraction of the screen height
  const items = useMemo(
    () => [
      { d: 0.3, size: 0.16, tex: ring, color: '#a07a45', op: 0.55 },
      { d: 0.55, size: 0.06, tex: glow, color: '#5b86b0', op: 0.6 },
      { d: 0.8, size: 0.3, tex: ring, color: '#8a7650', op: 0.45 },
      { d: 1.1, size: 0.12, tex: glow, color: '#b08358', op: 0.5 },
    ],
    [glow, ring]
  )
  const v = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }) => {
    v.copy(SUN_DIR).multiplyScalar(1800).project(camera) // the sun's spot on the screen
    camera.getWorldDirection(dir)
    const facing = dir.dot(SUN_DIR) > 0.2 // only when you look toward the sun
    const edge = Math.max(Math.abs(v.x), Math.abs(v.y))
    const strength = facing ? Math.max(0, 1 - edge * 0.9) : 0
    const dist = 60
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    items.forEach((it, i) => {
      const sprite = refs.current[i]
      if (!sprite) return
      const k = 1 - 2 * it.d
      sprite.position.set(v.x * k, v.y * k, 0.5).unproject(camera)
      sprite.position.sub(camera.position).normalize().multiplyScalar(dist).add(camera.position)
      const size = it.size * h
      sprite.scale.set(size, size, 1)
      sprite.material.opacity = it.op * strength
    })
  })

  return (
    <>
      {items.map((it, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} renderOrder={999}>
          <spriteMaterial
            map={it.tex}
            color={it.color}
            opacity={0}
            transparent
            depthTest={false}
            depthWrite={false}
            fog={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  )
}

/* ---------- the island ---------- */
function Island() {
  const shelf = { color: '#4fe3d2', transparent: true, opacity: 0.25, depthWrite: false }
  return (
    <>
      {/* shallow turquoise water around the island */}
      <mesh geometry={GEO.shelf3} rotation-x={-Math.PI / 2} position-y={-0.22} renderOrder={1}>
        <meshBasicMaterial {...shelf} />
      </mesh>
      <mesh geometry={GEO.shelf2} rotation-x={-Math.PI / 2} position-y={-0.2} renderOrder={2}>
        <meshBasicMaterial {...shelf} />
      </mesh>
      <mesh geometry={GEO.shelf1} rotation-x={-Math.PI / 2} position-y={-0.18} renderOrder={3}>
        <meshBasicMaterial {...shelf} />
      </mesh>

      <Foam />

      {/* sand and grass: real photo-scanned textures (plain colors if the files are missing) */}
      <SandSurface />
      <GrassGround />
      {/* thousands of real 3D grass blades that sway in the wind */}
      <GrassBlades />
    </>
  )
}

/* ---------- circular wooden stage ---------- */
function makeWoodTex() {
  const c = document.createElement('canvas')
  c.width = c.height = 1024
  const g = c.getContext('2d')
  const r = rng(5)
  const planks = 9
  const w = 1024 / planks
  for (let i = 0; i < planks; i++) {
    const v = Math.floor(r() * 26) - 13
    g.fillStyle = `rgb(${176 + v}, ${124 + Math.floor(v * 0.8)}, ${76 + Math.floor(v * 0.6)})`
    g.fillRect(i * w, 0, w, 1024)
    // grain
    for (let k = 0; k < 42; k++) {
      const x = i * w + r() * w
      g.strokeStyle = `rgba(90, 55, 28, ${0.1 + r() * 0.18})`
      g.lineWidth = 1 + r() * 2
      g.beginPath()
      g.moveTo(x, 0)
      g.bezierCurveTo(x + (r() - 0.5) * 14, 300, x + (r() - 0.5) * 14, 700, x + (r() - 0.5) * 8, 1024)
      g.stroke()
    }
    // a joint or two across the plank
    for (let j = 0; j < 2; j++) {
      g.fillStyle = 'rgba(45, 25, 10, 0.55)'
      g.fillRect(i * w, r() * 1000, w, 3)
    }
    // dark gap between planks
    g.fillStyle = 'rgba(35, 18, 8, 0.85)'
    g.fillRect(i * w - 2, 0, 4, 1024)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function Platform() {
  const wood = useMemo(() => makeWoodTex(), [])
  const shadow = useMemo(() => makeShadowTex(), [])
  return (
    <group position={[SPAWN[0], 0, SPAWN[1]]}>
      {/* soft contact shadow on the sand */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} renderOrder={6}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} opacity={0.8} />
      </mesh>
      {/* lower step */}
      <mesh position-y={0.075} castShadow={SHADOWS} receiveShadow={SHADOWS}>
        <cylinderGeometry args={[3.2, 3.25, 0.15, 64]} />
        <meshStandardMaterial attach="material-0" color="#6f4626" roughness={0.9} />
        <meshStandardMaterial attach="material-1" map={wood} roughness={0.85} />
        <meshStandardMaterial attach="material-2" color="#4a2e18" />
      </mesh>
      {/* upper stage */}
      <mesh position-y={0.225} castShadow={SHADOWS} receiveShadow={SHADOWS}>
        <cylinderGeometry args={[PLATFORM_R, PLATFORM_R + 0.05, 0.15, 64]} />
        <meshStandardMaterial attach="material-0" color="#7a4e2a" roughness={0.9} />
        <meshStandardMaterial attach="material-1" map={wood} roughness={0.8} />
        <meshStandardMaterial attach="material-2" color="#4a2e18" />
      </mesh>
      {/* rim */}
      <mesh rotation-x={Math.PI / 2} position-y={PLATFORM_H}>
        <torusGeometry args={[PLATFORM_R, 0.05, 8, 64]} />
        <meshStandardMaterial color="#5e3b1f" roughness={0.9} />
      </mesh>
    </group>
  )
}

/* ---------- plane with banner ---------- */
function FlyingPlane({ message }) {
  const ref = useRef()

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.x -= delta * 8
    if (ref.current.position.x < -150) ref.current.position.x = 150
  })

  // turned around so the banner faces you when you look at the sea
  return (
    <group ref={ref} position={[150, 11, 75]} rotation={[0, Math.PI, 0]} scale={2.4}>
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
      <group position={[-4.6, 0, 0]}>
        <mesh>
          <planeGeometry args={[7.2, 1]} />
          <meshBasicMaterial color="#fff8ec" />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.35}
          color="#333333"
          anchorX="center"
          anchorY="middle"
        >
          {message}
        </Text>
      </group>
    </group>
  )
}

/* ---------- billboard ---------- */
function PhotoFrame({ src, position }) {
  const [tex, setTex] = useState(null)

  useEffect(() => {
    let alive = true
    new THREE.TextureLoader().load(
      assetUrl(src),
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        if (alive) setTex(t)
      },
      undefined,
      (error) => {
        console.warn(`Optional billboard photo could not be loaded: ${src}`, error)
      }
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

function Billboard() {
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
      <mesh position={[0, 3.6, 0]} castShadow={SHADOWS}>
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

/* ---------- reception ---------- */
function Reception() {
  return (
    <group position={DESK_POS} rotation={[0, -2.0, 0]}>
      {/* receptionist sitting behind the desk (legs hidden under the sand) */}
      <Safe fallback={null}>
        <Character file="emma.gltf" height={RECEPTIONIST_HEIGHT} position={[0, -0.2, -0.8]} />
      </Safe>

      <mesh position={[0, 0.5, 0]} castShadow={SHADOWS} receiveShadow={SHADOWS}>
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

/* ---------- screen overlays ---------- */
const STAGES = [
  [0, 'Planting the palms'],
  [30, 'Filling the lagoon'],
  [60, 'Painting the sunset'],
  [90, 'Almost there'],
]

function Loader({ entered, onEnter }) {
  const { progress } = useProgress()
  const [late, setLate] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 20000) // never leave the visitor stuck on a slow connection
    return () => clearTimeout(t)
  }, [])
  const ready = progress >= 100 || late
  const stage = STAGES.filter((s) => progress >= s[0]).pop()[1]

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #2b1055 0%, #d4527a 60%, #ffb27a 100%)',
        color: '#fff',
        fontFamily: 'Georgia, serif',
        textAlign: 'center',
        padding: 20,
        opacity: entered ? 0 : 1,
        pointerEvents: entered ? 'none' : 'auto',
        transition: 'opacity 0.8s ease',
      }}
    >
      <div style={{ fontSize: 'clamp(30px, 6vw, 56px)', fontWeight: 700 }}>
        Ahmad Komail's World
      </div>
      <div style={{ opacity: 0.85, margin: '10px 0 28px' }}>
        A little island to get to know me
      </div>

      {!ready ? (
        <>
          <div
            style={{
              width: 'min(320px, 80vw)',
              height: 6,
              background: 'rgba(255,255,255,0.25)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: '#fff',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ marginTop: 12, fontSize: 14, opacity: 0.85 }}>
            {stage}… {Math.round(progress)}%
          </div>
        </>
      ) : (
        <button
          onClick={onEnter}
          style={{
            padding: '12px 32px',
            fontSize: 18,
            fontFamily: 'inherit',
            background: '#fff',
            color: '#2b1055',
            border: 'none',
            borderRadius: 999,
            cursor: 'pointer',
          }}
        >
          Enter the island
        </button>
      )}
    </div>
  )
}

/* ---------- customization panel ---------- */
const SKIN_TONES = ['#f6d5b8', '#e8b98f', SKIN_COLOR, '#b9794d', '#8d5a3a', '#5e3b25', '#3f2718']
const HAIR_COLORS = [null, '#1b1b1b', '#2b1b12', '#4a2c17', '#8a5a2b', '#d6a85b', '#b5322e', '#cfcfcf']
const COLORS = [
  '#e74c3c',
  '#f2994a',
  '#f2c94c',
  '#27ae60',
  '#2f80ed',
  '#9b51e0',
  '#f06ba8',
  '#222222',
  '#f5f5f5',
  '#8b5a2b',
]
const paletteFor = (kind) =>
  kind === 'skin' ? SKIN_TONES : kind === 'hair' ? HAIR_COLORS : [null, ...COLORS]

function Swatch({ color, active, onClick }) {
  return (
    <button
      type="button"
      aria-label={color || 'Original color'}
      title={color || 'Original color'}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        padding: 0,
        borderRadius: '50%',
        cursor: 'pointer',
        background: color || 'linear-gradient(135deg, #ffffff 0 46%, #9aa0a6 46% 54%, #ffffff 54%)',
        border: active ? '3px solid #fff' : '2px solid rgba(255,255,255,0.35)',
        boxShadow: active ? '0 0 0 2px #ff7a59' : 'none',
      }}
    />
  )
}

function Row({ label, right, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8 }}>
          {label}
        </div>
        {right}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  )
}

const pill = (on) => ({
  padding: '6px 14px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.5)',
  background: on ? '#fff' : 'transparent',
  color: on ? '#1c2a3a' : '#fff',
  fontSize: 13,
  cursor: 'pointer',
})

function CustomizePanel({ show, narrow, parts, look, charFile, loading, onPick, onColor, onToggle, onStart }) {
  const sheet = narrow
    ? { left: 0, right: 0, bottom: 0, maxHeight: '52dvh', borderRadius: '20px 20px 0 0' }
    : {
        right: '4vw',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 'min(340px, 36vw)',
        maxHeight: '90dvh',
        borderRadius: 20,
      }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.6s ease 0.3s',
      }}
    >
      <div
        style={{
          position: 'absolute',
          pointerEvents: show ? 'auto' : 'none',
          overflowY: 'auto',
          padding: '20px 20px calc(18px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
          background: 'rgba(18, 28, 40, 0.55)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          touchAction: 'pan-y',
          ...sheet,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Create your character</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 16 }}>
          Pick a character, drag the stage to turn around, then explore the island.
        </div>

        {CHARACTERS.length > 1 && (
          <Row label="Character">
            {CHARACTERS.map((c) => (
              <button key={c.file} type="button" style={pill(c.file === charFile)} onClick={() => onPick(c.file)}>
                {c.name}
              </button>
            ))}
          </Row>
        )}

        {loading && <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>Loading character…</div>}

        {parts.map((p) => (
          <Row
            key={p.key}
            label={p.label}
            right={
              p.kind === 'hat' ? (
                <button type="button" style={pill(!look.hidden[p.key])} onClick={() => onToggle(p.key)}>
                  {look.hidden[p.key] ? 'Off' : 'On'}
                </button>
              ) : null
            }
          >
            {paletteFor(p.kind).map((c) => (
              <Swatch
                key={c || 'original'}
                color={c}
                active={(look.colors[p.key] ?? (p.kind === 'skin' ? SKIN_COLOR : null)) === c}
                onClick={() => onColor(p.key, c)}
              />
            ))}
          </Row>
        ))}

        <button
          type="button"
          onClick={onStart}
          disabled={loading}
          style={{
            width: '100%',
            marginTop: 6,
            padding: '13px 0',
            fontSize: 17,
            fontWeight: 600,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #ff9966, #ff5e62)',
            boxShadow: '0 6px 18px rgba(255, 94, 98, 0.45)',
            opacity: loading ? 0.5 : 1,
          }}
        >
          Start exploring →
        </button>
      </div>
    </div>
  )
}

function PaperCard({ show, touch }) {
  // on phones the card sits at the top so it never hides the joystick
  const place = touch ? { top: 'calc(14px + env(safe-area-inset-top, 0px))' } : { bottom: 30 }
  const hidden = touch ? -20 : 20
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        ...place,
        transform: `translateX(-50%) translateY(${show ? 0 : hidden}px)`,
        opacity: show ? 1 : 0,
        transition: 'all 0.35s ease',
        pointerEvents: 'none',
        width: 'min(560px, 92vw)',
        maxHeight: touch ? '46dvh' : 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        background: '#fffaf0',
        color: '#2b2b2b',
        padding: touch ? '14px 16px' : '20px 24px',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ fontSize: touch ? 18 : 22, fontWeight: 700, marginBottom: 8 }}>{ABOUT_TITLE}</div>
      <div style={{ fontSize: touch ? 13 : 16, lineHeight: 1.5 }}>{ABOUT_TEXT}</div>
    </div>
  )
}

function Hint({ show, touch }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(16px + env(safe-area-inset-top, 0px))',
        left: 16,
        right: touch ? 16 : 'auto',
        padding: '8px 14px',
        background: 'rgba(0,0,0,0.45)',
        color: '#fff',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
        fontSize: touch ? 12 : 14,
        opacity: show ? 1 : 0,
        transition: 'opacity 0.8s ease 0.8s',
        pointerEvents: 'none',
      }}
    >
      {touch
        ? 'Left stick: walk · hold RUN: run · drag screen: look · pinch: zoom'
        : 'W A S D / arrows: walk · Shift: run · drag mouse: look · scroll: zoom'}
    </div>
  )
}

/* ---------- phone controls: joystick + run button ---------- */
function Joystick() {
  const base = useRef()
  const active = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const R = 46

  const update = (e) => {
    const b = base.current.getBoundingClientRect()
    let dx = e.clientX - (b.left + b.width / 2)
    let dy = e.clientY - (b.top + b.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx *= R / d
      dy *= R / d
    }
    setKnob({ x: dx, y: dy })
    const nx = dx / R
    const ny = -dy / R
    if (Math.hypot(nx, ny) < 0.15) {
      INPUT.x = 0
      INPUT.y = 0
    } else {
      INPUT.x = nx
      INPUT.y = ny
    }
  }
  const end = (e) => {
    if (e.pointerId !== active.current) return
    active.current = null
    INPUT.x = 0
    INPUT.y = 0
    setKnob({ x: 0, y: 0 })
  }

  return (
    <div
      ref={base}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        active.current = e.pointerId
        update(e)
      }}
      onPointerMove={(e) => e.pointerId === active.current && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: 'absolute',
        left: 'calc(22px + env(safe-area-inset-left, 0px))',
        bottom: 'calc(30px + env(safe-area-inset-bottom, 0px))',
        width: 128,
        height: 128,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
        border: '2px solid rgba(255,255,255,0.45)',
        touchAction: 'none',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 64 - 28 + knob.x,
          top: 64 - 28 + knob.y,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.75)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function RunButton() {
  const [on, setOn] = useState(false)
  const set = (v) => {
    INPUT.run = v
    setOn(v)
  }
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      style={{
        position: 'absolute',
        right: 'calc(26px + env(safe-area-inset-right, 0px))',
        bottom: 'calc(48px + env(safe-area-inset-bottom, 0px))',
        width: 84,
        height: 84,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.6)',
        background: on ? 'rgba(255,94,98,0.85)' : 'rgba(255,255,255,0.2)',
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        touchAction: 'none',
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      RUN
    </button>
  )
}

function TouchControls({ show }) {
  useEffect(() => {
    if (!show) {
      INPUT.x = 0
      INPUT.y = 0
      INPUT.run = false
    }
  }, [show])
  if (!show) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Joystick />
      <RunButton />
    </div>
  )
}

function useNarrow() {
  const get = () => isNarrow(window.innerWidth, window.innerHeight)
  const [narrow, setNarrow] = useState(get)
  useEffect(() => {
    const onResize = () => setNarrow(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}

// show the touch controls on phones/tablets (or the first time a finger touches the screen)
function useTouchUI() {
  const [touch, setTouch] = useState(COARSE)
  useEffect(() => {
    const on = () => setTouch(true)
    window.addEventListener('touchstart', on, { once: true, passive: true })
    return () => window.removeEventListener('touchstart', on)
  }, [])
  return touch
}

/* ---------- app ---------- */
export default function App() {
  const [phase, setPhase] = useState('loading') // loading -> customize -> play
  const [nearDesk, setNearDesk] = useState(false)
  const [charFile, setCharFile] = useState(CHARACTERS[0].file)
  const [parts, setParts] = useState([])
  const [look, setLook] = useState({ colors: {}, hidden: {} })
  const [charLoading, setCharLoading] = useState(false)
  const [dpr, setDpr] = useState(MAX_DPR)
  const narrow = useNarrow()
  const touch = useTouchUI()
  const onReady = useCallback(() => setCharLoading(false), [])

  // once the customize screen is open, quietly load the other characters in the background
  useEffect(() => {
    if (phase !== 'customize') return
    const t = setTimeout(() => CHARACTERS.forEach((c) => preloadCharacter(c.file)), 400)
    return () => clearTimeout(t)
  }, [phase])

  const pickCharacter = (file) => {
    if (file === charFile) return
    setCharLoading(true)
    setParts([])
    setLook({ colors: {}, hidden: {} })
    setCharFile(file)
  }
  const setColor = (key, c) => setLook((l) => ({ ...l, colors: { ...l.colors, [key]: c } }))
  const toggleHidden = (key) =>
    setLook((l) => ({ ...l, hidden: { ...l.hidden, [key]: !l.hidden[key] } }))

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <Canvas
        shadows={SHADOWS}
        dpr={dpr}
        camera={{ position: [0.4, 1.7, 36.5], fov: 35, near: 0.5, far: 4000 }}
      >
        <Sky
          sunPosition={SUN}
          turbidity={AT.sky.turbidity}
          rayleigh={AT.sky.rayleigh}
          mieCoefficient={AT.sky.mie}
          mieDirectionalG={AT.sky.g}
        />
        {/* if the frame rate drops, lower the sharpness a little so it stays smooth */}
        <PerformanceMonitor
          onChange={({ factor }) => setDpr(Math.max(0.75, Math.round(MAX_DPR * (0.6 + 0.4 * factor) * 20) / 20))}
        />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#cfe6ff', '#8a9a55', 1.0]} />
        <SunLight />
        <SunGlow />
        {!COARSE && (
          <Safe fallback={null}>
            <SunFlare />
          </Safe>
        )}

        {AT.clouds && <Clouds />}
        <Island />
        <Platform />

        <Suspense fallback={null}>
          <Safe fallback={<FlatOcean />}>
            <Ocean />
          </Safe>
          <Safe fallback={<LagoonPlain />}>
            <LagoonWater />
          </Safe>
          <Safe fallback={null}>
            <Forest />
          </Safe>
          <Billboard />
          <Reception />
          <Suspense fallback={null}>
            {/* if a character file fails to load, a simple built-in one is used so the game still works */}
            <Safe
              key={charFile}
              fallback={
                <Player
                  key="fallback"
                  phase={phase}
                  file="daniel.gltf"
                  look={look}
                  onParts={setParts}
                  onNearDesk={setNearDesk}
                  onReady={onReady}
                />
              }
            >
              <Player
                key={charFile}
                phase={phase}
                file={charFile}
                look={look}
                onParts={setParts}
                onNearDesk={setNearDesk}
                onReady={onReady}
              />
            </Safe>
          </Suspense>
          <FlyingPlane message={PLANE_MESSAGE} />
        </Suspense>
      </Canvas>

      <PaperCard show={phase === 'play' && nearDesk} touch={touch} />
      <Hint show={phase === 'play'} touch={touch} />
      <TouchControls show={touch && phase === 'play'} />
      <CustomizePanel
        show={phase === 'customize'}
        narrow={narrow}
        parts={parts}
        look={look}
        charFile={charFile}
        loading={charLoading}
        onPick={pickCharacter}
        onColor={setColor}
        onToggle={toggleHidden}
        onStart={() => setPhase('play')}
      />
      <Loader entered={phase !== 'loading'} onEnter={() => setPhase('customize')} />
    </div>
  )
}