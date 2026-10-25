import { useEffect, useState } from 'react'

export const isNarrow = (w, h) => w / h < 1.05 || w < 720

export function useNarrow() {
  const get = () => isNarrow(window.innerWidth, window.innerHeight)
  const [narrow, setNarrow] = useState(get)
  useEffect(() => {
    const onResize = () => setNarrow(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return narrow
}
