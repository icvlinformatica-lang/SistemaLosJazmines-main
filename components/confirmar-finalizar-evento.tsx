"use client"

// Confirmación antes de finalizar un evento. La usan la Lista y el
// Calendario: un toque accidental archivaría el evento (y congelaría sus
// costos) sin aviso. Si la fecha todavía no llegó, además lo advierte.
import { AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { fechaNegocio } from "@/lib/ipc-cuotas"
import { avisoEventoTodaviaNoPaso } from "@/lib/lista-eventos"

export function ConfirmarFinalizarEventoDialog({
  open,
  onOpenChange,
  fechaEvento,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fechaEvento?: string
  onConfirm: () => void
}) {
  const aviso = avisoEventoTodaviaNoPaso(fechaEvento, fechaNegocio())
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Seguro que querés finalizar este evento?</AlertDialogTitle>
          <AlertDialogDescription>
            Va a desaparecer de la lista e irá al archivo de eventos completados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {aviso && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{aviso}</span>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Sí, finalizar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
