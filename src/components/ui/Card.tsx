'use client'

import { type HTMLAttributes, type ReactNode } from 'react'

type CardVariant = 'default' | 'glass' | 'frost' | 'dark'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  hover?: boolean
  children: ReactNode
}

const variantClasses: Record<CardVariant, string> = {
  default:
    'bg-white border border-surface-mid rounded-2xl shadow-subtle dark:bg-dark dark:border-surface-dark',
  glass:
    'glass-card rounded-2xl dark:bg-dark/80 dark:border-surface-dark',
  frost:
    'bg-gradient-to-br from-surface to-secondary-100 rounded-2xl border border-white/30 backdrop-blur-sm',
  dark:
    'glass-card-dark rounded-2xl text-white',
}

function Card({ variant = 'default', hover = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`p-6 ${variantClasses[variant]} ${hover ? 'transition-transform duration-200 hover:-translate-y-1 hover:shadow-medium' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export { Card }
export type { CardProps, CardVariant }
