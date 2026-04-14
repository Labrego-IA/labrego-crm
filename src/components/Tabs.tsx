import { ReactNode } from 'react'

export type TabItem = {
  key: string
  label: string
  content: ReactNode
}

type TabsProps = {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
  className?: string
  renderExtra?: (context: { activeKey: string }) => ReactNode
  extraPosition?: 'outside' | 'inline'
}

export default function Tabs({
  items,
  active,
  onChange,
  className = '',
  renderExtra,
  extraPosition = 'outside',
}: TabsProps) {
  const activeItem = items.find(it => it.key === active)
  const extra = renderExtra?.({ activeKey: active })
  const isInlineExtra = Boolean(extra && extraPosition === 'inline')
  const isOutsideExtra = Boolean(extra && extraPosition === 'outside')

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div
            className={`flex min-w-max items-center gap-2 rounded-2xl border border-gray-200 dark:border-surface-dark bg-white/70 dark:bg-dark/70 p-1 shadow-inner backdrop-blur ${
              isInlineExtra ? 'pr-1' : ''
            }`}
          >
            {items.map(it => {
              const isActive = active === it.key

              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => onChange(it.key)}
                  aria-pressed={isActive}
                  className={`relative inline-flex min-w-[120px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                    isActive
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-2xl ring-1 ring-white/40"
                    />
                  )}
                  <span className="relative z-10 whitespace-nowrap">{it.label}</span>
                </button>
              )
            })}
            {isInlineExtra ? (
              <>
                <span
                  aria-hidden
                  className="hidden h-6 w-px bg-gray-200 sm:block"
                />
                <div className="flex items-center gap-2">{extra}</div>
              </>
            ) : null}
          </div>
          {isOutsideExtra ? <div className="w-full sm:w-auto sm:flex-shrink-0">{extra}</div> : null}
        </div>
      </div>
      <div className="mt-5">{activeItem?.content}</div>
    </div>
  )
}
