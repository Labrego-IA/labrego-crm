"use client"

type PaginationControlsProps = {
  currentPage: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
  disablePrevious?: boolean
  disableNext?: boolean
  className?: string
}

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

const baseButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-surface-dark hover:bg-gray-50 dark:bg-white/5 hover:border-gray-300 transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"

export function PaginationControls({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  disablePrevious,
  disableNext,
  className,
}: PaginationControlsProps) {
  const normalizedTotal = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 0
  const normalizedCurrent = Number.isFinite(currentPage) ? Math.floor(currentPage) : 0

  const hasPages = normalizedTotal > 0
  const computedCurrent = hasPages
    ? Math.min(Math.max(1, normalizedCurrent), normalizedTotal)
    : Math.max(0, Math.min(normalizedCurrent, 0))
  const computedTotal = hasPages ? normalizedTotal : 0

  const prevDisabled = disablePrevious ?? (!hasPages || computedCurrent <= 1)
  const nextDisabled = disableNext ?? (!hasPages || computedCurrent >= computedTotal)

  return (
    <div className={cx("flex flex-wrap items-center justify-center gap-3", className)}>
      <button type="button" className={baseButton} onClick={onPrevious} disabled={prevDisabled}>
        Anterior
      </button>
      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
        Página {computedCurrent} de {computedTotal}
      </span>
      <button type="button" className={baseButton} onClick={onNext} disabled={nextDisabled}>
        Próxima
      </button>
    </div>
  )
}

export default PaginationControls
