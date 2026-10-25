import { ABOUT_TITLE, ABOUT_TEXT } from '../config/GameConfig'

export function PaperCard({ show }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 30,
        transform: `translateX(-50%) translateY(${show ? 0 : 20}px)`,
        opacity: show ? 1 : 0,
        transition: 'all 0.35s ease',
        pointerEvents: 'none',
        width: 'min(560px, 90vw)',
        background: '#fffaf0',
        color: '#2b2b2b',
        padding: '20px 24px',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{ABOUT_TITLE}</div>
      <div style={{ fontSize: 16, lineHeight: 1.5 }}>{ABOUT_TEXT}</div>
    </div>
  )
}

export function Hint({ show }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        padding: '8px 14px',
        background: 'rgba(0,0,0,0.45)',
        color: '#fff',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        opacity: show ? 1 : 0,
        transition: 'opacity 0.8s ease 0.8s',
        pointerEvents: 'none',
      }}
    >
      W A S D / arrows: walk · Shift: run · Space / Jump: jump · C: crouch · drag mouse: look · scroll: zoom
    </div>
  )
}

// a small red message if one of your model files could not be loaded
export function Notice({ lines }) {
  if (!lines.length) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        maxWidth: 'min(520px, 90vw)',
        padding: '10px 14px',
        background: 'rgba(160, 30, 30, 0.92)',
        color: '#fff',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        lineHeight: 1.4,
        pointerEvents: 'none',
      }}
    >
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
      <div style={{ opacity: 0.8, marginTop: 4 }}>
        Model files are organized under public/models by category; keep each file path and capitalization exact. Press F12 for details.
      </div>
    </div>
  )
}
