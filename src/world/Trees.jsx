import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { modelUrl } from '../utils/assetUtils'
import { FOREST } from './forestData'

const TREE_BATCH_SIZE = 8

export function Tree({ file, position, scale = 1, rotation = 0 }) {
  const { scene } = useGLTF(modelUrl(file))
  const copy = useMemo(() => scene.clone(), [scene])
  return <primitive object={copy} position={position} scale={scale} rotation={[0, rotation, 0]} />
}

export function Forest() {
  const [visibleCount, setVisibleCount] = useState(Math.min(TREE_BATCH_SIZE, FOREST.length))

  useEffect(() => {
    if (visibleCount >= FOREST.length) return
    let cancelled = false
    let idleId
    let timeoutId
    const addBatch = () => {
      if (!cancelled) {
        setVisibleCount((count) => Math.min(count + TREE_BATCH_SIZE, FOREST.length))
      }
    }
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(addBatch, { timeout: 1000 })
    } else {
      timeoutId = window.setTimeout(addBatch, 50)
    }
    return () => {
      cancelled = true
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [visibleCount])

  return FOREST.slice(0, visibleCount).map((t, i) => (
    <Tree key={i} file={t.file} position={[t.x, 0, t.z]} scale={t.scale} rotation={t.rot} />
  ))
}
