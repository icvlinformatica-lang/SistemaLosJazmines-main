"use client"

import { useState, Suspense } from "react"

import { useStore } from "@/lib/store-context"
import { useToast } from "@/hooks/use-toast"
import { type InsumoBarra, type Unidad, type CategoriaInsumoBarra, formatCurrency } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { CostosARevisar } from "@/components/costos-a-revisar"
import { ContenidoPorUnidadInput } from "@/components/contenido-por-unidad-input"
import { iconoDeInsumoBarra } from "@/lib/iconos-insumos"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StockSalonCelda, StockContadoNota, useStockContadoSalones, fondoSalon } from "@/components/stock-contado-salones"
import { StockPorSalonCampos, guardarStockPorSalon, valoresInicialesPorSalon } from "@/components/stock-salones-editor"
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
import { Plus, Search, Pencil, Trash2 } from "lucide-react"

const unidades: Unidad[] = ["CC", "KG", "UN", "LT", "GR", "GRS", "L"]
const categorias: CategoriaInsumoBarra[] = ["Alcoholes", "Licores", "Mixers", "Jugos", "Garnish", "Otros"]

const NUEVOS_INSUMOS = new Set([
  "BAR101","BAR102","BAR103","BAR104","BAR105","BAR106","BAR107","BAR108","BAR109","BAR110",
  "BAR111","BAR112","BAR208","BAR209","BAR210","BAR211","BAR212","BAR213","BAR301","BAR302",
  "BAR303","BAR304","BAR401","BAR402","BAR403","BAR404","BAR405","BAR406","BAR407","BAR408",
  "BAR409","BAR410","BAR411",
])

