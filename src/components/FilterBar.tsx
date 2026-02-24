import type { ReactNode } from 'react'

import { cx } from '@/ui'

export interface FilterBarProps {
  filters: ReactNode
  actions?: ReactNode
  className?: string
  filtersClassName?: string
  actionsClassName?: string
}

export function FilterBar({
  filters,
  actions,
  className,
  filtersClassName,
  actionsClassName,
}: FilterBarProps) {
  return (
    <div
      className={cx(
        'flex flex-col gap-3 rounded-2xl sm:rounded-3xl border border-gray-200 bg-white/80 p-3 sm:p-4 shadow-sm backdrop-blur',
        'lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <div className={cx('flex flex-1 flex-wrap items-center gap-2 sm:gap-3', filtersClassName)}>{filters}</div>
      {actions ? (
        <div className={cx('flex flex-wrap items-center gap-2', actionsClassName)}>{actions}</div>
      ) : null}
    </div>
  )
}
