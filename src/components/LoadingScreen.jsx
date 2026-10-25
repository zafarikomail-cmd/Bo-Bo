import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'

export function LoadingScreen({ entered, rendererReady, playerReady, onReady }) {
  const { active, errors, item, loaded } = useProgress()
  const ready = rendererReady && playerReady && !active
  const failedPlayer = !active && errors.length > 0 && !playerReady
  let status = 'Preparing game assets'
  if (ready) status = 'Ready to explore'
  else if (failedPlayer) status = 'The player could not be loaded'
  else if (!rendererReady) status = 'Starting the renderer'
  else if (active) {
    const currentAsset = item ? item.split('/').pop() : 'game assets'
    status = `Loading ${currentAsset} · ${loaded} files loaded`
  } else if (playerReady) status = 'Preparing the island'

  useEffect(() => {
    if (ready && !entered) onReady()
  }, [ready, entered, onReady])

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
          className={ready || failedPlayer ? '' : 'loading-indeterminate'}
          style={{
            width: ready ? '100%' : failedPlayer ? '0%' : '30%',
            height: '100%',
            background: '#fff',
          }}
        />
      </div>
      <div style={{ marginTop: 12, fontSize: 14, opacity: 0.85 }}>
        {status}{ready ? '… 100%' : '…'}
      </div>
      {failedPlayer && (
        <>
          <div role="alert" style={{ marginTop: 12, fontSize: 13, maxWidth: 420 }}>
            {errors[0]}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 14, padding: '8px 14px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </>
      )}
    </div>
  )
}
