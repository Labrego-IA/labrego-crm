'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
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
} from '@heroicons/react/24/outline'
import { useSuperAdmin } from '@/hooks/useSuperAdmin'

interface NavItem {
  label: string
  href: string
  icon: JSX.Element
  badge?: string
  badgeColor?: string
  section?: string
}

const navItems: NavItem[] = [
  {
    label: 'Gestão de Contatos',
    href: '/contatos',
    icon: <UserGroupIcon className="w-5 h-5" />,
  },
  {
    label: 'Funis de Vendas',
    href: '/funil',
    icon: <MixerHorizontalIcon className="w-5 h-5" />,
  },
  {
    label: 'Produtividade',
    href: '/funil/produtividade',
    icon: <ActivityLogIcon className="w-5 h-5" />,
  },
  {
    label: 'Conversão do Funil',
    href: '/conversao',
    icon: <FunnelIcon className="w-5 h-5" />,
  },
  {
    label: 'Análises & Insights',
    href: '/analytics',
    icon: <BarChartIcon className="w-5 h-5" />,
  },
  {
    label: 'Projeção de Vendas',
    href: '/projecao-vendas',
    icon: <PresentationChartLineIcon className="w-5 h-5" />,
  },
  {
    label: 'Automações IA',
    href: '/automacoes',
    icon: <LightningBoltIcon className="w-5 h-5" />,
    badge: 'Em breve',
    badgeColor: 'bg-white/20 text-white/70',
  },
  {
    label: 'Campanhas',
    href: '/campanhas',
    icon: <TargetIcon className="w-5 h-5" />,
  },
]

const agentesItems: NavItem[] = [
  {
    label: 'Agente de Ligação',
    href: '/ligacoes',
    icon: <PhoneArrowUpRightIcon className="w-5 h-5" />,
  },
]

const adminItems: NavItem[] = [
  {
    label: 'Usuarios',
    href: '/admin/usuarios',
    icon: <UsersIcon className="w-5 h-5" />,
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
    label: 'Meu Plano',
    href: '/admin/plano',
    icon: <Cog6ToothIcon className="w-5 h-5" />,
  },
]

interface CrmSidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNavigate?: () => void
}

export default function CrmSidebar({ collapsed, onToggleCollapse, onNavigate }: CrmSidebarProps) {
  const pathname = usePathname()
  const { isSuperAdmin } = useSuperAdmin()
  const isAgentesSubItemActive = agentesItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
  const [agentesOpen, setAgentesOpen] = useState(isAgentesSubItemActive)

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
    <nav className="h-full flex flex-col bg-primary-600 border-r border-primary-700">
      {/* Header */}
      <div className={`border-b border-white/15 ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full rounded-2xl transition-all duration-200 hover:bg-white/10 group"
        >
          <Image
            src="/logo_crm.png"
            alt="CRM Labrego"
            width={collapsed ? 50 : 180}
            height={collapsed ? 50 : 180}
            className="object-contain"
          />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className={`${collapsed ? '' : 'mb-2'}`}>
          {!collapsed && (
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider px-3">
              Módulos
            </span>
          )}
        </div>
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = isItemActive(item.href)
            const isDisabled = item.badge === 'Em breve'

            return (
              <li key={item.href}>
                <Link
                  href={isDisabled ? '#' : item.href}
                  onClick={(e) => {
                    if (isDisabled) {
                      e.preventDefault()
                      return
                    }
                    onNavigate?.()
                  }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-white/20 text-white'
                      : isDisabled
                        ? 'text-white/30 cursor-not-allowed'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                  )}
                  <span className={isActive ? 'text-white' : isDisabled ? 'text-white/20' : 'text-white/70 group-hover:text-white'}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="font-medium text-sm flex-1">{item.label}</span>
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
                      {item.badge && <span className="ml-2 text-neutral-400">({item.badge})</span>}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
          {/* Agentes - expandable button */}
          <li>
            <button
              onClick={() => setAgentesOpen(!agentesOpen)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                ${collapsed ? 'justify-center' : ''}
                ${isAgentesSubItemActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              {isAgentesSubItemActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
              )}
              <span className={isAgentesSubItemActive ? 'text-white' : 'text-white/70 group-hover:text-white'}>
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
                {agentesItems.map((item) => {
                  const isActive = isItemActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => onNavigate?.()}
                        className={`
                          flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 group relative
                          ${isActive
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                          }
                        `}
                      >
                        <span className={isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}>
                          {item.icon}
                        </span>
                        <span className="font-medium text-sm">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        </ul>

        {/* Administração */}
        <div className={`mt-4 ${collapsed ? '' : 'mb-2'}`}>
          {!collapsed && (
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider px-3">
              Administracao
            </span>
          )}
        </div>
        <ul className="space-y-1">
          {adminItems.map((item) => {
            const isActive = isItemActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => onNavigate?.()}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                  )}
                  <span className={isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Super Admin */}
        {isSuperAdmin && (
          <>
            <div className={`mt-4 ${collapsed ? '' : 'mb-2'}`}>
              {!collapsed && (
                <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider px-3">
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
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  {pathname?.startsWith('/super-admin') && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                  )}
                  <span className={pathname?.startsWith('/super-admin') ? 'text-white' : 'text-white/70 group-hover:text-white'}>
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
            </ul>
          </>
        )}
      </div>
    </nav>
  )
}
