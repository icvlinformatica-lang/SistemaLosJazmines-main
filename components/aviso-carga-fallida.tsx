"use client"

// Aviso "No se pudo conectar" para las pantallas de catálogos (Cócteles,
// Recetario, Almacén, Insumos de barra). Sale solo si alguno de sus
// catálogos no llegó de la base al abrir el sistema (lib/catalogos-carga.ts).
// Solo pantalla: "Reintentar" vuelve a leer, no guarda nada.

import { useState } from "react"
import { RefreshCw, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store-context"
import { textoCargaFallida, type CatalogoCarga } from "@/lib/catalogos-carga"

export function AvisoCargaFallida({ catalogos }: { catalogos: CatalogoCarga[] }) {
  const { catalogosSinCargar, recargarCatalogos } = useStore()
  const [reintentando, setReintentando] = useState(false)
  const faltan = catalogos.filter((c) => catalogosSinCargar.includes(c))
  if (faltan.length === 0) return null

  const reintentar = async () => {
    setReintentando(true)
    try {
      await recargarCatalogos()
    } finally {
      setReintentando(false)
    }
  }

  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-medium text-destructive">No se pudo conectar con la base</p>
          <p className="text-sm text-muted-foreground">
            {textoCargaFallida(faltan)} Los datos no se borraron: lo volvemos a intentar solo, o tocá Reintentar.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={reintentar} disabled={reintentando} className="shrink-0">
        <RefreshCw className={`mr-2 h-4 w-4 ${reintentando ? "animate-spin" : ""}`} />
        {reintentando ? "Reintentando…" : "Reintentar"}
      </Button>
    </div>
  )
}
