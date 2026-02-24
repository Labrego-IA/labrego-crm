import { filterKnownRoutes, normalizeRoutePath } from './knownRoutes'

const SCREEN_LABELS: Record<string, string> = {
  '/': 'Início',
  '/login': 'Login',
  '/contatos': 'Gestão de Contatos',
  '/funil': 'Funis de Vendas',
  '/funil/produtividade': 'Produtividade',
  '/conversao': 'Conversão do Funil',
  '/cadencia': 'Cadência',
  '/ligacoes': 'Agente de Ligação',
  '/admin/usuarios': 'Usuarios',
  '/admin/creditos': 'Creditos',
  '/admin/plano': 'Plano',
  '/admin/funis': 'Acesso a Funis',
}

export function getScreenLabel(path?: string | null): string {
  if (!path) return 'Área inicial'
  const normalized = path.replace(/\/$/, '') || '/'
  if (SCREEN_LABELS[normalized]) return SCREEN_LABELS[normalized]
  // Dynamic routes: /funil/{funnelId}
  if (/^\/funil\/[^/]+$/.test(normalized)) return 'Funil de Vendas'
  return 'Área inicial'
}

export function getFallbackScreen(
  currentPath: string,
  allowedScreens?: string[],
  defaultPath: string = '/contatos'
): string {
  const normalizedCurrent = normalizeRoutePath(currentPath) ?? '/'
  const normalizedDefault = normalizeRoutePath(defaultPath) ?? '/contatos'

  if (!Array.isArray(allowedScreens) || allowedScreens.length === 0) {
    return normalizedDefault
  }

  const normalizedScreens = allowedScreens
    .map(screen => normalizeRoutePath(screen))
    .filter((screen): screen is string => Boolean(screen))

  const knownScreens = filterKnownRoutes(normalizedScreens)

  const candidateScreens = knownScreens.length > 0 ? knownScreens : []

  if (candidateScreens.length === 0) {
    return normalizedDefault
  }

  const alternativeScreen = candidateScreens.find(screen => screen !== normalizedCurrent)
  return alternativeScreen || candidateScreens[0] || normalizedDefault
}
