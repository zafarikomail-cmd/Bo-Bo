import { Suspense, useCallback, useEffect, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useLoader } from '@react-three/fiber'
import { Sky, useGLTF, useFBX } from '@react-three/drei'

import { AT, SUN, PLANE_FILE, PLANE_MESSAGE } from './config/GameConfig'
import { ANIM_FILES, CHARACTERS } from './config/CharacterConfig'
import { useSettings } from './hooks/useSettings'
import { BASE, isFbx, modelUrl } from './utils/assetUtils'

import { Safe } from './components/Safe'
import { LoadingScreen } from './components/LoadingScreen'
import { PaperCard, Hint, Notice } from './components/HUD'
import { SettingsMenu } from './components/SettingsPanel'
import { TouchControls } from './components/TouchControls'

import { Island } from './world/Island'
import { Platform } from './world/Platform'
import { Forest } from './world/Trees'
import { Billboard } from './world/Billboard'
import { Reception } from './world/Reception'
import { Ocean, FlatOcean, LagoonWater, LagoonPlain } from './scenes/Ocean'
import { Clouds } from './scenes/Clouds'
import { FlyingPlane } from './vehicles/Airplane'
import { Player } from './player/Player'

// the player always uses the first character in CharacterConfig
const CHARACTER_FILE = CHARACTERS[0].file

// Start only the assets required for the player and playable island while React mounts the scene.
if (isFbx(CHARACTER_FILE)) {
  useFBX.preload(modelUrl(CHARACTER_FILE))
  Object.values(ANIM_FILES).forEach((file) => useFBX.preload(modelUrl(file)))
} else {
  useGLTF.preload(modelUrl(CHARACTER_FILE))
}
useLoader.preload(THREE.TextureLoader, [
  BASE + 'textures/sand_diff.jpg',
  BASE + 'textures/sand_nor.jpg',
  BASE + 'textures/sand_rough.jpg',
  BASE + 'textures/grass_diff.jpg',
  BASE + 'textures/grass_nor.jpg',
  BASE + 'textures/grass_rough.jpg',
  BASE + 'textures/waternormals.jpg',
])

/* ---------- app ---------- */
export default function App() {
  const [phase, setPhase] = useState('loading') // loading -> play (starts by itself when loaded)
  const [rendererReady, setRendererReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [detailsReady, setDetailsReady] = useState(false)
  const [receptionistRequested, setReceptionistRequested] = useState(false)
  const [nearDesk, setNearDesk] = useState(false)
  const [notes, setNotes] = useState([])
  const [settings, updateSettings] = useSettings()
  const [crouch, setCrouch] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const note = (msg) => setNotes((n) => (n.includes(msg) ? n : [...n, msg]))
  const startGame = useCallback(() => setPhase('play'), [])
  const markPlayerReady = useCallback(() => setPlayerReady(true), [])
  const markRendererReady = useCallback(() => setRendererReady(true), [])
  const onNearDesk = useCallback((isNear) => {
    setNearDesk(isNear)
    if (isNear) setReceptionistRequested(true)
  }, [])

  const toggleCamera = useCallback(
    () => updateSettings((s) => ({ cameraMode: s.cameraMode === 'first' ? 'third' : 'first' })),
    [updateSettings]
  )
  const toggleCrouch = useCallback(() => setCrouch((c) => !c), [])

  // keyboard shortcuts: V = camera, C = crouch, Esc = close settings
  useEffect(() => {
    const onKey = (e) => {
      if (phase !== 'play' || e.repeat) return
      if (e.code === 'KeyV') toggleCamera()
      else if (e.code === 'KeyC') toggleCrouch()
      else if (e.code === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, toggleCamera, toggleCrouch])

  // Secondary scenery and characters are not prerequisites for player input.
  // Start them once gameplay has committed, during an idle browser period.
  useEffect(() => {
    if (phase !== 'play') return
    let cancelled = false
    let idleId
    let timeoutId
    const loadDetails = () => {
      if (!cancelled) setDetailsReady(true)
    }
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(loadDetails, { timeout: 5000 })
    } else {
      timeoutId = window.setTimeout(loadDetails, 0)
    }
    return () => {
      cancelled = true
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [phase])

  const playerProps = {
    phase,
    settings,
    crouch,
    paused: settingsOpen,
    onNearDesk,
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <Canvas
        camera={{ position: [0.4, 1.7, 36.5], fov: 35, near: 0.5, far: 4000 }}
        onCreated={markRendererReady}
      >
        <Sky
          sunPosition={SUN}
          turbidity={AT.sky.turbidity}
          rayleigh={AT.sky.rayleigh}
          mieCoefficient={AT.sky.mie}
          mieDirectionalG={AT.sky.g}
        />
        <ambientLight intensity={0.9} />
        <directionalLight position={AT.lightPos} intensity={AT.lightI} color={AT.light} />

        {AT.clouds && <Clouds />}

        <Suspense fallback={null}>
          <Island />
          <Platform />
          <Safe fallback={<FlatOcean />}>
            <Ocean />
          </Safe>
          <Safe fallback={<LagoonPlain />}>
            <LagoonWater />
          </Safe>
          {/* The configured character is required; use Daniel if it fails to load. */}
          <Safe
            onError={() => note(`Could not load ${CHARACTER_FILE} (or one of the animation files).`)}
            fallback={
              CHARACTER_FILE === 'characters/daniel.gltf' ? null : (
                <Safe
                  onError={() => note('Could not load the Daniel fallback character.')}
                  fallback={null}
                >
                  <Player {...playerProps} file="characters/daniel.gltf" onReady={markPlayerReady} />
                </Safe>
              )
            }
          >
            <Player {...playerProps} file={CHARACTER_FILE} onReady={markPlayerReady} />
          </Safe>
        </Suspense>

        {detailsReady && (
          <>
            <Suspense fallback={null}>
              <Safe fallback={null}>
                <Forest />
              </Safe>
            </Suspense>
            <Billboard />
            <Suspense fallback={null}>
              <Reception onError={note} showCharacter={receptionistRequested} />
            </Suspense>
            <Suspense fallback={null}>
              <FlyingPlane message={PLANE_MESSAGE} onError={() => note(`Could not load ${PLANE_FILE}.`)} />
            </Suspense>
          </>
        )}
      </Canvas>

      <PaperCard show={phase === 'play' && nearDesk} />
      <Hint show={phase === 'play' && !settings.touchControls} />
      <Notice lines={notes} />
      <TouchControls
        show={phase === 'play' && settings.touchControls && !settingsOpen}
        crouch={crouch}
        firstPerson={settings.cameraMode === 'first'}
        onToggleCrouch={toggleCrouch}
        onToggleCamera={toggleCamera}
      />
      <SettingsMenu
        show={phase === 'play'}
        open={settingsOpen}
        onOpen={() => setSettingsOpen(true)}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
      />
      <LoadingScreen
        entered={phase !== 'loading'}
        rendererReady={rendererReady}
        playerReady={playerReady}
        onReady={startGame}
      />
    </div>
  )
}