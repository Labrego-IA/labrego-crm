'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MixerHorizontalIcon,
  BarChartIcon,
  LightningBoltIcon,
  TargetIcon,
  ActivityLogIcon,
  ChevronDownIcon,
} from '@radix-ui/react-icons'
import {
  FunnelIcon,
  PhoneArrowUpRightIcon,
  UsersIcon,
  PresentationChartLineIcon,
} from '@heroicons/react/24/outline'
import {
  UserGroupIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  TagIcon,
  CurrencyDollarIcon,
  ClockIcon,
  BookOpenIcon,
  EnvelopeIcon,
  QuestionMarkCircleIcon,
  LockClosedIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  InboxIcon,
} from '@heroicons/react/24/outline'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebaseClient'
import { useRouter } from 'next/navigation'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'
import { usePlanExpiration } from '@/hooks/usePlanExpiration'
import { usePermissions } from '@/hooks/usePermissions'

interface NavItem {
  label: string
  href: string
  icon: JSX.Element
  badge?: string
  badgeColor?: string
  section?: string
}

const navItems: NavItem[] = [
  // CRM
  {
    label: 'Contatos',
    href: '/contatos',
    icon: <UserGroupIcon className="w-5 h-5" />,
    section: 'crm',
  },
  {
    label: 'Funis',
    href: '/funil',
    icon: <MixerHorizontalIcon className="w-5 h-5" />,
    section: 'crm',
  },
  {
    label: 'Produtividade',
    href: '/funil/produtividade',
    icon: <ActivityLogIcon className="w-5 h-5" />,
    section: 'crm',
  },
  {
    label: 'Conversao',
    href: '/conversao',
    icon: <FunnelIcon className="w-5 h-5" />,
    section: 'crm',
  },
  // Comercial
  {
    label: 'Analises',
    href: '/analytics',
    icon: <BarChartIcon className="w-5 h-5" />,
    section: 'comercial',
  },
  {
    label: 'Projecao de Vendas',
    href: '/projecao-vendas',
    icon: <PresentationChartLineIcon className="w-5 h-5" />,
    section: 'comercial',
  },
  {
    label: 'Campanhas',
    href: '/campanhas',
    icon: <TargetIcon className="w-5 h-5" />,
    section: 'comercial',
  },
]

const agentesItems: NavItem[] = [
  {
    label: 'Configuração do Agente',
    href: '/ligacoes/configuracao',
    icon: <Cog6ToothIcon className="w-5 h-5" />,
  },
  {
    label: 'Disparo Massivo',
    href: '/ligacoes/disparo',
    icon: <PhoneArrowUpRightIcon className="w-5 h-5" />,
  },
  {
    label: 'Historico de Ligacoes',
    href: '/ligacoes/historico',
    icon: <ClockIcon className="w-5 h-5" />,
  },
  {
    label: 'Painel Agentes IA',
    href: '/agentes/dashboard',
    icon: <SparklesIcon className="w-5 h-5" />,
    section: 'agentes-ia',
  },
  {
    label: 'WhatsApp IA',
    href: '/agentes/whatsapp/configuracao',
    icon: <ChatBubbleLeftRightIcon className="w-5 h-5" />,
    section: 'agentes-ia',
  },
  {
    label: 'Conversas WhatsApp',
    href: '/agentes/whatsapp/conversas',
    icon: <InboxIcon className="w-5 h-5" />,
    section: 'agentes-ia',
  },
  {
    label: 'Email IA',
    href: '/agentes/email/configuracao',
    icon: <EnvelopeIcon className="w-5 h-5" />,
    section: 'agentes-ia',
  },
  {
    label: 'Conversas Email',
    href: '/agentes/email/conversas',
    icon: <InboxIcon className="w-5 h-5" />,
    section: 'agentes-ia',
  },
  {
    label: 'Logs da IA',
    href: '/agentes/logs',
    icon: <DocumentTextIcon className="w-5 h-5" />,
    section: 'agentes-ia',
  },
]

const adminItems: NavItem[] = [
  {
    label: 'Usuarios',
    href: '/admin/usuarios',
    icon: <UsersIcon className="w-5 h-5" />,
  },
  {
    label: 'Email',
    href: '/admin/email',
    icon: <EnvelopeIcon className="w-5 h-5" />,
  },
  {
    label: 'Funis',
    href: '/admin/funis',
    icon: <FunnelIcon className="w-5 h-5" />,
  },
  {
    label: 'Perfis ICP',
    href: '/admin/icp',
    icon: <TagIcon className="w-5 h-5" />,
  },
  {
    label: 'Centros de Custo',
    href: '/admin/centros-custo',
    icon: <CurrencyDollarIcon className="w-5 h-5" />,
  },
  {
    label: 'Propostas',
    href: '/admin/propostas',
    icon: <DocumentTextIcon className="w-5 h-5" />,
  },
  {
    label: 'Creditos',
    href: '/admin/creditos',
    icon: <CreditCardIcon className="w-5 h-5" />,
  },
  {
    label: 'Estratégia Comercial',
    href: '/admin/estrategia',
    icon: <BookOpenIcon className="w-5 h-5" />,
  },
]

