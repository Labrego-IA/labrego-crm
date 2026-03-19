export function normalizeRoutePath(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (prefixed.length > 1 && prefixed.endsWith('/')) {
    return prefixed.slice(0, -1)
  }
  return prefixed
}

const RAW_KNOWN_ROUTES = [
  '/',
  '/login',
  '/contatos',
  '/funil',
  '/funil/produtividade',
  '/conversao',
  '/cadencia',
  '/ligacoes',
  '/admin/usuarios',
  '/admin/creditos',
  '/plano',
  '/admin/funis',
] as const

export const KNOWN_ROUTES = new Set<string>(
  RAW_KNOWN_ROUTES.map((route) => normalizeRoutePath(route)).filter((route): route is string => Boolean(route))
)

export function isKnownRoute(value?: string | null): boolean {
  const normalized = normalizeRoutePath(value)
  if (!normalized) return false
  if (KNOWN_ROUTES.has(normalized)) return true
  // Dynamic routes: /funil/{funnelId}
  if (/^\/funil\/[^/]+$/.test(normalized)) return true
  return false
}

export function filterKnownRoutes(paths?: string[]): string[] {
  if (!Array.isArray(paths)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const path of paths) {
    const normalized = normalizeRoutePath(path)
    if (!normalized) continue
    if (normalized === '/login') continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    if (KNOWN_ROUTES.has(normalized)) {
      result.push(normalized)
    }
  }
  return result
}
