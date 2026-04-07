'use client'

import { type ReactNode } from 'react'

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'premium'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  primary:
    'bg-primary/10 text-primary border-primary/20',
  secondary:
    'bg-secondary/10 text-secondary-700 border-secondary/20',
  success:
    'bg-success/10 text-success-700 border-success/20',
  warning:
    'bg-warning/10 text-warning-700 border-warning/20',
  error:
    'bg-error/10 text-error-700 border-error/20',
  premium:
    'bg-gradient-to-r from-primary to-secondary text-white border-transparent',
}

function Badge({ variant = 'primary', className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export { Badge }
export type { BadgeProps, BadgeVariant }