function BarraAlmacenContent() {
  const { insumosBarra, loading: isLoading, addInsumoBarra, updateInsumoBarra, deleteInsumoBarra } = useStore()
  const { toast } = useToast()
  // Conteo físico por salón (solo lectura, solo Administración/Soporte).
  // Independiente de stockActual, que se sigue mostrando y editando igual.
  const stockContado = useStockContadoSalones("barra")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaInsumoBarra | "Todos">("Todos")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingInsumo, setEditingInsumo] = useState<InsumoBarra | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Stock de cada salón en el lapicito (texto de cada campo). Solo se usa
  // si se ven las columnas por salón (Administración / Soporte).
  const [stockSalones, setStockSalones] = useState<Record<string, string>>({})
  const conSalones = Boolean(editingInsumo) && stockContado.visible
  // Barra entra acá a ajustar existencias, pero el catálogo (unidad,
  // contenido, precio) mueve el costo de los cócteles y es de Administración.
  // Los campos se ven igual, apagados: sirve saber en qué unidad está algo.
  // Esto es solo la pantalla; el que corta de verdad es el servidor
  // (lib/insumos-permisos.ts, usado en app/api/insumos-barra/**).
  const { perfilActivo } = useProfile()
  const soloStock = !puedeEditarCatalogo(perfilActivo?.id)
  // La vista por salón vive acá adentro (antes era la pantalla suelta
  // /admin/stock-salones). Solo la ven los perfiles que ven el conteo
  // consolidado; para Barra la pestaña ni aparece.
  const [pestana, setPestana] = useState<"insumos" | "salones">("insumos")

  const [formData, setFormData] = useState({
    codigo: "",
    descripcion: "",
    unidad: "CC" as Unidad,
    stockActual: 0,
    precioUnitario: 0,
    categoria: "Alcoholes" as CategoriaInsumoBarra,
    proveedor: "",
    // Cuánto trae cada botella/lata. Sin esto, un cóctel que pide cc de un
    // insumo por unidad calcula el costo multiplicado (ver normalizeToStockUnit).
    contenidoCantidad: 0,
    contenidoUnidad: "CC" as "GRS" | "CC",
  })

  // Safety check: ensure insumosBarra is always an array
  const safeInsumosBarra = Array.isArray(insumosBarra) ? insumosBarra : []
  
  const filteredInsumos = safeInsumosBarra.filter((insumo) => {
    const matchesSearch =
      insumo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insumo.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategoria = categoriaFiltro === "Todos" || insumo.categoria === categoriaFiltro
    return matchesSearch && matchesCategoria
  })

  const resetForm = () => {
    setFormData({
      codigo: "",
      descripcion: "",
      unidad: "CC",
      stockActual: 0,
      precioUnitario: 0,
      categoria: "Alcoholes",
      proveedor: "",
      contenidoCantidad: 0,
      contenidoUnidad: "CC",
    })
    setEditingInsumo(null)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (editingInsumo && stockContado.visible) {
        // Con stock por salón: primero los salones (el servidor recalcula el
        // total como la suma) y después el resto de los datos con ese total,
        // para no pisarlo con el número viejo del formulario.
        let total: number | null
        try {
          total = await guardarStockPorSalon({
            sector: "barra",
            insumoId: editingInsumo.id,
            resumen: stockContado.porInsumo.get(editingInsumo.id),
            valores: stockSalones,
          })
        } catch (err) {
          toast({
            title: "No se pudo guardar el stock",
            description: err instanceof Error ? err.message : "Revisá tu conexión e intentá de nuevo.",
            variant: "destructive",
          })
          throw err
        }
        const { stockActual: _stockViejo, ...resto } = formData
        await updateInsumoBarra(
          editingInsumo.id,
          total === null ? (soloStock ? {} : resto) : soloStock ? { stockActual: total } : { ...resto, stockActual: total },
        )
        if (total !== null) stockContado.recargar()
      } else if (editingInsumo) {
        await updateInsumoBarra(editingInsumo.id, soloStock ? { stockActual: formData.stockActual } : formData)
      } else {
        await addInsumoBarra(formData)
      }
      resetForm()
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error("Error saving insumo barra:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (insumo: InsumoBarra) => {
    setFormData({
      codigo: insumo.codigo,
      descripcion: insumo.descripcion,
      unidad: insumo.unidad,
      stockActual: insumo.stockActual,
      precioUnitario: insumo.precioUnitario,
      categoria: insumo.categoria,
      proveedor: insumo.proveedor || "",
      contenidoCantidad: insumo.contenidoCantidad ?? 0,
      contenidoUnidad: insumo.contenidoUnidad ?? "CC",
    })
    setEditingInsumo(insumo)
    setStockSalones(valoresInicialesPorSalon(stockContado.porInsumo.get(insumo.id), stockContado.salones))
    setIsAddDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Estas seguro de eliminar este insumo de barra?")) {
      try {
        await deleteInsumoBarra(id)
      } catch (error) {
        console.error("Error deleting insumo barra:", error)
      }
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Cargando insumos de barra...</div>
        </div>
      </main>
    )
  }

  return (
    // En escritorio (lg) la pantalla usa todo el ancho y la cabecera va en
    // una sola línea, para que la tabla tenga lugar. En el celular queda igual.
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:max-w-none lg:py-4">
      <div className="mb-8 lg:mb-3 lg:flex lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight lg:text-xl">Almacen de Insumos de Barra</h1>
            {/* Avisa si hay insumos cuyo costo está mal calculado por
                unidades que no se pueden convertir. Se abre solo una vez
                por día; después queda este botón. Solo para quien puede
                corregir el catálogo (Administración y Soporte), igual que en
                Cócteles: al resto no le sirve y el servidor no se lo da. */}
            {!soloStock && (
              <div className="mt-2 lg:mt-0">
                <CostosARevisar pantalla="barra" />
              </div>
            )}
        <p className="mt-1 text-base text-muted-foreground lg:hidden">Gestiona insumos de cocteleria y bebidas</p>
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
        <StockPorSalonTabla sector="barra" insumos={insumosBarra} />
      ) : (
      <>
      {/* Category Filter */}
      <div className="mb-4 flex flex-wrap gap-2 lg:mb-3">
        <Button
          variant={categoriaFiltro === "Todos" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoriaFiltro("Todos")}
          className={categoriaFiltro !== "Todos" ? "bg-transparent" : ""}
        >
          Todos
        </Button>
        {categorias.map((cat) => (
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
        <CardHeader className="lg:px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="lg:hidden">
              <CardTitle>Inventario de Barra</CardTitle>
              <CardDescription>{filteredInsumos.length} insumos encontrados</CardDescription>
            </div>
            {/* En escritorio: la lupa primero y más ancha (para encontrarla
                de una), la cantidad y el botón de agregar a la derecha. */}
            <div className="flex gap-2 lg:flex-1 lg:items-center lg:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar insumo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-[200px] lg:w-[320px]"
                  aria-label="Buscar insumo"
                />
              </div>
              <span className="hidden text-sm text-muted-foreground lg:ml-auto lg:inline">
                {filteredInsumos.length} insumos
              </span>
              <Dialog
                open={isAddDialogOpen}
                onOpenChange={(open) => {
                  setIsAddDialogOpen(open)
                  if (!open) resetForm()
                }}
              >
                {!soloStock && (
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent className={`max-h-[calc(100dvh-2rem)] overflow-y-auto ${conSalones ? "lg:max-w-4xl" : ""}`}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5">
                      {(() => {
                        const Icono = iconoDeInsumoBarra(formData.descripcion, formData.categoria)
                        return <Icono className="h-6 w-6 shrink-0 text-muted-foreground/40" aria-hidden />
                      })()}
                      {soloStock ? "Ajustar stock" : editingInsumo ? "Editar Insumo de Barra" : "Nuevo Insumo de Barra"}
                    </DialogTitle>
                    <DialogDescription>
                      {soloStock
                        ? "Corregí las existencias. El resto de los datos los cambia Administración."
                        : editingInsumo
                          ? "Modifica los datos del insumo"
                          : "Agrega un nuevo insumo al almacen de barra"}
                    </DialogDescription>
                  </DialogHeader>
                  {/* Con stock por salón, en la compu la ventana va en dos columnas:
                      los datos a la izquierda y los salones a la derecha, para que
                      entre entera sin tener que bajar. */}
                  <div className={`grid gap-4 py-4 ${conSalones ? "lg:grid-cols-2 lg:items-start lg:gap-x-8" : ""}`}>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Codigo</Label>
                        <div className="col-span-3">
                          {editingInsumo ? (
                            <span className="font-mono text-sm">{formData.codigo}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Se asignará automáticamente</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="descripcion" className="text-right">Descripcion</Label>
                        <Input
                          id="descripcion"
                          disabled={soloStock}
                          value={formData.descripcion}
                          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                          className="col-span-3"
                          placeholder="Ej: Vodka Absolut"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="categoria" className="text-right">Categoria</Label>
                        <Select
                          disabled={soloStock}
                          value={formData.categoria}
                          onValueChange={(value) => setFormData({ ...formData, categoria: value as CategoriaInsumoBarra })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categorias.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unidad" className="text-right">Unidad</Label>
                        <Select
                          disabled={soloStock}
                          value={formData.unidad}
                          onValueChange={(value) => setFormData({ ...formData, unidad: value as Unidad })}
                        >
                          <SelectTrigger className="col-span-3">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {unidades.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Solo para lo que se compra por unidad: una botella, una
                          lata. Sin saber cuánto trae, un cóctel que pide cc
                          calcula el costo multiplicado por el envase entero. */}
                      {formData.unidad === "UN" && (
                        <div className="grid grid-cols-4 items-start gap-4">
                          <Label className="text-right pt-2">¿Cuánto trae cada unidad?</Label>
                          <div className="col-span-3">
                            <ContenidoPorUnidadInput
                              disabled={soloStock}
                              cantidad={formData.contenidoCantidad}
                              unidad={formData.contenidoUnidad}
                              onChange={(v) =>
                                setFormData({ ...formData, contenidoCantidad: v.cantidad, contenidoUnidad: v.unidad })
                              }
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {formData.contenidoCantidad > 0 ? (
                                <>Los cócteles que lo pidan en cc van a calcular bien el costo.</>
                              ) : (
                                <>
                                  <strong>Hace falta si algún cóctel lo pide en cc.</strong> Sin este dato el sistema lee
                                  &quot;60 cc&quot; como &quot;60 botellas&quot;.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      {!conSalones && (
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="stock" className="text-right">Stock</Label>
                          <Input
                            id="stock"
                            type="number"
                            value={formData.stockActual}
                            onChange={(e) => setFormData({ ...formData, stockActual: Number.parseFloat(e.target.value) || 0 })}
                            className="col-span-3"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="precio" className="text-right">Precio $</Label>
                        <MoneyInput
                          id="precio"
                          disabled={soloStock}
                          value={formData.precioUnitario}
                          onValueChange={(v) => setFormData({ ...formData, precioUnitario: v })}
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="proveedor" className="text-right">Proveedor</Label>
                        <Input
                          id="proveedor"
                          disabled={soloStock}
                          value={formData.proveedor}
                          onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                          className="col-span-3"
                          placeholder="Opcional"
                        />
                      </div>
                    </div>
                    {conSalones && editingInsumo && (
                      <StockPorSalonCampos
                        salones={stockContado.salones}
                        resumen={stockContado.porInsumo.get(editingInsumo.id)}
                        unidad={formData.unidad}
                        valores={stockSalones}
                        onChange={setStockSalones}
                      />
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" className="bg-transparent" onClick={() => setIsAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? "Guardando..." : editingInsumo ? "Guardar" : "Agregar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
          <div className="rounded-lg border lg:[&_[data-slot=table-container]]:max-h-[calc(100dvh-18.75rem)] lg:[&_[data-slot=table-container]]:overflow-y-auto lg:[&_[data-slot=table-cell]]:py-1 lg:[&_td_button]:min-h-0">
            <Table>
              <TableHeader className="lg:sticky lg:top-0 lg:z-30 lg:bg-card lg:shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead className="w-[80px]">Codigo</TableHead>
                  <TableHead className="sticky left-0 z-20 bg-card">Descripcion</TableHead>
                  <TableHead className="w-[100px]">Categoria</TableHead>
                  <TableHead className="w-[80px]">Unidad</TableHead>
                  <TableHead className="w-[100px] text-right">Stock</TableHead>
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
                  <TableHead className="w-[120px] text-right">Precio Unit.</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInsumos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={stockContado.visible ? 8 : 7} className="h-24 text-center text-muted-foreground">
                      No se encontraron insumos de barra
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInsumos.map((insumo) => (
                    <TableRow key={insumo.id} className={NUEVOS_INSUMOS.has(insumo.codigo) ? "bg-gray-100" : "bg-background"}>
                      <TableCell className="font-mono text-sm">{insumo.codigo}</TableCell>
                      <TableCell className="font-medium sticky left-0 z-10 bg-inherit [background-color:inherit]">
                        {/* Silueta de la bebida (botella, copa, lata según lo
                            que sea). Decorativa, por eso aria-hidden. */}
                        <span className="flex items-center gap-2">
                          {(() => {
                            const Icono = iconoDeInsumoBarra(insumo.descripcion, insumo.categoria)
                            return <Icono className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                          })()}
                          {insumo.descripcion}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{insumo.categoria}</TableCell>
                      <TableCell>{insumo.unidad}</TableCell>
                      <TableCell className="text-right">{insumo.stockActual.toLocaleString()}</TableCell>
                      {stockContado.visible &&
                        stockContado.salones.map((s) => (
                          <TableCell key={s.id} className="text-right" style={fondoSalon(s.color)}>
                            <StockSalonCelda
                              resumen={stockContado.porInsumo.get(insumo.id)}
                              unidad={insumo.unidad}
                              salonId={s.id}
                              salones={stockContado.salones}
                            />
                          </TableCell>
                        ))}
                      <TableCell className="text-right">{formatCurrency(insumo.precioUnitario)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="lg:size-8" onClick={() => handleEdit(insumo)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!soloStock && (
                            <Button variant="ghost" size="icon" className="lg:size-8" onClick={() => handleDelete(insumo.id)}>
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
    </main>
  )
}

export default function BarraAlmacenPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <BarraAlmacenContent />
      </Suspense>
    </div>
  )
}
