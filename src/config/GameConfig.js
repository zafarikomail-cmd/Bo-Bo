import { BASE } from '../utils/assetUtils'

/* ============ EDIT THESE ============ */
export const PLANE_MESSAGE = "Welcome to Ahmad Komail's World"
export const PHOTOS = ['images/photo1.jpg', 'images/photo2.jpg', 'images/photo3.jpg'].map((p) => BASE + p)
export const ABOUT_TITLE = 'About Me'
export const ABOUT_TEXT = `Hi, I'm Ahmad Komail. I'm a BS Information Technology student at NUTECH, interested in cybersecurity, networking and full-stack development. Before university I worked in television doing archive management, video editing and master control playout, which is where my love for building things that go live began. Today I build web projects and I'm learning React and 3D on the web. This beach is my way of saying hello. Make yourself at home!`
export const TREE_COUNT = 150 // lower this (for example 90) if the scene feels slow
export const TIME_OF_DAY = 'day' // 'day' = blue sky + white clouds, 'sunset' = orange evening
export const SAND_TILE = 5 // how many world units one sand texture covers (bigger = bigger grains)

export const PLANE_FILE = 'vehicles/Airplane.glb'
export const PLANE_SIZE = 2.4 // bigger number = bigger plane
export const PLANE_YAW = 0 // plane flies sideways or backwards? press P in the game until it flies nose first, then type the number the Console prints (F12)
/* ==================================== */

export const ATMOSPHERES = {
  day: {
    sun: [-50, 45, -70],
    sky: { turbidity: 3, rayleigh: 1.2, mie: 0.005, g: 0.8 },
    water: 0x0b9bb8,
    light: '#fff3e0',
    lightI: 2,
    lightPos: [-8, 10, -10],
    clouds: true,
  },
  sunset: {
    sun: [-100, 9, 55],
    sky: { turbidity: 8, rayleigh: 3, mie: 0.005, g: 0.8 },
    water: 0x0b6f8f,
    light: '#ffb27a',
    lightI: 1.5,
    lightPos: [-10, 8, 6],
    clouds: false,
  },
}
export const AT = ATMOSPHERES[TIME_OF_DAY] || ATMOSPHERES.day
export const SUN = AT.sun
