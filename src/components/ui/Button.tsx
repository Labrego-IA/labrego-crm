'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'gradient' | 'ghost' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-primary-600 hover:bg-primary-700 border border-primary-600 hover:shadow-glow-violet dark:bg-primary-500 dark:hover:bg-primary-400',
  secondary:
    'text-white bg-secondary hover:bg-secondary-600 border border-secondary dark:bg-secondary-700 dark:hover:bg-secondary-600 dark:text-white',
  outline:
    'border-2 border-primary text-primary bg-transparent hover:bg-primary/10 dark:border-surface-light dark:text-slate-200 dark:hover:bg-surface-dark',
  gradient:
    'text-white border-0 bg-gradient-to-r from-primary to-secondary hover:shadow-glow-violet',
  ghost:
    'text-primary bg-surface hover:bg-primary/10 border border-transparent dark:text-slate-300 dark:hover:bg-white/10',
  destructive:
    'text-white bg-error hover:bg-error-600 border border-error dark:bg-error-600 dark:hover:bg-error-500',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg min-h-[32px]',
  md: 'px-3.5 py-2.5 text-sm gap-2 rounded-xl min-h-[44px]',
  lg: 'px-5 py-3 text-base gap-2.5 rounded-xl min-h-[52px]',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
