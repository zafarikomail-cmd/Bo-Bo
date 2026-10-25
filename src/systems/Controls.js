// Input shared between the touch controls (React UI) and the Player (runs every frame).
// It is a plain object on purpose: changing it does not re-render React.
export const controls = {
  moveX: 0, // -1 (left) .. 1 (right)
  moveY: 0, // -1 (back) .. 1 (forward)
  run: false, // run button held
  jump: false, // jump button held
}

export function resetControls() {
  controls.moveX = 0
  controls.moveY = 0
  controls.run = false
  controls.jump = false
}
