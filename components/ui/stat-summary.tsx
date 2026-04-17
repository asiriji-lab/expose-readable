import { cn } from '@/lib/utils'

interface StatItem {
  value: number
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

const VARIANT_CLASSES: Record<NonNullable<StatItem['variant']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
}

interface StatSummaryProps {
  items: StatItem[]
  className?: string
}

export function StatSummary({ items, className }: StatSummaryProps) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-foreground-muted flex-wrap', className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-border-strong">·</span>}
          <span>
            <span className={cn('font-semibold', VARIANT_CLASSES[item.variant ?? 'default'])}>
              {item.value}
            </span>{' '}
            {item.label}
          </span>
        </span>
      ))}
    </div>
  )
}
