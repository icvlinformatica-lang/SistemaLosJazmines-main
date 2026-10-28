"use client"

// Vajilla y utensilios — el inventario de lo que la cocina tiene guardado
// para trabajar: platos, cubiertos, tazas, copas, ollas, sartenes,
// utensilios... Pedido de Rodrigo, 27/10/2026: "es solamente llevar stock,
// lo llevaría la gente de cocina y administración lo puede ver".
//
// Es SOLO stock: no tiene precio y no entra en costos de eventos, Caja
// Eventos ni Caja Jazmines. Cocina arma la lista (nombre, categoría y unidad)
// y ve y corrige cuánto hay en cada salón con el lapicito
// (/api/stock-salones/ajuste, el mismo camino que el resto del stock).
// Administración y Soporte ven y corrigen lo mismo. El conteo de un salón
// entero se hace en /stock ("Contar stock de vajilla y utensilios"). El Total
// es la suma de lo contado en los salones (no hay un stock_actual aparte).

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useProfile } from "@/lib/profile-context"
import { puedeEditarCatalogoVajilla } from "@/lib/stock-salones"
import {
  CATEGORIAS_VAJILLA,
  NOMBRE_SECCION_VAJILLA,
  UNIDADES_VAJILLA,
  nombreRepetido,
  type ArticuloVajilla,
} from "@/lib/insumos-vajilla"
import { fetchWithRetry } from "@/lib/fetch-with-retry"
import { StockSalonCelda, useStockContadoSalones, fondoSalon } from "@/components/stock-contado-salones"
import { StockPorSalonCampos, guardarStockPorSalon, valoresInicialesPorSalon } from "@/components/stock-salones-editor"
import { ConfirmAction } from "@/components/confirm-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ClipboardList, Loader2, Pencil, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react"

const SIN_CATEGORIA = "Sin categoría"

function fmtCantidad(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n)
}

interface Formulario {
  descripcion: string
  categoria: string
  unidad: string
}

const FORM_VACIO: Formulario = {
  descripcion: "",
  categoria: "Vajilla",
  unidad: "UN",
}

