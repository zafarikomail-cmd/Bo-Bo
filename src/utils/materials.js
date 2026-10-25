import { SKIN_COLOR } from '../config/CharacterConfig'

export function fixMaterials(scene, label, skin = SKIN_COLOR) {
  const seen = new Set()
  scene.traverse((o) => {
    if (!o.isMesh || !o.material) return
    o.frustumCulled = false // animated bodies can leave their starting bounds and vanish
    const list = Array.isArray(o.material) ? o.material : [o.material]
    list.forEach((m) => {
      if (m.metalness !== undefined) m.metalness = 0
      if (m.roughness !== undefined) m.roughness = 1
      if (m.isMeshPhongMaterial) {
        m.shininess = 6 // FBX characters: no plastic shine
        m.specular.set('#222222')
      }
      if (!seen.has(m.name)) {
        seen.add(m.name)
        console.log(label, 'material:', m.name, m.color ? '#' + m.color.getHexString() : '', 'mesh:', o.name)
      }
      // plain (untextured) cartoon skin gets the skin tone
      if (skin && /skin/i.test(m.name) && m.color && !m.map) m.color.set(skin)
    })
  })
}
