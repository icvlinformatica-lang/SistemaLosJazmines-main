"use client"

import { Navigation } from "@/components/navigation"
import { useStore } from "@/lib/store-context"
import { calcularComprasSegmentadas } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Printer, ClipboardList, ArrowLeft, ChefHat, Utensils } from "lucide-react"
import Link from "next/link"

export default function MiseEnPlacePage() {
  const { state } = useStore()
  const evento = state.eventoActual

  const totalPersonas =
    (evento?.adultos || 0) +
    (evento?.adolescentes || 0) +
    (evento?.ninos || 0) +
    (evento?.personasDietasEspeciales || 0)

  const todasLasRecetasIds = evento
    ? [
        ...(evento.recetasAdultos || []),
        ...(evento.recetasAdolescentes || []),
        ...(evento.recetasNinos || []),
        ...(evento.recetasDietasEspeciales || []),
      ]
    : []

  const tieneRecetas = todasLasRecetasIds.length > 0

  if (!evento || !tieneRecetas) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-7xl px-4 pt-24 pb-12">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="mb-4 h-16 w-16 text-muted-foreground" />
            <h1 className="mb-2 text-2xl font-bold">No hay evento planificado</h1>
            <p className="mb-6 text-muted-foreground">
              Primero debes planificar un evento para generar la guia de preparacion
            </p>
            <Button asChild>
              <Link href="/evento">Ir al Planificador</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const compras = calcularComprasSegmentadas(evento, state.recetas, state.insumos)

  // Recetas unicas para el header
  const recetasEvento = todasLasRecetasIds
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .map((id) => state.recetas.find((r) => r.id === id))
    .filter(Boolean)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <Navigation />

      <main className="mx-auto max-w-3xl px-4 pt-24 pb-12 print:pt-8">
        {/* Header */}
        <div className="no-print mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/evento">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Guia de Batalla</h1>
              <p className="text-muted-foreground">Mise en Place lista para la cocina</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>

        {/* Recetas del evento */}
        {recetasEvento.length > 0 && (
          <div className="no-print mb-4 flex flex-wrap gap-2">
            {recetasEvento.map((r) => r && (
              <Badge key={r.id} variant="secondary">{r.nombre}</Badge>
            ))}
          </div>
        )}

        {/* Print-Optimized Content */}
        <Card className="print:border-2 print:border-foreground print:shadow-none">
          <CardHeader className="border-b print:border-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-foreground print:bg-transparent print:border-2 print:border-foreground">
                  <ChefHat className="h-8 w-8 text-background print:text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground print:text-foreground">MISE EN PLACE</p>
                  <CardTitle className="text-2xl print:text-3xl">
                    {evento.nombrePareja || evento.nombre || "Evento"}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {evento.fecha ? new Date(evento.fecha).toLocaleDateString("es-AR") : ""}
                    {evento.salon ? ` — ${evento.salon}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-lg px-3 py-1 print:border-foreground print:text-foreground">
                  {totalPersonas} personas
                </Badge>
                {evento.adultos > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{evento.adultos} adultos</p>
                )}
                {evento.adolescentes > 0 && (
                  <p className="text-xs text-muted-foreground">{evento.adolescentes} adolescentes</p>
                )}
                {evento.ninos > 0 && (
                  <p className="text-xs text-muted-foreground">{evento.ninos} ninos</p>
                )}
                {(evento.personasDietasEspeciales || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">{evento.personasDietasEspeciales} dietas especiales</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {compras.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Utensils className="mb-3 h-10 w-10" />
                <p>No hay insumos calculados para este evento.</p>
              </div>
            ) : (
              <div className="divide-y print:divide-foreground">
                {compras.map((item, index) => {
                  const insumo = state.insumos.find((i) => i.id === item.insumoId)
                  if (!insumo) return null
                  return (
                    <div key={item.insumoId} className="flex items-start gap-4 p-4 print:p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary font-bold print:bg-transparent print:border print:border-foreground">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold">{insumo.descripcion}</h3>
                          <span className="font-mono text-lg font-bold">
                            {item.cantidadNecesaria.toFixed(2)} {insumo.unidad}
                          </span>
                        </div>
                        {item.detalleCorte && (
                          <div className="mt-1 flex items-center gap-2">
                            <Utensils className="h-4 w-4 text-muted-foreground print:text-foreground" />
                            <span className="text-muted-foreground print:text-foreground print:font-medium">
                              {item.detalleCorte}
                            </span>
                          </div>
                        )}
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {item.usadoEnAdultos && (
                            <Badge variant="outline" className="text-xs">Adultos</Badge>
                          )}
                          {item.usadoEnAdolescentes && (
                            <Badge variant="outline" className="text-xs">Adolescentes</Badge>
                          )}
                          {item.usadoEnNinos && (
                            <Badge variant="outline" className="text-xs">Ninos</Badge>
                          )}
                          {item.usadoEnDietasEspeciales && (
                            <Badge variant="outline" className="text-xs">Dietas Especiales</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print Footer */}
        <div className="mt-6 hidden print:block border-t-2 border-foreground pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">Los Jazmines Catering</span>
            <span>{new Date().toLocaleDateString("es-AR")}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