function VajillaContent() {
  const { toast } = useToast()
  const { perfilActivo } = useProfile()
  // Cocina, Administración y Soporte. Las columnas por salón y el lapicito
  // los decide puedeVerStockSector (adentro de useStockContadoSalones).
  const puedeEditar = puedeEditarCatalogoVajilla(perfilActivo?.id)
  const stockContado = useStockContadoSalones("vajilla")

  const [articulos, setArticulos] = useState<ArticuloVajilla[] | null>(null)
  const [error, setError] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("Todas")

  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  // null = alta de un artículo nuevo.
  const [editando, setEditando] = useState<ArticuloVajilla | null>(null)
  // Id del alta, fijo mientras el diálogo esté abierto: un reintento o un
  // doble clic no crean dos artículos.
  const [idNuevo, setIdNuevo] = useState("")
  const [form, setForm] = useState<Formulario>(FORM_VACIO)
  const [stockSalones, setStockSalones] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/insumos-vajilla")
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(data?.error || "No se pudieron traer los artículos")
        setArticulos([])
        return
      }
      setError("")
      setArticulos(data.articulos || [])
    } catch {
      setError("No se pudieron traer los artículos")
      setArticulos([])
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Las de siempre primero y después las que se hayan escrito a mano.
  const categorias = useMemo(() => {
    const propias = new Set<string>(CATEGORIAS_VAJILLA)
    for (const a of articulos || []) if (a.categoria) propias.add(a.categoria)
    return [...propias]
  }, [articulos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (articulos || []).filter((a) => {
      if (q && !a.descripcion.toLowerCase().includes(q)) return false
      if (categoriaFiltro !== "Todas" && (a.categoria || SIN_CATEGORIA) !== categoriaFiltro) return false
      return true
    })
  }, [articulos, busqueda, categoriaFiltro])

  const abrirAlta = () => {
    setEditando(null)
    setIdNuevo(crypto.randomUUID())
    setForm(FORM_VACIO)
    setStockSalones(valoresInicialesPorSalon(undefined, stockContado.salones))
    setDialogoAbierto(true)
  }

  const abrirEdicion = (a: ArticuloVajilla) => {
    setEditando(a)
    setForm({ descripcion: a.descripcion, categoria: a.categoria || "", unidad: a.unidad })
    setStockSalones(valoresInicialesPorSalon(stockContado.porInsumo.get(a.id), stockContado.salones))
    setDialogoAbierto(true)
  }

  const guardar = async () => {
    const descripcion = form.descripcion.trim()
    if (!descripcion) {
      toast({ title: "Falta el nombre del artículo", variant: "destructive" })
      return
    }
    if (nombreRepetido(descripcion, articulos || [], editando?.id)) {
      toast({ title: `Ya hay un artículo que se llama "${descripcion}"`, variant: "destructive" })
      return
    }
    setGuardando(true)
    try {
      const id = editando?.id ?? idNuevo
      const datos = { descripcion, categoria: form.categoria, unidad: form.unidad }
      const res = editando
        ? await fetchWithRetry(`/api/insumos-vajilla/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos),
          })
        : await fetchWithRetry("/api/insumos-vajilla", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...datos }),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        toast({ title: "No se guardó el artículo", description: data?.error || "Volvé a intentar.", variant: "destructive" })
        return
      }
      // Después del artículo, lo escrito en cada salón (vacío = no se toca).
      if (stockContado.visible) {
        try {
          const total = await guardarStockPorSalon({
            sector: "vajilla",
            insumoId: id,
            resumen: stockContado.porInsumo.get(id),
            valores: stockSalones,
          })
          if (total !== null) stockContado.recargar()
        } catch (e) {
          toast({
            title: "El artículo se guardó, pero el stock por salón no",
            description: e instanceof Error ? e.message : "Volvé a intentar desde el lapicito.",
            variant: "destructive",
          })
        }
      }
      toast({ title: editando ? "Artículo actualizado" : "Artículo agregado", description: descripcion })
      setDialogoAbierto(false)
      cargar()
    } catch {
      toast({ title: "No se guardó el artículo", description: "Se cortó la conexión. Volvé a intentar.", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (a: ArticuloVajilla) => {
    try {
      const res = await fetchWithRetry(`/api/insumos-vajilla/${encodeURIComponent(a.id)}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        toast({ title: "No se borró el artículo", description: data?.error || "Volvé a intentar.", variant: "destructive" })
        return
      }
      toast({ title: "Artículo borrado", description: a.descripcion })
      cargar()
      stockContado.recargar()
    } catch {
      toast({ title: "No se borró el artículo", description: "Se cortó la conexión. Volvé a intentar.", variant: "destructive" })
    }
  }

  const columnas = 4 + (stockContado.visible ? stockContado.salones.length + 1 : 0)

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:max-w-none lg:py-4">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight lg:text-xl">
            <UtensilsCrossed className="h-6 w-6 text-orange-600" aria-hidden />
            {NOMBRE_SECCION_VAJILLA}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platos, cubiertos, tazas, ollas y todo lo que la cocina tiene guardado para trabajar. Es solo stock: no suma a
            costos ni a cajas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/stock">
              <ClipboardList className="mr-2 h-4 w-4" />
              Contar stock
            </Link>
          </Button>
          {puedeEditar && (
            <Button onClick={abrirAlta} disabled={articulos === null || !!error}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar artículo
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 lg:mb-3">
        {["Todas", ...categorias, ...((articulos || []).some((a) => !a.categoria) ? [SIN_CATEGORIA] : [])].map((cat) => (
          <Button
            key={cat}
            variant={categoriaFiltro === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoriaFiltro(cat)}
            className={categoriaFiltro !== cat ? "bg-transparent" : ""}
          >
            {cat}
          </Button>
        ))}
      </div>

      <Card className="lg:gap-3 lg:py-3">
        <CardContent className="space-y-3 lg:px-4 lg:pb-4">
          <div className="flex items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar artículo..."
                className="pl-9"
                aria-label="Buscar artículo"
              />
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {filtrados.length} {filtrados.length === 1 ? "artículo" : "artículos"}
            </span>
          </div>

          {stockContado.error && <p className="text-xs text-muted-foreground">No se pudo cargar el conteo por salón.</p>}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 bg-card">Artículo</TableHead>
                  {/* En el celular se esconden Categoría y Unidad (la unidad va
                      debajo del nombre) para que entren los salones. */}
                  <TableHead className="hidden w-[120px] sm:table-cell">Categoría</TableHead>
                  <TableHead className="hidden w-[80px] sm:table-cell">Unidad</TableHead>
                  {stockContado.visible &&
                    stockContado.salones.map((s) => (
                      <TableHead
                        key={s.id}
                        className="w-[90px] text-right"
                        style={{ ...fondoSalon(s.color), color: s.color }}
                        title={s.nombre}
                      >
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                          {s.nombre}
                        </span>
                      </TableHead>
                    ))}
                  {stockContado.visible && <TableHead className="w-[90px] text-right font-bold">Total</TableHead>}
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {articulos === null ? (
                  <TableRow>
                    <TableCell colSpan={columnas} className="h-24 text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                      </span>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={columnas} className="h-24 whitespace-normal text-center text-red-600">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnas} className="h-24 whitespace-normal text-center text-muted-foreground">
                      {articulos.length === 0
                        ? "Todavía no hay artículos. Agregá el primero con \"Agregar artículo\"."
                        : "No hay artículos que coincidan."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((a) => {
                    const resumen = stockContado.porInsumo.get(a.id)
                    return (
                      <TableRow key={a.id} className="bg-background">
                        <TableCell className="sticky left-0 z-10 max-w-[9rem] whitespace-normal bg-background font-medium sm:max-w-none">
                          {a.descripcion}
                          <span className="block text-xs font-normal text-muted-foreground sm:hidden">{a.unidad}</span>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{a.categoria || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{a.unidad}</TableCell>
                        {stockContado.visible &&
                          stockContado.salones.map((s) => (
                            <TableCell key={s.id} className="text-right" style={fondoSalon(s.color)}>
                              <StockSalonCelda resumen={resumen} unidad={a.unidad} salonId={s.id} salones={stockContado.salones} />
                            </TableCell>
                          ))}
                        {stockContado.visible && (
                          <TableCell className="text-right font-bold tabular-nums">
                            {resumen ? fmtCantidad(resumen.total) : <span className="font-normal text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                        <TableCell>
                          {puedeEditar && (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" aria-label={`Editar ${a.descripcion}`} onClick={() => abrirEdicion(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <ConfirmAction
                                title={`¿Borrar "${a.descripcion}"?`}
                                description="Se borra de la lista y se pierde lo contado en cada salón. El historial de cargas queda."
                                confirmLabel="Sí, borrar"
                                destructive
                                onConfirm={() => borrar(a)}
                              >
                                <Button variant="ghost" size="icon" aria-label={`Borrar ${a.descripcion}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </ConfirmAction>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Un <span className="font-semibold">—</span> quiere decir que en ese salón todavía nadie contó, que no es lo mismo que
            no haber nada. El Total es la suma de los salones.
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogoAbierto} onOpenChange={(open) => !guardando && setDialogoAbierto(open)}>
        <DialogContent className={`max-h-[calc(100dvh-2rem)] overflow-y-auto ${stockContado.visible ? "lg:max-w-4xl" : ""}`}>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar artículo" : "Nuevo artículo de vajilla o utensilio"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Cambiá el nombre, la categoría, la unidad o lo que hay en cada salón."
                : "Agregalo a la lista. Si ya sabés cuánto hay en cada salón, escribilo; si no, se cuenta después en Contar stock."}
            </DialogDescription>
          </DialogHeader>
          <div className={`grid gap-4 py-2 ${stockContado.visible ? "lg:grid-cols-2 lg:items-start lg:gap-x-8" : ""}`}>
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="vajilla-nombre">Nombre</Label>
                <Input
                  id="vajilla-nombre"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Ej: Plato playo blanco"
                  maxLength={120}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vajilla-categoria">Categoría</Label>
                <Input
                  id="vajilla-categoria"
                  list="vajilla-categorias"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  placeholder="Vajilla, Cubiertos, Ollas y sartenes..."
                  maxLength={40}
                />
                <datalist id="vajilla-categorias">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vajilla-unidad">Unidad</Label>
                <Input
                  id="vajilla-unidad"
                  list="vajilla-unidades"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value.toUpperCase() })}
                  placeholder="UN, JUEGO, DOCENA..."
                  maxLength={20}
                />
                <datalist id="vajilla-unidades">
                  {UNIDADES_VAJILLA.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
            </div>
            {stockContado.visible && (
              <StockPorSalonCampos
                salones={stockContado.salones}
                resumen={editando ? stockContado.porInsumo.get(editando.id) : undefined}
                unidad={form.unidad || "UN"}
                valores={stockSalones}
                onChange={setStockSalones}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="bg-transparent" disabled={guardando} onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : editando ? "Guardar" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default function VajillaPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <VajillaContent />
      </Suspense>
    </div>
  )
}
