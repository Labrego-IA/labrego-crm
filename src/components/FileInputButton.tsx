'use client'

import { useRef } from 'react'

type FileInputButtonVariant = 'default' | 'icon'

interface FileInputButtonProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  accept?: string
  multiple?: boolean
  className?: string
  title?: string
  ariaLabel?: string
  children: React.ReactNode
  disabled?: boolean
  variant?: FileInputButtonVariant
}

export default function FileInputButton({
  onChange,
  accept,
  multiple = false,
  className = '',
  title,
  ariaLabel,
  children,
  disabled = false,
  variant = 'default',
}: FileInputButtonProps) {
  const ref = useRef<HTMLInputElement>(null)

  const baseClass =
    variant === 'icon'
      ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark text-gray-500 dark:text-slate-400 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:bg-white/5 hover:text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30'
      : 'btn bg-gray-100 dark:bg-white/10 hover:bg-gray-200 text-gray-700'

  const disabledClass = disabled ? 'cursor-not-allowed opacity-50' : ''

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            ref.current?.click()
          }
        }}
        className={`${baseClass} ${disabledClass} ${className}`.trim()}
        title={title}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        disabled={disabled}
      >
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="hidden"
        disabled={disabled}
      />
    </>
  )
}
