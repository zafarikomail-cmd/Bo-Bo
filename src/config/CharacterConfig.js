
export const SKIN_COLOR = '#d9a77c' // default skin tone (only used on plain cartoon characters)

/* ---- Character models (files in public/models/characters) ---- */
// The first entry is the character you play. Daniel (cartoon) is also the backup if it fails to load.
export const CHARACTERS = [
  { name: 'Realistic', file: 'characters/character.fbx' },
  { name: 'Cartoon', file: 'characters/daniel.gltf' },
]

export const RECEPTIONIST_FILE = 'characters/character1.fbx' // the person sitting at the reception desk

// Mixamo animations: they fit any Mixamo character
export const ANIM_FILES = {
  idle: 'animations/Idle.fbx',
  walk: 'animations/Walking.fbx',
  run: 'animations/Fast Run.fbx',
  crouchWalk: 'animations/Crouch Walk.fbx',
  crouchedWalk: 'animations/Crouched Walking.fbx',
  crouchIdle: 'animations/Crouching Idle.fbx',
  crouchEnter: 'animations/Standing To Crouched.fbx',
  crouchExit: 'animations/Crouched To Standing.fbx',
}

export const FIRST_PERSON_RIGS = {
  pistol: 'first-person/Fps Rig.glb',
  akm: 'first-person/Fps big Rig.glb',
}

export const CHARACTER_HEIGHT = 1.8 // Mixamo characters are resized to this height

// How fast the character moves (units per second) and how fast the walk / run animation plays.
// Feet slide on the ground? Change walkAnim / runAnim a little.
export const MOVE = {
  fbx: { walk: 3, run: 7, walkAnim: 1.6, runAnim: 1.1 },
  gltf: { walk: 4, run: 9, walkAnim: 1, runAnim: 1 },
}

export const PHYSICS = {
  gravity: 9.81,
  jumpSpeed: 5.8,
  groundAcceleration: 18,
  groundDeceleration: 24,
  airControl: 0.35,
}

// Crouch movement speed multiplier and camera eye height in world units.
export const CROUCH = {
  speed: 0.45,
  eye: 1.05,
}
export const EYE_HEIGHT = 1.6