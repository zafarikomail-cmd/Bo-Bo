import { useEffect, useRef, useState } from 'react'
import { controls, resetControls } from '../systems/Controls'

const R = 56 // how far the joystick knob can move (px)

const noSelect = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  touchAction: 'none',
}

function Joystick() {
  const base = useRef()
  const id = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  const update = (e) => {
    const box = base.current.getBoundingClientRect()
    let dx = e.clientX - (box.left + box.width / 2)
    let dy = e.clientY - (box.top + box.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) {
      dx = (dx / d) * R
      dy = (dy / d) * R
    }
    setKnob({ x: dx, y: dy })
    controls.moveX = dx / R
    controls.moveY = -dy / R
  }
  const down = (e) => {
    if (id.current !== null) return
    id.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    update(e)
  }
  const move = (e) => {
    if (e.pointerId === id.current) update(e)
  }
  const end = (e) => {
    if (e.pointerId !== id.current) return
    id.current = null
    setKnob({ x: 0, y: 0 })
    controls.moveX = 0
    controls.moveY = 0
  }

  return (
    <div
      ref={base}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'absolute',
        left: 'calc(24px + env(safe-area-inset-left, 0px))',
        bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        width: R * 2 + 28,
        height: R * 2 + 28,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)',
        border: '2px solid rgba(255,255,255,0.35)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        ...noSelect,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 56,
          height: 56,
          marginLeft: -28,
          marginTop: -28,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.65)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function RoundButton({ label, active, onDown, onUp }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onDown && onDown()
      }}
      onPointerUp={() => onUp && onUp()}
      onPointerCancel={() => onUp && onUp()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: 60,
        height: 60,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.45)',
        background: active ? 'rgba(255,122,89,0.85)' : 'rgba(18,28,40,0.5)',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        padding: 0,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        ...noSelect,
      }}
    >
      {label}
    </button>
  )
}

export function TouchControls({ show, crouch, firstPerson, onToggleCrouch, onToggleCamera }) {
  const [running, setRunning] = useState(false)
  const [jumping, setJumping] = useState(false)

  // never leave the character walking if the controls disappear
  useEffect(() => {
    if (!show) {
      resetControls()
      setRunning(false)
      setJumping(false)
    }
    return resetControls
  }, [show])

  if (!show) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto' }}>
        <Joystick />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 'calc(20px + env(safe-area-inset-right, 0px))',
          bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'auto',
        }}
      >
        <RoundButton label={firstPerson ? '1st' : '3rd'} onDown={onToggleCamera} />
        <RoundButton label="Crouch" active={crouch} onDown={onToggleCrouch} />
        <RoundButton
          label="Jump"
          active={jumping}
          onDown={() => {
            controls.jump = true
            setJumping(true)
          }}
          onUp={() => {
            controls.jump = false
            setJumping(false)
          }}
        />
        <RoundButton
          label="Run"
          active={running}
          onDown={() => {
            controls.run = true
            setRunning(true)
          }}
          onUp={() => {
            controls.run = false
            setRunning(false)
          }}
        />
      </div>
    </div>
  )
}
