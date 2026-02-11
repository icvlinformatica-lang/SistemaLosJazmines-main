"use client"

import { Navigation } from "@/components/navigation"
import { useStore } from "@/lib/store-context"
import { calcularCompras } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Printer, ClipboardList, ArrowLeft, ChefHat, Utensils } from "lucide-react"
import Link from "next/link"

export default function MiseEnPlacePage() {
  const { state } = useStore()
  const evento = state.eventoActual
  const selectedReceta = state.recetas.find((r) => r.id === evento?.recetaId)

  if (!evento || !selectedReceta) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-7xl px-4 pt-24 pb-12">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="mb-4 h-16 w-16 text-muted-foreground" />
            <h1 className="mb-2 text-2xl font-bold">No hay evento planificado</h1>
            <p className="mb-6 text-muted-foreground">
              Primero debes planificar un evento para generar la guía de preparación
            </p>
            <Button asChild>
              <Link href="/evento">Ir al Planificador</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const compras = calcularCompras(
    selectedReceta,
    state.insumos,
    evento.adultos,
    evento.adolescentes,
    evento.ninos,
    evento.factorAdolescentes,
    evento.factorNinos,
  )

  const totalPersonas = evento.adultos + evento.adolescentes + evento.ninos

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
              <h1 className="text-3xl font-bold tracking-tight">Guía de Batalla</h1>
              <p className="text-muted-foreground">Mise en Place lista para la cocina</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>

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
                  <CardTitle className="text-2xl print:text-3xl">{selectedReceta.nombre}</CardTitle>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-lg px-3 py-1 print:border-foreground print:text-foreground">
                  {totalPersonas} personas
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y print:divide-foreground">
              {compras.map((item, index) => (
                <div key={item.insumoId} className="flex items-start gap-4 p-4 print:p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary font-bold print:bg-transparent print:border print:border-foreground">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold">{item.insumo.descripcion}</h3>
                      <span className="font-mono text-lg font-bold">
                        {item.cantidadNecesaria.toFixed(1)} {item.insumo.unidad}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-muted-foreground print:text-foreground" />
                      <span className="text-muted-foreground print:text-foreground print:font-medium">
                        {item.detalleCorte}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
