const BASE_URL = import.meta.env.BASE_URL

export function assetUrl(path) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path

  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`
  const basePath = base.replace(/^\/+|\/+$/g, '')
  const relativePath = path.replace(/^\/+/, '')

  if (basePath && (relativePath === basePath || relativePath.startsWith(`${basePath}/`))) {
    return `/${relativePath}`
  }

  return `${base}${relativePath}`
}
