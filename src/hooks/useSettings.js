import { useCallback, useEffect, useState } from 'react'

const KEY = 'islandSettings'

const isTouchDevice = () => {
  if (typeof window === 'undefined') return false
  if (window.matchMedia) return window.matchMedia('(pointer: coarse)').matches
  return (window.navigator.maxTouchPoints || 0) > 0
}

const defaults = () => ({
  cameraMode: 'third', // 'first' | 'third'
  sensitivity: 1, // mouse / touch look speed
  distance: 8, // third-person camera distance
  lockMouse: true, // first person: click to lock the mouse
  touchControls: isTouchDevice(), // on-screen joystick and buttons
})

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return {
      ...defaults(),
      ...(raw ? JSON.parse(raw) : {}),
      touchControls: isTouchDevice(),
    }
  } catch {
    return defaults()
  }
}

// All game settings live here and are remembered between visits.
// update({ key: value }) or update((current) => ({ key: value }))
export function useSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // storage can be blocked (private mode): the settings just won't be remembered
    }
  }, [settings])

  const update = useCallback(
    (patch) => setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })),
    []
  )
  return [settings, update]
}
