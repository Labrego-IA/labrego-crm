'use client'

interface SkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'table-row'
  className?: string
  count?: number
}

const variantClasses: Record<string, string> = {
  text: 'h-4 w-full rounded',
  card: 'h-32 w-full rounded-2xl',
  avatar: 'h-10 w-10 rounded-full',
  'table-row': 'h-10 w-full rounded-lg',
}

export default function Skeleton({ variant = 'text', className = '', count = 1 }: SkeletonProps) {
  if (variant === 'table-row') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-3 px-4 py-2">
            <div className="skeleton h-4 rounded col-span-1" />
            <div className="skeleton h-4 rounded col-span-1" />
            <div className="skeleton h-4 rounded col-span-1" />
            <div className="skeleton h-4 rounded col-span-1" />
          </div>
        ))}
      </div>
    )
  }

  const baseClass = variantClasses[variant]

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${baseClass}`} />
      ))}
    </div>
  )
}
