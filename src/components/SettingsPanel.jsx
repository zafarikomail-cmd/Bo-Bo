// Gear button + settings panel. Every game setting goes in here.

const pill = (on) => ({
  padding: '6px 14px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.5)',
  background: on ? '#fff' : 'transparent',
  color: on ? '#1c2a3a' : '#fff',
  fontSize: 13,
  cursor: 'pointer',
})

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8, marginBottom: 8 }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Slider({ value, min, max, step, onChange, format }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#ff7a59' }}
      />
      <span style={{ width: 40, textAlign: 'right', fontSize: 13 }}>{format(value)}</span>
    </div>
  )
}

function Toggle({ label, on, onClick }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <button type="button" style={pill(on)} onClick={onClick}>
        {on ? 'On' : 'Off'}
      </button>
    </div>
  )
}

const KEYS = [
  ['W A S D / arrows', 'Move'],
  ['Shift', 'Run'],
  ['Space / Jump button', 'Jump'],
  ['C', 'Crouch'],
  ['V', 'First / third person'],
  ['1 / 2', 'Select pistol / AKM (first person)'],
  ['Mouse', 'Look (drag, or click to lock in first person)'],
  ['Left click', 'Shoot (first person)'],
  ['R', 'Reload (first person)'],
  ['Q / E', 'Turn the camera'],
  ['Scroll', 'Zoom (third person)'],
  ['Esc', 'Release the mouse'],
]

export function SettingsMenu({ show, open, onOpen, onClose, settings, onChange }) {
  if (!show) return null
  return (
    <>
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        onClick={onOpen}
        style={{
          position: 'absolute',
          top: 'calc(14px + env(safe-area-inset-top, 0px))',
          right: 'calc(14px + env(safe-area-inset-right, 0px))',
          width: 46,
          height: 46,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.35)',
          background: 'rgba(18,28,40,0.55)',
          color: '#fff',
          fontSize: 22,
          cursor: 'pointer',
          padding: 0,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        ⚙
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={onClose}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(400px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              padding: '20px 22px',
              borderRadius: 20,
              background: 'rgba(18, 28, 40, 0.88)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.18)',
              boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
              color: '#fff',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>Settings</div>
              <button
                type="button"
                aria-label="Close settings"
                onClick={onClose}
                style={{ ...pill(false), padding: '4px 12px', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <Section title="Camera">
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={pill(settings.cameraMode === 'first')}
                  onClick={() => onChange({ cameraMode: 'first' })}
                >
                  First person
                </button>
                <button
                  type="button"
                  style={pill(settings.cameraMode === 'third')}
                  onClick={() => onChange({ cameraMode: 'third' })}
                >
                  Third person
                </button>
              </div>
            </Section>

            <Section title="Look speed">
              <Slider
                value={settings.sensitivity}
                min={0.3}
                max={2.5}
                step={0.1}
                format={(v) => v.toFixed(1) + '×'}
                onChange={(v) => onChange({ sensitivity: v })}
              />
            </Section>

            {settings.cameraMode === 'third' && (
              <Section title="Camera distance">
                <Slider
                  value={settings.distance}
                  min={4}
                  max={16}
                  step={0.5}
                  format={(v) => v.toFixed(1)}
                  onChange={(v) => onChange({ distance: v })}
                />
              </Section>
            )}

            <Section title="Controls">
              <Toggle
                label="Click to lock mouse (first person)"
                on={settings.lockMouse}
                onClick={() => onChange({ lockMouse: !settings.lockMouse })}
              />
              <Toggle
                label="On-screen touch controls"
                on={settings.touchControls}
                onClick={() => onChange({ touchControls: !settings.touchControls })}
              />
            </Section>

            <Section title="Keyboard & mouse">
              {KEYS.map(([k, what]) => (
                <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13, marginBottom: 5, opacity: 0.9 }}>
                  <span style={{ width: 120, flexShrink: 0, fontWeight: 600 }}>{k}</span>
                  <span>{what}</span>
                </div>
              ))}
            </Section>
          </div>
        </div>
      )}
    </>
  )
}
