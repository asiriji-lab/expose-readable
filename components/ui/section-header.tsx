import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  counter?: { current: number; total: number; label?: string }
  status?: 'success' | 'danger' | 'neutral'
  className?: string
}

export function SectionHeader({ title, counter, status = 'neutral', className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h3 className="text-xs font-semibold tracking-wide text-foreground-muted uppercase">
        {title}
      </h3>
      {counter && (
        <Badge variant={status}>
          {counter.current}/{counter.total} {counter.label ?? 'ผ่าน'}
        </Badge>
      )}
    </div>
  )
}
