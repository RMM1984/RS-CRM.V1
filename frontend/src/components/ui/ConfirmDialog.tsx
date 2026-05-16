'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ConfirmDialogProps = {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
  loading?: boolean
}

export const ConfirmDialog = ({
  confirmLabel = 'Si, eliminar',
  danger = false,
  isOpen,
  loading = false,
  message,
  onCancel,
  onConfirm,
  title
}: ConfirmDialogProps) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4">
      <Card className="w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={cn('mt-1 rounded-full p-2', danger ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={loading} onClick={onCancel} type="button" variant="outline">
            Cancelar
          </Button>
          <Button
            className={danger ? 'bg-red-600 text-white hover:bg-red-700' : undefined}
            disabled={loading}
            onClick={onConfirm}
            type="button"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}
