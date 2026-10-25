import { CHARACTERS } from '../config/CharacterConfig'
import { paletteFor } from '../player/customization'

/* ---------- customization panel ---------- */
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
  padding: '4px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.5)',
  background: on ? '#fff' : 'transparent',
  color: on ? '#1c2a3a' : '#fff',
  fontSize: 12,
  cursor: 'pointer',
})

export function CustomizePanel({ show, narrow, parts, look, charFile, onPick, onColor, onToggle, onStart }) {
  const sheet = narrow
    ? { left: 0, right: 0, bottom: 0, maxHeight: '52vh', borderRadius: '20px 20px 0 0' }
    : {
        right: '4vw',
        top: '50%',
        transform: 'translateY(-50%)',
        width: 'min(340px, 36vw)',
        maxHeight: '90vh',
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
          padding: '20px 20px 18px',
          boxSizing: 'border-box',
          background: 'rgba(18, 28, 40, 0.55)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          ...sheet,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>Create your character</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 16 }}>
          Pick a look, drag the stage to turn around, then explore the island.
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
                active={(look.colors[p.key] ?? null) === c}
                onClick={() => onColor(p.key, c)}
              />
            ))}
          </Row>
        ))}

        <button
          type="button"
          onClick={onStart}
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
          }}
        >
          Start exploring →
        </button>
      </div>
    </div>
  )
}
