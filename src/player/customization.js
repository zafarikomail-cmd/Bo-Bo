import { SKIN_COLOR } from '../config/CharacterConfig'

/* ---------- character customization: find the colorable parts ---------- */
const IGNORE_PART = /eye|teeth|tooth|mouth|tongue|pupil|iris|lash/i
const PART_RULES = [
  ['skin', /skin|body|head|face/i, 'Skin tone'],
  ['hair', /hair|beard|mustache|moustache|brow/i, 'Hair'],
  ['hat', /hat|cap|helmet|hood|beanie/i, 'Hat'],
  ['shoes', /shoe|boot|feet|foot|sneaker/i, 'Shoes'],
  ['pants', /pant|trouser|jean|short|leg|skirt|bottom/i, 'Pants'],
  ['outfit', /shirt|top|torso|jacket|vest|coat|suit|dress|cloth|sweater|hoodie/i, 'Outfit'],
]
const PART_ORDER = ['skin', 'hair', 'hat', 'outfit', 'pants', 'shoes', 'color']

export function detectParts(root) {
  const byKey = new Map()
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach((m) => {
      if (!m.color) return
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

/* ---------- colour palettes used by the customization panel ---------- */
const SKIN_TONES = [null, '#f6d5b8', '#e8b98f', SKIN_COLOR, '#b9794d', '#8d5a3a', '#5e3b25', '#3f2718']
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
export const paletteFor = (kind) =>
  kind === 'skin' ? SKIN_TONES : kind === 'hair' ? HAIR_COLORS : [null, ...COLORS]
