import { ReactNode, useRef, useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface TableWrapperProps {
  children: ReactNode
  className?: string
}

/**
 * Wrapper para tabelas com scroll horizontal responsivo
 * Adiciona indicadores visuais de scroll em dispositivos móveis
 */
export function TableWrapper({ children, className = '' }: TableWrapperProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftScroll, setShowLeftScroll] = useState(false)
  const [showRightScroll, setShowRightScroll] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return

    const { scrollLeft, scrollWidth, clientWidth } = el
    setShowLeftScroll(scrollLeft > 10)
    setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return

    const resizeObserver = new ResizeObserver(checkScroll)
    resizeObserver.observe(el)

    return () => resizeObserver.disconnect()
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return

    const scrollAmount = el.clientWidth * 0.8
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="relative">
      {/* Indicador de scroll à esquerda */}
      {showLeftScroll && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 opacity-90 hover:opacity-100 transition-opacity md:hidden"
          aria-label="Rolar para esquerda"
        >
          <ChevronLeftIcon className="h-5 w-5 text-gray-700" />
        </button>
      )}

      {/* Container com scroll */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={`overflow-x-auto ${className}`}
      >
        {children}
      </div>

      {/* Indicador de scroll à direita */}
      {showRightScroll && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 opacity-90 hover:opacity-100 transition-opacity md:hidden"
          aria-label="Rolar para direita"
        >
          <ChevronRightIcon className="h-5 w-5 text-gray-700" />
        </button>
      )}

      {/* Gradiente de fade nas bordas para indicar mais conteúdo */}
      {showLeftScroll && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent md:hidden" />
      )}
      {showRightScroll && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent md:hidden" />
      )}
    </div>
  )
}
