"use client"

import { useState, Suspense } from "react"

import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { type Insumo, type Unidad, formatCurrency } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { CostosARevisar } from "@/components/costos-a-revisar"
import { ContenidoPorUnidadInput } from "@/components/contenido-por-unidad-input"
import { iconoDeInsumo } from "@/lib/iconos-insumos"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StockSalonCelda, StockContadoNota, useStockContadoSalones } from "@/components/stock-contado-salones"
import { puedeEditarCatalogo } from "@/lib/insumos-permisos"
import { StockPorSalonTabla } from "@/components/stock-por-salon-tabla"
import { useProfile } from "@/lib/profile-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Printer } from "lucide-react"
import { InsumosPrecioHistorialDialog } from "@/components/insumos-precio-historial-dialog"
import { InsumoDeleteDialog } from "@/components/insumo-delete-dialog"

const unidades: Unidad[] = ["CC", "KG", "UN", "LT", "GR"]

type SortField = "codigo" | "descripcion" | "stockActual"
type SortDir = "asc" | "desc"

function AlmacenContent() {
  const { insumos, recetas, loading: isLoading, addInsumo, updateInsumo, deleteInsumo } = useStore()
  // Conteo físico por salón (solo lectura, solo Administración/Soporte).
  // Independiente de stockActual, que se sigue mostrando y editando igual.
  const stockContado = useStockContadoSalones("cocina")
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("codigo")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Cocina entra acá a ajustar existencias, pero el catálogo (unidad,
  // contenido, precio) mueve el costo de las recetas y es de Administración.
  // Los campos se ven igual, apagados: sirve saber en qué unidad está algo.
  // Esto es solo la pantalla; el que corta de verdad es el servidor
  // (lib/insumos-permisos.ts, usado en app/api/insumos/**).
  const { perfilActivo } = useProfile()
  const soloStock = !puedeEditarCatalogo(perfilActivo?.id)
  // La vista por salón vive acá adentro (antes era la pantalla suelta
  // /admin/stock-salones). Solo la ven los perfiles que ven el conteo
  // consolidado; para Cocina la pestaña ni aparece.
  const [pestana, setPestana] = useState<"insumos" | "salones">("insumos")
  // Insumo pendiente de eliminar (abre el diálogo de seguridad)
  const [insumoAEliminar, setInsumoAEliminar] = useState<Insumo | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  // Form state
  const [formData, setFormData] = useState({
    codigo: "",
    descripcion: "",
    unidad: "KG" as Unidad,
    stockActual: 0,
    precioUnitario: 0,
    proveedor: "",
    // Cuánto trae cada unidad (una lata de arvejas = 200 GRS). Solo se pide
    // cuando la unidad es "UN": sin este dato, una receta que pide gramos de
    // un insumo por unidad calcula el costo multiplicado (ver
    // normalizeToStockUnit en lib/store.ts).
    contenidoCantidad: 0,
    contenidoUnidad: "GRS" as "GRS" | "CC",
  })

  // Safety check: ensure insumos is always an array
  const safeInsumos = Array.isArray(insumos) ? insumos : []
  
  const filteredInsumos = safeInsumos
    .filter(
      (insumo) =>
        insumo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insumo.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (insumo.proveedor || "").toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => {
      let valA: string | number = a[sortField]
      let valB: string | number = b[sortField]
      if (sortField === "stockActual") {
        valA = Number(valA)
        valB = Number(valB)
        return sortDir === "asc" ? valA - valB : valB - valA
      }
      return sortDir === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })

  const resetForm = () => {
    setFormData({
      codigo: "",
      descripcion: "",
      unidad: "KG",
      stockActual: 0,
      precioUnitario: 0,
      proveedor: "",
      contenidoCantidad: 0,
      contenidoUnidad: "GRS",
    })
    setEditingInsumo(null)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (editingInsumo) {
        await updateInsumo(editingInsumo.id, soloStock ? { stockActual: formData.stockActual } : formData)
      } else {
        await addInsumo(formData)
      }
      // Solo llegamos acá si el guardado fue exitoso (las funciones del store
      // ahora lanzan error si el servidor rechaza el cambio).
      toast({ title: editingInsumo ? "Insumo actualizado" : "Insumo agregado", description: `${formData.descripcion} se guardó correctamente.` })
      resetForm()
      setIsAddDialogOpen(false)
    } catch (error) {
      // El toast de error ya lo muestra el store; acá dejamos el diálogo abierto
      // para que el usuario pueda reintentar sin perder lo que cargó.
      console.error("Error saving insumo:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (insumo: Insumo) => {
    setFormData({
      codigo: insumo.codigo,
      descripcion: insumo.descripcion,
      unidad: insumo.unidad,
      stockActual: insumo.stockActual,
      precioUnitario: insumo.precioUnitario,
      proveedor: insumo.proveedor || "",
      contenidoCantidad: insumo.contenidoCantidad ?? 0,
      contenidoUnidad: insumo.contenidoUnidad ?? "GRS",
    })
    setEditingInsumo(insumo)
    setIsAddDialogOpen(true)
  }

  // Imprime la lista COMPLETA de insumos (sin filtro de búsqueda) con una
  // columna vacía "Precio nuevo" para anotar a mano en el supermercado.
  // Usa un iframe oculto en vez de window.open: no lo bloquean los
  // bloqueadores de popups y funciona igual en PC y celular.
  const handlePrint = () => {
    const hoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    const todos = [...safeInsumos].sort((a, b) => a.descripcion.localeCompare(b.descripcion))
    if (todos.length === 0) {
      toast({ title: "No hay insumos para imprimir", variant: "destructive" })
      return
    }
    const filas = todos
      .map(
        (i) => `<tr>
          <td class="mono">${i.codigo}</td>
          <td class="desc">${i.descripcion}</td>
          <td class="center">${i.unidad}</td>
          <td class="right">${i.stockActual.toLocaleString("es-AR")}</td>
          <td class="right">${formatCurrency(i.precioUnitario)}</td>
          <td class="nuevo"></td>
        </tr>`,
      )
      .join("")

    const contenido = `<!DOCTYPE html><html><head><title>Lista de Insumos - Los Jazmines</title>
      <style>
        @page { margin: 1cm; size: A4; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; padding: 16px; }
        h1 { font-size: 15px; margin-bottom: 2px; }
        .sub { font-size: 11px; color: #444; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 3px 5px; text-align: left; }
        th { background: #eee; font-size: 10px; text-transform: uppercase; }
        td { height: 18px; }
        .mono { font-family: monospace; font-size: 10px; white-space: nowrap; }
        .desc { font-weight: bold; }
        .center { text-align: center; }
        .right { text-align: right; white-space: nowrap; }
        .nuevo { width: 90px; }
        tr { page-break-inside: avoid; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Lista de Insumos de Cocina — Los Jazmines</h1>
      <div class="sub">Fecha: ${hoy} &nbsp;·&nbsp; ${todos.length} insumos &nbsp;·&nbsp; Anotar el precio nuevo en la última columna</div>
      <table>
        <thead><tr>
          <th>Código</th><th>Descripción</th><th>Unidad</th><th>Stock</th><th>Precio actual</th><th>Precio nuevo</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      </body></html>`

    // Iframe oculto: se escribe el documento, se imprime y se elimina después.
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.setAttribute("aria-hidden", "true")
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      document.body.removeChild(iframe)
      toast({ title: "No se pudo preparar la impresión", description: "Intentá de nuevo.", variant: "destructive" })
      return
    }
    doc.open()
    doc.write(contenido)
    doc.close()

    // Esperar a que el iframe termine de renderizar antes de imprimir.
    const imprimir = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (error) {
        console.error("[v0] Error al imprimir lista de insumos:", error)
        toast({ title: "No se pudo abrir la impresión", description: "Intentá de nuevo.", variant: "destructive" })
      }
      // Eliminar el iframe después de un margen amplio para no cortar el
      // diálogo de impresión en navegadores que no bloquean en print().
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
      }, 60000)
    }
    setTimeout(imprimir, 300)
  }

  // La eliminación pasa por el diálogo de seguridad (InsumoDeleteDialog):
  // muestra las recetas afectadas y exige confirmaciones antes de borrar.
  const handleConfirmDelete = async (insumo: Insumo) => {
    try {
      await deleteInsumo(insumo.id)
      toast({ title: "Insumo eliminado", description: `${insumo.descripcion} se eliminó del almacén.` })
    } catch (error) {
      console.error("Error deleting insumo:", error)
      throw error
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Cargando insumos...</div>
        </div>
      </main>
    )
  }

  return (
    // En escritorio (lg) la pantalla usa todo el ancho y la cabecera va en
    // una sola línea, para que la tabla tenga lugar. En el celular queda igual.
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:max-w-none lg:py-4">
      <div className="mb-8 lg:mb-3 lg:flex lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight lg:text-xl">Almacen de Insumos</h1>
            {/* Avisa si hay insumos cuyo costo está mal calculado por
                unidades que no se pueden convertir. Se abre solo una vez
                por día; después queda este botón. */}
            <div className="mt-2 lg:mt-0">
              <CostosARevisar pantalla="almacen" />
            </div>
        <p className="mt-1 text-base text-muted-foreground lg:hidden">Gestiona tu inventario de insumos, precios y stock</p>
      {stockContado.visible && (
        <div className="mt-4 inline-flex rounded-lg border p-1 lg:mt-0 lg:ml-auto" role="group" aria-label="Qué mostrar">
          {([
            { v: "insumos", label: "Insumos" },
            { v: "salones", label: "Stock por salón" },
          ] as const).map((op) => (
            <button
              key={op.v}
              type="button"
              onClick={() => setPestana(op.v)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors lg:min-h-0 ${
                pestana === op.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>
      )}
      </div>

      {stockContado.visible && pestana === "salones" ? (
        <StockPorSalonTabla sector="cocina" insumos={insumos} />
      ) : (
      <>
      {/* Search and Add */}
      <Card className="lg:gap-3 lg:py-3">
        <CardHeader className="lg:px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="lg:hidden">
              <CardTitle>Inventario de Insumos</CardTitle>
              <CardDescription>{filteredInsumos.length} insumos encontrados</CardDescription>
            </div>
            {/* En escritorio todo va en una sola línea: la lupa primero y más
                ancha (para encontrarla de una), después ordenar, la cantidad
                y los botones. lg:contents deja que cada pieza tome su lugar. */}
            <div className="flex flex-col gap-3 sm:items-end lg:flex-1 lg:flex-row lg:items-center lg:gap-4">
              {/* Search + Print + Add */}
              <div className="flex gap-2 lg:contents">
                <div className="relative lg:order-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar insumo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[200px] lg:w-[320px]"
                    aria-label="Buscar insumo"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={handlePrint} title="Imprimir lista de insumos" className="lg:order-4">
                  <Printer className="h-4 w-4" />
                  <span className="sr-only">Imprimir lista de insumos</span>
                </Button>
                <div className="lg:order-4">
                  <InsumosPrecioHistorialDialog />
                </div>
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={(open) => {
                    setIsAddDialogOpen(open)
                    if (!open) resetForm()
                  }}
                >
                  {!soloStock && (
                    <DialogTrigger asChild>
                      <Button className="lg:order-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar
                      </Button>
                    </DialogTrigger>
                  )}
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2.5">
                        {(() => {
                          const Icono = iconoDeInsumo(formData.descripcion)
                          return <Icono className="h-6 w-6 shrink-0 text-muted-foreground/40" aria-hidden />
                        })()}
                        {soloStock ? "Ajustar stock" : editingInsumo ? "Editar Insumo" : "Nuevo Insumo"}
                      </DialogTitle>
                      <DialogDescription>
                        {soloStock
                          ? "Corregí las existencias. El resto de los datos los cambia Administración."
                          : editingInsumo
                            ? "Modifica los datos del insumo"
                            : "Agrega un nuevo insumo al almacén"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Código</Label>
                        <div className="col-span-3">
                          {editingInsumo ? (
                            <span className="font-mono text-sm">{formData.codigo}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Se asignará automáticamente</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="descripcion" className="text-right">Descripción</Label>
                        <Input id="descripcion" disabled={soloStock} value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} className="col-span-3" placeholder="Ej: Aceite Girasol" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unidad" className="text-right">Unidad</Label>
                        <Select disabled={soloStock} value={formData.unidad} onValueChange={(value) => setFormData({ ...formData, unidad: value as Unidad })}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>{unidades.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      {/* Solo para insumos que se compran por unidad: una
                          lata, una bolsa, un paquete. Sin saber cuánto trae
                          cada uno, una receta en gramos calcula el costo
                          multiplicado (ver normalizeToStockUnit). */}
                      {formData.unidad === "UN" && (
                        <div className="grid grid-cols-4 items-start gap-4">
                          <Label htmlFor="contenido" className="text-right pt-2">
                            ¿Cuánto trae cada unidad?
                          </Label>
                          <div className="col-span-3 space-y-1.5">
                            <ContenidoPorUnidadInput
                              disabled={soloStock}
                              cantidad={formData.contenidoCantidad}
                              unidad={formData.contenidoUnidad}
                              onChange={(v) =>
                                setFormData({ ...formData, contenidoCantidad: v.cantidad, contenidoUnidad: v.unidad })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              {formData.contenidoCantidad > 0 ? (
                                <>
                                  Una unidad trae {formData.contenidoCantidad}{" "}
                                  {formData.contenidoUnidad === "GRS" ? "gramos" : "cc"}. Las recetas que lo pidan en{" "}
                                  {formData.contenidoUnidad === "GRS" ? "gramos" : "cc"} van a calcular bien el costo.
                                </>
                              ) : (
                                <>
                                  Opcional, pero <strong>hace falta si alguna receta lo pide en gramos o cc</strong>. Sin
                                  este dato el sistema lee &quot;30 gramos&quot; como &quot;30 unidades&quot; y el costo
                                  sale multiplicado.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="stock" className="text-right">Stock</Label>
                        <Input id="stock" type="number" value={formData.stockActual} onChange={(e) => setFormData({ ...formData, stockActual: Number.parseFloat(e.target.value) || 0 })} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="precio" className="text-right">Precio $</Label>
                        <MoneyInput id="precio" disabled={soloStock} value={formData.precioUnitario} onValueChange={(v) => setFormData({ ...formData, precioUnitario: v })} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="proveedor" className="text-right">Proveedor</Label>
                        <Input id="proveedor" disabled={soloStock} value={formData.proveedor} onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })} className="col-span-3" placeholder="Ej: Distribuidora Norte" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Guardando..." : editingInsumo ? "Guardar" : "Agregar"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Sort chips */}
              <div className="flex items-center gap-1.5 lg:order-2">
                <span className="text-xs text-muted-foreground mr-1">Ordenar:</span>
                {(
                  [
                    { field: "codigo" as SortField, label: "N° Insumo" },
                    { field: "descripcion" as SortField, label: "A–Z" },
                    { field: "stockActual" as SortField, label: "Cantidad" },
                  ] as const
                ).map(({ field, label }) => {
                  const active = sortField === field
                  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => handleSort(field)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors lg:min-h-0 ${
                        active
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  )
                })}
              </div>
              <span className="hidden text-sm text-muted-foreground lg:order-3 lg:ml-auto lg:inline">
                {filteredInsumos.length} insumos
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="lg:px-4 lg:pb-4">
          {(stockContado.visible || stockContado.error) && <StockContadoNota error={stockContado.error} />}
          <div className="overflow-x-auto">
          {/* En escritorio la tabla ocupa el alto que queda de la pantalla y
              se desplaza adentro, con los títulos de las columnas fijos. Las
              filas son más bajas (con mouse no hace falta el botón de 44 px
              que piden las pantallas táctiles), así entran más insumos. */}
          <div className="rounded-lg border lg:[&_[data-slot=table-container]]:max-h-[calc(100dvh-15rem)] lg:[&_[data-slot=table-container]]:overflow-y-auto lg:[&_[data-slot=table-cell]]:py-1 lg:[&_td_button]:min-h-0">
            <Table>
              <TableHeader className="lg:sticky lg:top-0 lg:z-30 lg:bg-card lg:shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead className="w-[80px]">Código</TableHead>
                  <TableHead className="sticky left-0 z-20 bg-card">Descripción</TableHead>
                  <TableHead className="w-[80px]">Unidad</TableHead>
                  <TableHead className="w-[100px] text-right">Stock</TableHead>
                  {stockContado.visible &&
                    stockContado.salones.map((s) => (
                      <TableHead key={s.id} className="w-[76px] px-2 text-right align-bottom text-[11px] leading-tight" title={s.nombre}>
                        {s.nombre}
                      </TableHead>
                    ))}
                  <TableHead className="w-[120px] text-right">Precio Unit.</TableHead>
                  <TableHead className="w-[130px]">Proveedor</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInsumos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={stockContado.visible ? 8 : 7} className="h-24 text-center text-muted-foreground">
                      No se encontraron insumos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInsumos.map((insumo) => (
                    <TableRow key={insumo.id} className="bg-background">
                      <TableCell className="font-mono text-sm">{insumo.codigo}</TableCell>
                      <TableCell className="font-medium sticky left-0 z-10 bg-inherit [background-color:inherit]">
                        {/* Silueta del insumo: ayuda a reconocerlo de un
                            vistazo en una lista de 182. Decorativa, por eso
                            aria-hidden. */}
                        <span className="flex items-center gap-2">
                          {(() => {
                            const Icono = iconoDeInsumo(insumo.descripcion)
                            return <Icono className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                          })()}
                          {insumo.descripcion}
                        </span>
                      </TableCell>
                      <TableCell>{insumo.unidad}</TableCell>
                      <TableCell className="text-right">{insumo.stockActual.toLocaleString()}</TableCell>
                      {stockContado.visible &&
                        stockContado.salones.map((s) => (
                          <TableCell key={s.id} className="text-right">
                            <StockSalonCelda
                              resumen={stockContado.porInsumo.get(insumo.id)}
                              unidad={insumo.unidad}
                              salonId={s.id}
                              salones={stockContado.salones}
                            />
                          </TableCell>
                        ))}
                      <TableCell className="text-right">{formatCurrency(insumo.precioUnitario)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{insumo.proveedor || "-"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="lg:size-8" onClick={() => handleEdit(insumo)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!soloStock && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="lg:size-8"
                              onClick={() => setInsumoAEliminar(insumo)}
                              aria-label={`Eliminar ${insumo.descripcion}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Diálogo de seguridad para eliminar insumos */}
      <InsumoDeleteDialog
        insumo={insumoAEliminar}
        recetas={Array.isArray(recetas) ? recetas : []}
        onConfirm={handleConfirmDelete}
        onClose={() => setInsumoAEliminar(null)}
      />
    </main>
  )
}

export default function AlmacenPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <AlmacenContent />
      </Suspense>
    </div>
  )
}
