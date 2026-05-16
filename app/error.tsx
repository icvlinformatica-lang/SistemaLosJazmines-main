"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Home, RefreshCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Silenciar el error — no lo loguear en consola
  }, [error])

  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 text-center max-w-xs">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <RefreshCw className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Algo no cargó bien</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Podés intentar de nuevo o volver al inicio.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Intentar de nuevo
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#1a3a2a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a3a2a]/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
