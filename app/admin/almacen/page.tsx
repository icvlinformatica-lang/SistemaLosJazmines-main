"use client"

import { useState, Suspense } from "react"

import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { type Insumo, type Unidad, formatCurrency } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("codigo")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
    })
    setEditingInsumo(null)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (editingInsumo) {
        await updateInsumo(editingInsumo.id, formData)
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
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Almacen de Insumos</h1>
        <p className="mt-1 text-base text-muted-foreground">Gestiona tu inventario de insumos, precios y stock</p>
      </div>

      {/* Search and Add */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Inventario de Insumos</CardTitle>
              <CardDescription>{filteredInsumos.length} insumos encontrados</CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              {/* Search + Print + Add */}
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar insumo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={handlePrint} title="Imprimir lista de insumos">
                  <Printer className="h-4 w-4" />
                  <span className="sr-only">Imprimir lista de insumos</span>
                </Button>
                <InsumosPrecioHistorialDialog />
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={(open) => {
                    setIsAddDialogOpen(open)
                    if (!open) resetForm()
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingInsumo ? "Editar Insumo" : "Nuevo Insumo"}</DialogTitle>
                      <DialogDescription>
                        {editingInsumo ? "Modifica los datos del insumo" : "Agrega un nuevo insumo al almacén"}
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
                        <Input id="descripcion" value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} className="col-span-3" placeholder="Ej: Aceite Girasol" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unidad" className="text-right">Unidad</Label>
                        <Select value={formData.unidad} onValueChange={(value) => setFormData({ ...formData, unidad: value as Unidad })}>
                          <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                          <SelectContent>{unidades.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="stock" className="text-right">Stock</Label>
                        <Input id="stock" type="number" value={formData.stockActual} onChange={(e) => setFormData({ ...formData, stockActual: Number.parseFloat(e.target.value) || 0 })} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="precio" className="text-right">Precio $</Label>
                        <MoneyInput id="precio" value={formData.precioUnitario} onValueChange={(v) => setFormData({ ...formData, precioUnitario: v })} className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="proveedor" className="text-right">Proveedor</Label>
                        <Input id="proveedor" value={formData.proveedor} onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })} className="col-span-3" placeholder="Ej: Distribuidora Norte" />
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
              <div className="flex items-center gap-1.5">
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
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[80px]">Unidad</TableHead>
                  <TableHead className="w-[100px] text-right">Stock</TableHead>
                  <TableHead className="w-[120px] text-right">Precio Unit.</TableHead>
                  <TableHead className="w-[130px]">Proveedor</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInsumos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No se encontraron insumos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInsumos.map((insumo) => (
                    <TableRow key={insumo.id}>
                      <TableCell className="font-mono text-sm">{insumo.codigo}</TableCell>
                      <TableCell className="font-medium">{insumo.descripcion}</TableCell>
                      <TableCell>{insumo.unidad}</TableCell>
                      <TableCell className="text-right">{insumo.stockActual.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(insumo.precioUnitario)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{insumo.proveedor || "-"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(insumo)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setInsumoAEliminar(insumo)}
                            aria-label={`Eliminar ${insumo.descripcion}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
