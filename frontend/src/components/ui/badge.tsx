import * as React from 'react'
import { cn } from '@/lib/utils'

export const Badge = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'inline-flex min-h-6 items-center rounded-md px-2 text-xs font-semibold',
      className
    )}
    {...props}
  />
)
