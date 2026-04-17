import { CheckCircle, XCircle, AlertTriangle, Clock, Loader2, Lock, HelpCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusKey = 'passed' | 'warnings' | 'errors' | 'pending' | 'validating' | 'locked' | 'missing'

const STATUS_MAP: Record<StatusKey, {
  icon: React.ElementType
  variant: 'success' | 'warning' | 'danger' | 'neutral' | 'default'
  label: string
  spin?: boolean
}> = {
  passed:     { icon: CheckCircle,  variant: 'success', label: 'ผ่าน' },
  warnings:   { icon: AlertTriangle, variant: 'warning', label: 'มีคำเตือน' },
  errors:     { icon: XCircle,      variant: 'danger',  label: 'มีข้อผิดพลาด' },
  missing:    { icon: HelpCircle,   variant: 'danger',  label: 'ไม่พบข้อมูล' },
  pending:    { icon: Clock,        variant: 'neutral', label: 'รอตรวจสอบ' },
  validating: { icon: Loader2,      variant: 'default', label: 'กำลังตรวจ...', spin: true },
  locked:     { icon: Lock,         variant: 'neutral', label: 'ล็อก' },
}

interface StatusBadgeProps {
  status: StatusKey
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status]
  const Icon = config.icon
  return (
    <Badge variant={config.variant} className={cn(className)}>
      <Icon className={cn('size-3.5', config.spin && 'animate-spin')} />
      {label ?? config.label}
    </Badge>
  )
}
