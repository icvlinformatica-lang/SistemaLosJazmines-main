"use client"

import { Navigation } from "@/components/navigation"
import { useStore } from "@/lib/store-context"
import { formatCurrency, calcularCompras } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Printer, ShoppingCart, ArrowLeft, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function ComprasPage() {
  const { state } = useStore()
  const evento = state.eventoActual
  const selectedReceta = state.recetas.find((r) => r.id === evento?.recetaId)

  if (!evento || !selectedReceta) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-7xl px-4 pt-24 pb-12">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingCart className="mb-4 h-16 w-16 text-muted-foreground" />
            <h1 className="mb-2 text-2xl font-bold">No hay evento planificado</h1>
            <p className="mb-6 text-muted-foreground">
              Primero debes planificar un evento para generar la orden de compra
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

  const costoTotal = compras.reduce((sum, c) => sum + c.costoEstimado, 0)
  const itemsAComprar = compras.filter((c) => c.cantidadAComprar > 0).length
  const itemsEnStock = compras.filter((c) => c.cantidadAComprar === 0).length

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="mx-auto max-w-4xl px-4 pt-24 pb-12">
        {/* Header */}
        <div className="no-print mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/evento">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Orden de Compra</h1>
              <p className="text-muted-foreground">Lista inteligente de insumos a comprar</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>

        {/* Print Header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">Los Jazmines - Orden de Compra</h1>
          <p className="text-muted-foreground">
            {selectedReceta.nombre} · {evento.adultos + evento.adolescentes + evento.ninos} personas
          </p>
        </div>

        {/* Stats */}
        <div className="no-print mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-chart-1">
                <ShoppingCart className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">A Comprar</p>
                <p className="text-2xl font-bold">{itemsAComprar}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success">
                <CheckCircle2 className="h-6 w-6 text-success-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Stock</p>
                <p className="text-2xl font-bold">{itemsEnStock}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <p className="text-sm opacity-80">Total Estimado</p>
              <p className="text-3xl font-bold">{formatCurrency(costoTotal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Purchase Table */}
        <Card>
          <CardHeader className="no-print">
            <CardTitle>Detalle de Compras</CardTitle>
            <CardDescription>
              Para: {selectedReceta.nombre} · {evento.adultos} adultos, {evento.adolescentes} adolescentes,{" "}
              {evento.ninos} niños
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="text-right">Necesario</TableHead>
                    <TableHead className="text-right">En Stock</TableHead>
                    <TableHead className="text-right">A Comprar</TableHead>
                    <TableHead className="text-right no-print">Precio Unit.</TableHead>
                    <TableHead className="text-right">Costo Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((item) => {
                    const enStock = item.cantidadAComprar === 0
                    return (
                      <TableRow key={item.insumoId} className={cn(enStock && "bg-success/5")}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.insumo.descripcion}</span>
                            {enStock && (
                              <Badge variant="outline" className="text-success border-success">
                                OK
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.cantidadNecesaria.toFixed(1)} {item.insumo.unidad}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.insumo.stockActual.toFixed(1)} {item.insumo.unidad}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn("font-mono font-semibold", enStock ? "text-success" : "text-foreground")}>
                            {item.cantidadAComprar.toFixed(1)} {item.insumo.unidad}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono no-print">
                          {formatCurrency(item.insumo.precioUnitario)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(item.costoEstimado)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
                      Total a Comprar:
                    </TableCell>
                    <TableCell className="text-right text-lg font-bold">{formatCurrency(costoTotal)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
