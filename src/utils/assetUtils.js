// Vite base path ('/Bo-Bo/' in your case, always ends with a slash).
// Every file in public/ must be requested through this, or it 404s.
export const BASE = import.meta.env.BASE_URL

export const isFbx = (file) => /\.fbx$/i.test(file)

// "animations/Fast Run.fbx" -> "/Bo-Bo/models/animations/Fast%20Run.fbx"
// (respects the Vite base path)
export const modelUrl = (file) => BASE + 'models/' + encodeURI(file)
