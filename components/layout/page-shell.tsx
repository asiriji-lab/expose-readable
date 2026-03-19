import { cn } from '@/lib/utils'

interface PageShellProps {
  children: React.ReactNode
  header?: React.ReactNode
  className?: string
}

export function PageShell({ children, header, className }: PageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {header}
      <main className={cn('max-w-5xl mx-auto px-4 py-8 space-y-6', className)}>
        {children}
      </main>
    </div>
  )
}