// Mapping of admin pages to the action(s) that gate access on each page.
// If ANY listed action is allowed, the page is accessible.
const adminPageRequiredActions: Record<string, (keyof import('@/types/organization').MemberActions)[]> = {
  '/admin/usuarios': ['canManageUsers'],
  '/admin/email': ['canManageSettings'],
  '/admin/funis': ['canManageFunnels', 'canManageSettings'],
  '/admin/icp': ['canManageFunnels', 'canManageSettings'],
  '/admin/centros-custo': ['canManageFunnels', 'canManageSettings'],
  '/admin/propostas': ['canManageSettings'],
  '/admin/creditos': ['canManageSettings'],
}

interface CrmSidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

export default function CrmSidebar({ collapsed, onToggleCollapse, onNavigate }: CrmSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { isSuperAdmin } = useSuperAdmin()
  const { isFreePlan, isExpired, daysRemaining } = usePlanExpiration()
  const { role, canAccessPage, can, isPartner } = usePermissions()
  const isAdmin = role === 'admin'
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.replace('/login')
    } catch (err) {
      console.error('[sidebar] Logout failed:', err)
    }
  }
  const isAgentesSubItemActive = agentesItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
  const [agentesOpen, setAgentesOpen] = useState(isAgentesSubItemActive)

  // Mostrar todos os itens, mas marcar os bloqueados
  const filteredNavItems = navItems
  const filteredAgentesItems = agentesItems
  const filteredAdminItems = adminItems
  const hasAgentesAccess = true
  const hasAdminAccess = true

  const allNavItems = [...navItems, ...agentesItems, ...adminItems]
  const isItemActive = (itemHref: string): boolean => {
    if (pathname === itemHref) return true
    const matchesPrefix = pathname.startsWith(`${itemHref}/`)
    if (!matchesPrefix) return false
    const hasMoreSpecificMatch = allNavItems.some(
      (other) =>
        other.href !== itemHref &&
        other.href.startsWith(`${itemHref}/`) &&
        (pathname === other.href || pathname.startsWith(`${other.href}/`))
    )
    return !hasMoreSpecificMatch
  }

  return (
    <nav className="h-full flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className={`border-b border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full rounded-2xl transition-all duration-200 hover:bg-white/5 group py-2"
        >
          {collapsed ? (
            <span className="text-lg font-bold bg-gradient-to-r from-[#13DEFC] to-[#09B00F] bg-clip-text text-transparent">V</span>
          ) : (
            <span className="text-2xl font-bold bg-gradient-to-r from-[#13DEFC] to-[#09B00F] bg-clip-text text-transparent tracking-tight">Voxium</span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto scrollbar-sidebar px-3 py-4">
        {!collapsed && (
          <div className="mb-2">
            <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-3">
              CRM
            </span>
          </div>
        )}
        <ul className="space-y-1">
          {filteredNavItems.map((item, idx) => {
            const isActive = isItemActive(item.href)
            const isDisabled = item.badge === 'Em breve'
            const isLocked = !isAdmin && !isDisabled && !canAccessPage(item.href)
            const prevSection = idx > 0 ? filteredNavItems[idx - 1].section : 'crm'
            const showSectionLabel = item.section && item.section !== prevSection

            return (
              <li key={item.href}>
                {showSectionLabel && !collapsed && (
                  <div className="mt-4 mb-2">
                    <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider px-3">
                      {item.section === 'comercial' ? 'Comercial' : item.section}
                    </span>
                  </div>
                )}
                <Link
                  href={isDisabled || isLocked ? '#' : item.href}
                  onClick={(e) => {
                    if (isDisabled || isLocked) {
                      e.preventDefault()
                      return
                    }
                    onNavigate?.()
                  }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
                      : isDisabled || isLocked
                        ? 'text-white/30 cursor-not-allowed'
                        : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#13DEFC] rounded-r-full" />
                  )}
                  <span className={isActive ? 'text-[#13DEFC]' : isDisabled || isLocked ? 'text-white/20' : 'text-white/50 group-hover:text-[#13DEFC]'}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="font-medium text-sm flex-1">{item.label}</span>
                      {isLocked && (
                        <LockClosedIcon className="w-4 h-4 text-white/30" />
                      )}
                      {item.badge && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                      {isLocked && <span className="ml-2 text-neutral-400">(Bloqueado)</span>}
                      {item.badge && <span className="ml-2 text-neutral-400">({item.badge})</span>}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
          {/* Agentes - expandable button */}
          {hasAgentesAccess && (
          <li>
            <button
              onClick={() => setAgentesOpen(!agentesOpen)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                ${collapsed ? 'justify-center' : ''}
                ${isAgentesSubItemActive
                  ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
                  : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
                }
              `}
            >
              {isAgentesSubItemActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#13DEFC] rounded-r-full" />
              )}
              <span className={isAgentesSubItemActive ? 'text-[#13DEFC]' : 'text-white/50 group-hover:text-[#13DEFC]'}>
                <UsersIcon className="w-5 h-5" />
              </span>
              {!collapsed && (
                <>
                  <span className="font-medium text-sm flex-1 text-left">Agentes</span>
                  <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${agentesOpen ? 'rotate-180' : ''}`} />
                </>
              )}
              {collapsed && (
                <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Agentes
                </span>
              )}
            </button>
            {agentesOpen && !collapsed && (
              <ul className="mt-1 ml-4 space-y-1">
                {filteredAgentesItems.map((item) => {
                  const isActive = isItemActive(item.href)
                  const isLocked = !isAdmin && !canAccessPage(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={isLocked ? '#' : item.href}
                        onClick={(e) => {
                          if (isLocked) {
                            e.preventDefault()
                            return
                          }
                          onNavigate?.()
                        }}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative
                          ${isActive
                            ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
                            : isLocked
                              ? 'text-white/30 cursor-not-allowed'
                              : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
                          }
                        `}
                      >
                        <span className={isActive ? 'text-[#13DEFC]' : isLocked ? 'text-white/20' : 'text-white/50 group-hover:text-[#13DEFC]'}>
                          {item.icon}
                        </span>
                        <span className="font-medium text-sm flex-1">{item.label}</span>
                        {isLocked && (
                          <LockClosedIcon className="w-4 h-4 text-white/30" />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
          )}
        </ul>

        {/* Administração - visível para quem tem acesso a páginas admin */}
        {hasAdminAccess && (
          <>
            <div className={`mt-4 ${collapsed ? '' : 'mb-2'}`}>
              {!collapsed && (
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-3">
                  Administracao
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {filteredAdminItems.map((item) => {
                const isActive = isItemActive(item.href)
                const isDisabled = item.badge === 'Em breve'
                const requiredActions = adminPageRequiredActions[item.href]
                const isLocked = !isAdmin && !isDisabled && (
                  requiredActions
                    ? !requiredActions.some(action => can(action))
                    : !canAccessPage(item.href)
                )
                return (
                  <li key={item.href}>
                    <Link
                      href={isDisabled || isLocked ? '#' : item.href}
                      onClick={(e) => {
                        if (isDisabled || isLocked) {
                          e.preventDefault()
                          return
                        }
                        onNavigate?.()
                      }}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                        ${collapsed ? 'justify-center' : ''}
                        ${isActive
                          ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
                          : isDisabled || isLocked
                            ? 'text-white/30 cursor-not-allowed'
                            : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
                        }
                      `}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#13DEFC] rounded-r-full" />
                      )}
                      <span className={isActive ? 'text-[#13DEFC]' : isDisabled || isLocked ? 'text-white/20' : 'text-white/50 group-hover:text-[#13DEFC]'}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="font-medium text-sm flex-1">{item.label}</span>
                          {isLocked && (
                            <LockClosedIcon className="w-4 h-4 text-white/30" />
                          )}
                          {item.badge && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && (
                        <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                          {item.label}
                          {isLocked && <span className="ml-2 text-neutral-400">(Bloqueado)</span>}
                          {item.badge && <span className="ml-2 text-neutral-400">({item.badge})</span>}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* Super Admin */}
        {isSuperAdmin && (
          <>
            <div className={`mt-4 ${collapsed ? '' : 'mb-2'}`}>
              {!collapsed && (
                <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-3">
                  Super Admin
                </span>
              )}
            </div>
            <ul className="space-y-1">
              <li>
                <Link
                  href="/super-admin"
                  onClick={() => onNavigate?.()}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                    ${collapsed ? 'justify-center' : ''}
                    ${pathname?.startsWith('/super-admin')
                      ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
                      : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
                    }
                  `}
                >
                  {pathname?.startsWith('/super-admin') && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#13DEFC] rounded-r-full" />
                  )}
                  <span className={pathname?.startsWith('/super-admin') ? 'text-[#13DEFC]' : 'text-white/50 group-hover:text-[#13DEFC]'}>
                    <ShieldCheckIcon className="w-5 h-5" />
                  </span>
                  {!collapsed && (
                    <span className="font-medium text-sm">Painel SaaS</span>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                      Painel SaaS
                    </span>
                  )}
                </Link>
              </li>
              <li>
                <Link
                  href="/super-admin/ai-usage"
                  onClick={() => onNavigate?.()}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                    ${collapsed ? 'justify-center' : ''}
                    ${pathname?.startsWith('/super-admin/ai-usage')
                      ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
                      : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
                    }
                  `}
                >
                  <span className={pathname?.startsWith('/super-admin/ai-usage') ? 'text-[#13DEFC]' : 'text-white/50 group-hover:text-[#13DEFC]'}>
                    <CreditCardIcon className="w-5 h-5" />
                  </span>
                  {!collapsed && (
                    <span className="font-medium text-sm">Uso de IA</span>
                  )}
                </Link>
              </li>
            </ul>
          </>
        )}
      </div>

      {/* Plan status banner */}
      {!collapsed && (isFreePlan || isExpired) && (
        <div className="px-3 py-2">
          <Link
            href="/plano"
            onClick={() => onNavigate?.()}
            className={`block rounded-xl p-3 transition-colors ${
              isExpired
                ? 'bg-red-500/20 border border-red-400/30 hover:bg-red-500/30'
                : 'bg-amber-500/20 border border-amber-400/30 hover:bg-amber-500/30'
            }`}
          >
            <p className={`text-xs font-semibold ${isExpired ? 'text-red-300' : 'text-amber-300'}`}>
              {isExpired
                ? (isFreePlan ? 'Teste gratuito expirado' : 'Assinatura expirada')
                : 'Teste gratuito'
              }
            </p>
            <p className={`text-[11px] mt-0.5 ${isExpired ? 'text-red-400/80' : 'text-amber-400/80'}`}>
              {isExpired
                ? (isFreePlan ? 'Assine um plano para continuar' : 'Renove seu plano para continuar')
                : `${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''} restante${daysRemaining !== 1 ? 's' : ''}`
              }
            </p>
          </Link>
        </div>
      )}

      {/* Meu Plano + Guia + Logout */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        <Link
          href="/plano"
          onClick={() => onNavigate?.()}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
            ${collapsed ? 'justify-center' : ''}
            ${pathname === '/plano'
              ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
              : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
            }
          `}
        >
          {pathname === '/plano' && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#13DEFC] rounded-r-full" />
          )}
          <Cog6ToothIcon className={`w-5 h-5 ${pathname === '/plano' ? 'text-[#13DEFC]' : 'text-white/50 group-hover:text-[#13DEFC]'}`} />
          {!collapsed && (
            <span className="font-medium text-sm">Planos</span>
          )}
          {collapsed && (
            <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
              Planos
            </span>
          )}
        </Link>
        <Link
          href="/guia"
          onClick={() => onNavigate?.()}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
            ${collapsed ? 'justify-center' : ''}
            ${pathname === '/guia'
              ? 'bg-[#13DEFC]/10 text-[#13DEFC]'
              : 'text-white/60 hover:bg-white/5 hover:text-[#13DEFC]'
            }
          `}
        >
          {pathname === '/guia' && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#13DEFC] rounded-r-full" />
          )}
          <QuestionMarkCircleIcon className={`w-5 h-5 ${pathname === '/guia' ? 'text-[#13DEFC]' : 'text-white/50 group-hover:text-[#13DEFC]'}`} />
          {!collapsed && (
            <span className="font-medium text-sm">Guia</span>
          )}
          {collapsed && (
            <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
              Guia
            </span>
          )}
        </Link>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
            text-white/60 hover:bg-red-500/10 hover:text-red-400
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          {!collapsed && (
            <span className="font-medium text-sm">Sair</span>
          )}
          {collapsed && (
            <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
              Sair
            </span>
          )}
        </button>
      </div>

      {/* Popup de confirmação de logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <ArrowRightOnRectangleIcon className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Sair do aplicativo
              </h3>
              <p className="text-sm text-white/60 mb-6">
                Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o sistema.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 bg-slate-700 hover:bg-slate-600 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors duration-200"
                >
                  Sim, sair
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
