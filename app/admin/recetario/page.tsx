"use client"
// cache-bust: v6 - isEditMode derived from editingRecetaId
import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  type Receta,
  type InsumoReceta,
  type RecetaCategoria,
  type UnidadReceta,
  formatCurrency,
  calcularCostoReceta,
  contenidoDe,
  generateId,
  getCompatibleRecipeUnits,
  getDefaultRecipeUnit,
  normalizeToStockUnit,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { CostosARevisar } from "@/components/costos-a-revisar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, ChefHat, X, FlaskConical, ChevronDown, ChevronLeft, ChevronRight, Users, Utensils, Search, Printer } from "lucide-react"
import { imprimirListaRecetas, CATEGORIAS_ORDEN_RECETAS } from "@/lib/print-utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/* ── Capacity Carousel ─────────────────────────────────── */
function CapacityCarousel({
  items,
}: {
  items: { receta: Receta; events: number; bottleneck: string }[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const animRef = useRef<number>(0)
  const posRef = useRef(0)

  // Filter out recipes with 0 events, sort descending
  const sorted = [...items]
    .filter((i) => i.events > 0)
    .sort((a, b) => b.events - a.events)

  const scroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (!isPaused) {
      posRef.current += 0.5
      if (posRef.current >= el.scrollWidth / 2) {
        posRef.current = 0
      }
      el.scrollLeft = posRef.current
    }
    animRef.current = requestAnimationFrame(scroll)
  }, [isPaused])

  useEffect(() => {
    if (sorted.length === 0) return
    animRef.current = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(animRef.current)
  }, [scroll, sorted.length])

  const scrollBy = (dir: number) => {
    const el = scrollRef.current
    if (!el) return
    posRef.current += dir * 140
    if (posRef.current < 0) posRef.current = 0
    if (posRef.current >= el.scrollWidth / 2) posRef.current = 0
    el.scrollLeft = posRef.current
  }

  // Duplicate for seamless loop
  const doubled = [...sorted, ...sorted]

  if (sorted.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground text-center py-4">
        No hay recetas con insumos disponibles en almacen.
      </p>
    )
  }

  return (
    <div
      className="mt-3 relative flex items-center gap-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Left arrow */}
      <button
        onClick={() => scrollBy(-1)}
        className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-20"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Track */}
      <div className="overflow-hidden relative flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 z-10 bg-gradient-to-l from-background to-transparent" />

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {doubled.map(({ receta, events, bottleneck }, idx) => (
            <div
              key={`${receta.id}-${idx}`}
              className={cn(
                "shrink-0 w-32 rounded-lg border p-3 text-center transition-shadow",
                isPaused && "shadow-sm",
                "border-border bg-muted/30"
              )}
            >
              <p className="text-xs text-muted-foreground truncate" title={receta.nombre}>
                {receta.nombre}
              </p>
              <p className="text-xl font-bold mt-1">
                {events}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {events === 1 ? "evento" : "eventos"}
              </p>
              {bottleneck && events < 3 && (
                <p
                  className="text-[10px] text-amber-600 truncate mt-1"
                  title={bottleneck}
                >
                  Limite: {bottleneck}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scrollBy(1)}
        className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-20"
        aria-label="Siguiente"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function RecetarioPage() {
  const { state, addReceta, updateReceta, deleteReceta } = useStore()
  const [selectedReceta, setSelectedReceta] = useState<Receta | null>(null)
  // Receta abierta en el Dialog de detalle. Se busca siempre en state.recetas,
  // así el detalle refleja las ediciones y se cierra solo si se elimina.
  const [detalleRecetaId, setDetalleRecetaId] = useState<string | null>(null)
  const detalleReceta = state.recetas.find((r) => r.id === detalleRecetaId) ?? null
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingRecetaId, setEditingRecetaId] = useState<string | null>(null)
  const isEditMode = editingRecetaId !== null
  const [recetaSearch, setRecetaSearch] = useState("")
  // null = todas las categorías
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
  // Mismo orden que el listado impreso y el planificador; las categorías que
  // no están en esa lista van al final.
  const ordenCategoria = (c: string) => {
    const i = CATEGORIAS_ORDEN_RECETAS.indexOf(c)
    return i === -1 ? CATEGORIAS_ORDEN_RECETAS.length : i
  }
  const recetasBuscadas = state.recetas
    .filter(
      (r) =>
        r.nombre.toLowerCase().includes(recetaSearch.toLowerCase()) ||
        r.categoria.toLowerCase().includes(recetaSearch.toLowerCase()),
    )
    // De la A a la Z, sin importar mayúsculas ni acentos.
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
  const recetasFiltradas = categoriaFiltro
    ? recetasBuscadas.filter((r) => r.categoria === categoriaFiltro)
    : recetasBuscadas
  // Solo las categorías que tienen al menos una receta cargada.
  const categoriasConRecetas = Array.from(new Set(state.recetas.map((r) => r.categoria))).sort(
    (a, b) => ordenCategoria(a) - ordenCategoria(b) || a.localeCompare(b, "es", { sensitivity: "base" }),
  )
  const [showCapacity, setShowCapacity] = useState(false)

  // Calculate how many 100-person events each recipe can cover with current stock
  const recipeCapacities = state.recetas.map((receta) => {
    const PAX = 100
    let minEvents = Infinity
    let bottleneckName = ""
    let hasIngredients = false

    for (const ir of receta.insumos) {
      const insumo = state.insumos.find((i) => i.id === ir.insumoId)
      if (!insumo || ir.cantidadBasePorPersona <= 0) continue
      hasIngredients = true
      const normalizedQtyPerPerson = normalizeToStockUnit(ir.cantidadBasePorPersona, ir.unidadReceta, insumo.unidad, contenidoDe(insumo))
      const neededFor100 = normalizedQtyPerPerson * PAX
      if (neededFor100 <= 0) continue
      const eventsFromThisInsumo = Math.floor(insumo.stockActual / neededFor100)
      if (eventsFromThisInsumo < minEvents) {
        minEvents = eventsFromThisInsumo
        bottleneckName = insumo.descripcion
      }
    }

    return {
      receta,
      events: hasIngredients ? (minEvents === Infinity ? 0 : minEvents) : 0,
      bottleneck: bottleneckName,
    }
  })

  // Form state for new/edit recipe
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    imagen: "",
    categoria: "Plato Principal" as RecetaCategoria,
    insumos: [] as InsumoReceta[],
    factorRendimiento: 1,
  })

  const [newIngredient, setNewIngredient] = useState({
    insumoId: "",
    detalleCorte: "",
    cantidadBasePorPersona: 0,
    unidadReceta: undefined as UnidadReceta | undefined,
  })

  const resetForm = () => {
    setFormData({
      codigo: "",
      nombre: "",
      descripcion: "",
      imagen: "",
      categoria: "Plato Principal" as RecetaCategoria,
      insumos: [],
      factorRendimiento: 1,
    })
    setNewIngredient({
      insumoId: "",
      detalleCorte: "",
      cantidadBasePorPersona: 0,
      unidadReceta: undefined,
    })
    setEditingRecetaId(null)
  }

  const handleIngredientSelect = (insumoId: string) => {
    const insumo = state.insumos.find((i) => i.id === insumoId)
    const defaultUnit = insumo ? getDefaultRecipeUnit(insumo.unidad) : undefined
    setNewIngredient({
      ...newIngredient,
      insumoId,
      unidadReceta: defaultUnit,
    })
  }

  const handleAddIngredient = () => {
    if (!newIngredient.insumoId) return
    setFormData({
      ...formData,
      insumos: [...formData.insumos, { ...newIngredient }],
    })
    setNewIngredient({
      insumoId: "",
      detalleCorte: "",
      cantidadBasePorPersona: 0,
      unidadReceta: undefined,
    })
  }

  const handleRemoveIngredient = (index: number) => {
    setFormData({
      ...formData,
      insumos: formData.insumos.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = () => {
    if (isEditMode && selectedReceta) {
      updateReceta(selectedReceta.id, formData)
      setSelectedReceta({ ...selectedReceta, ...formData })
    } else {
      const newReceta = { ...formData, id: generateId() }
      addReceta(formData)
      setSelectedReceta(newReceta as Receta)
    }
    resetForm()
    setIsAddDialogOpen(false)
  }

  const handleEditReceta = () => {
    if (!selectedReceta) return
    setFormData({
      codigo: selectedReceta.codigo,
      nombre: selectedReceta.nombre,
      descripcion: selectedReceta.descripcion,
      imagen: selectedReceta.imagen || "",
      categoria: selectedReceta.categoria,
      insumos: [...selectedReceta.insumos],
      factorRendimiento: selectedReceta.factorRendimiento || 1,
    })
    setEditingRecetaId(selectedReceta.id)
    setIsAddDialogOpen(true)
  }

  const handleDeleteReceta = () => {
    if (!selectedReceta) return
    if (confirm("¿Estás seguro de eliminar esta receta?")) {
      deleteReceta(selectedReceta.id)
      setSelectedReceta(state.recetas.filter((r) => r.id !== selectedReceta.id)[0] || null)
    }
  }

  const getInsumoById = (id: string) => state.insumos.find((i) => i.id === id)

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Laboratorio de Sabores</h1>
            {/* Avisa si hay insumos cuyo costo está mal calculado por
                unidades que no se pueden convertir. Se abre solo una vez
                por día; después queda este botón. */}
            <div className="mt-2">
              <CostosARevisar pantalla="recetario" />
            </div>
            <p className="mt-1 text-base text-muted-foreground">Crea y gestiona tus recetas</p>
          </div>
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
                Nueva Receta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-11/12 max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{isEditMode ? "Editar Receta" : "Nueva Receta"}</DialogTitle>
                <DialogDescription>
                  {isEditMode ? "Modifica los datos de la receta" : "Crea una nueva receta para tu menú"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto">
                <div className="grid gap-4 py-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Código</Label>
                      <div className="mt-1">
                        {isEditMode ? (
                          <span className="font-mono text-sm">{formData.codigo}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Se asignará automáticamente según la categoría</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="nombre">Nombre del Plato</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: Suprema al Verdeo"
                      />
                    </div>

                    <div>
                      <Label htmlFor="descripcion">Descripción</Label>
                      <Textarea
                        id="descripcion"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        className="min-h-[100px]"
                        placeholder="Descripción del plato..."
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="categoria">Categoría del Plato</Label>
                      <Select
                        value={formData.categoria}
                        onValueChange={(value) => setFormData({ ...formData, categoria: value as RecetaCategoria })}
                      >
                        <SelectTrigger id="categoria">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Recepción">Recepcion</SelectItem>
                          <SelectItem value="Entrada">Entrada</SelectItem>
                          <SelectItem value="Plato Principal">Plato Principal</SelectItem>
                          <SelectItem value="Guarnición">Guarnicion</SelectItem>
                          <SelectItem value="Postre">Postre</SelectItem>
                          <SelectItem value="Menú para Niños">Menu para Ninos</SelectItem>
                          <SelectItem value="Menú Adolescente">Menu Adolescente</SelectItem>
                          <SelectItem value="Celiaco">Celiaco</SelectItem>
                          <SelectItem value="Vegano">Vegano</SelectItem>
                          <SelectItem value="Vegetariano">Vegetariano</SelectItem>
                          <SelectItem value="Sin Sal">Sin Sal</SelectItem>
                          <SelectItem value="Mesa Dulce">Mesa Dulce</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Factor de Rendimiento */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Utensils className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Como cargas esta receta?</Label>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Esta receta rinde para</span>
                        <Input
                          type="number"
                          min={1}
                          className="w-20 text-center"
                          value={formData.factorRendimiento}
                          onChange={(e) => setFormData({ ...formData, factorRendimiento: Math.max(1, parseInt(e.target.value) || 1) })}
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">personas</span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="imagen">Foto del Plato</Label>
                      <div className="mt-2 space-y-3">
                        {formData.imagen ? (
                          <div className="relative">
                            <img
                              src={formData.imagen || "/placeholder.svg"}
                              alt="Preview"
                              className="w-full max-w-md h-48 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={() => setFormData({ ...formData, imagen: "" })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <Input
                              id="imagen"
                              type="text"
                              placeholder="Pega la URL de la imagen aquí"
                              value={formData.imagen}
                              onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Puedes usar una URL de imagen desde Google, Unsplash, o cualquier sitio web
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 mt-4">
                    <h4 className="mb-3 font-semibold">Insumos de la Receta</h4>

                    {formData.insumos.length > 0 && (
                      <div className="mb-4 flex flex-col gap-4">
                        {formData.insumos.map((ing, index) => {
                          const insumo = getInsumoById(ing.insumoId)
                          const compatibleUnits = insumo ? getCompatibleRecipeUnits(insumo.unidad) : []
                          return (
                            <div key={index} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-4">
                              {/* Row 1: Ingredient Name + Remove Button */}
                              <div className="flex items-start justify-between">
                                <h5 className="text-lg font-bold">{insumo?.descripcion || "Desconocido"}</h5>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveIngredient(index)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Row 2: Prep Instructions (Full Width) */}
                              <div className="space-y-1">
                                <Label htmlFor={`instruccion-${index}`} className="text-sm text-muted-foreground">
                                  Instrucción / Corte
                                </Label>
                                <Textarea
                                  id={`instruccion-${index}`}
                                  value={ing.detalleCorte}
                                  onChange={(e) => {
                                    const updated = [...formData.insumos]
                                    updated[index] = { ...updated[index], detalleCorte: e.target.value }
                                    setFormData({ ...formData, insumos: updated })
                                  }}
                                  className="w-full min-h-[60px] resize-y"
                                  placeholder="Ej: En cubos de 2cm, Juliana fina..."
                                />
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="flex-1 space-y-1">
                                  <Label htmlFor={`cantidad-${index}`} className="text-sm text-muted-foreground">
                                    Cantidad por Persona
                                  </Label>
                                  <Input
                                    id={`cantidad-${index}`}
                                    type="number"
                                    step="1"
                                    value={ing.cantidadBasePorPersona}
                                    onChange={(e) => {
                                      const updated = [...formData.insumos]
                                      updated[index] = {
                                        ...updated[index],
                                        cantidadBasePorPersona: Number.parseFloat(e.target.value) || 0,
                                      }
                                      setFormData({ ...formData, insumos: updated })
                                    }}
                                  />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <Label className="text-sm text-muted-foreground">Unidad</Label>
                                  <Select
                                    value={ing.unidadReceta || insumo?.unidad}
                                    onValueChange={(value) => {
                                      const updated = [...formData.insumos]
                                      updated[index] = {
                                        ...updated[index],
                                        unidadReceta: value as UnidadReceta,
                                      }
                                      setFormData({ ...formData, insumos: updated })
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {compatibleUnits.map((unit) => (
                                        <SelectItem key={unit} value={unit}>
                                          {unit}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              {ing.unidadReceta && insumo && ing.unidadReceta !== insumo.unidad && (
                                <p className="text-xs text-muted-foreground">
                                  Se convertira automaticamente a {insumo.unidad} en el stock
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="rounded-lg border p-4 space-y-4">
                      {/* Row 1: Select Insumo */}
                      <div className="space-y-1">
                        <Label className="text-sm text-muted-foreground">Insumo</Label>
                        <Select value={newIngredient.insumoId} onValueChange={handleIngredientSelect}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar insumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {state.insumos.map((insumo) => (
                              <SelectItem key={insumo.id} value={insumo.id}>
                                {insumo.descripcion} ({insumo.unidad})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Row 2: Cantidad + Unidad side by side */}
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-sm text-muted-foreground">Cantidad</Label>
                          <Input
                            type="number"
                            step="1"
                            placeholder="Ej: 500"
                            value={newIngredient.cantidadBasePorPersona || ""}
                            onChange={(e) =>
                              setNewIngredient({
                                ...newIngredient,
                                cantidadBasePorPersona: Number.parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        {newIngredient.insumoId && (
                          <div className="w-24 space-y-1">
                            <Label className="text-sm text-muted-foreground">Unidad</Label>
                            <Select
                              value={newIngredient.unidadReceta}
                              onValueChange={(value) =>
                                setNewIngredient({
                                  ...newIngredient,
                                  unidadReceta: value as UnidadReceta,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Unidad" />
                              </SelectTrigger>
                              <SelectContent>
                                {getCompatibleRecipeUnits(getInsumoById(newIngredient.insumoId)?.unidad || "UN").map(
                                  (unit) => (
                                    <SelectItem key={unit} value={unit}>
                                      {unit}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      
                      {/* Row 3: Detalle de corte */}
                      <div className="space-y-1">
                        <Label className="text-sm text-muted-foreground">Detalle de corte (opcional)</Label>
                        <Textarea
                          placeholder="Ej: en juliana, picado fino..."
                          value={newIngredient.detalleCorte}
                          onChange={(e) => setNewIngredient({ ...newIngredient, detalleCorte: e.target.value })}
                          className="min-h-[60px] resize-none"
                          rows={2}
                        />
                      </div>
                      
                      {/* Row 4: Add Button */}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddIngredient}
                        disabled={!newIngredient.insumoId}
                        className="w-full h-12"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Insumo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0 border-t pt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={!formData.nombre || formData.insumos.length === 0}>
                  {isEditMode ? "Guardar Cambios" : "Crear Receta"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Collapsible open={showCapacity} onOpenChange={setShowCapacity} className="mb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Mis Recetas</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2">
                    <span className="text-muted-foreground">Categoría:</span>
                    <span className="font-medium">{categoriaFiltro ?? "Todas"}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-[60vh] overflow-y-auto">
                  <DropdownMenuRadioGroup
                    value={categoriaFiltro ?? ""}
                    onValueChange={(v) => setCategoriaFiltro(v === "" ? null : v)}
                  >
                    <DropdownMenuRadioItem value="" className="justify-between">
                      <span>Todas</span>
                      <span className="text-xs text-muted-foreground">{recetasBuscadas.length}</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    {categoriasConRecetas.map((cat) => (
                      <DropdownMenuRadioItem key={cat} value={cat} className="justify-between">
                        <span>{cat}</span>
                        <span className="text-xs text-muted-foreground">
                          {recetasBuscadas.filter((r) => r.categoria === cat).length}
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-sm text-muted-foreground">
                {recetasFiltradas.length} {recetasFiltradas.length === 1 ? "plato" : "platos"}
              </span>
              {/* Buscador + imprimir van juntos: si no entran, bajan los dos. */}
              <div className="flex min-w-[200px] max-w-sm flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar receta..."
                    value={recetaSearch}
                    onChange={(e) => setRecetaSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => imprimirListaRecetas(recetasFiltradas)}
                  aria-label="Imprimir listado de platos por categoría"
                  title="Imprimir listado de platos"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {state.recetas.length > 0 && (
              <CollapsibleTrigger asChild>
                <button className="flex h-9 shrink-0 items-center gap-2 self-end rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:self-auto">
                  <Users className="h-4 w-4" />
                  <span>STOCK de PLATOS</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showCapacity && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
            )}
          </div>
          <CollapsibleContent>
            <CapacityCarousel items={recipeCapacities} />
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {recetasFiltradas.map((receta) => (
            <button
              key={receta.id}
              type="button"
              onClick={() => {
                // selectedReceta es la que usan handleEditReceta y
                // handleDeleteReceta; detalleRecetaId decide qué muestra el
                // Dialog de detalle.
                setSelectedReceta(receta)
                setDetalleRecetaId(receta.id)
              }}
              className="overflow-hidden rounded-lg border bg-card text-left transition-all hover:shadow-md hover:border-primary/50"
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-primary/5">
                {receta.imagen ? (
                  <img
                    src={receta.imagen}
                    alt={receta.nombre}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      ;(e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden")
                    }}
                  />
                ) : null}
                <ChefHat className={cn("h-10 w-10 text-primary/30", receta.imagen ? "hidden" : "")} />
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate font-semibold leading-tight" title={receta.nombre}>
                  {receta.nombre}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {receta.categoria}
                  </Badge>
                  {(!receta.insumos || receta.insumos.length === 0) && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none border border-amber-400 bg-amber-50 text-amber-600">
                      falta completar
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-primary">
                  {formatCurrency(calcularCostoReceta(receta, state.insumos))}
                  <span className="text-xs font-normal text-muted-foreground"> /pers</span>
                </p>
              </div>
            </button>
          ))}
        </div>

        {recetasFiltradas.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {state.recetas.length === 0 ? "Todavía no hay recetas cargadas." : "Ninguna receta coincide con la búsqueda."}
          </p>
        )}

        <Dialog
          open={detalleReceta !== null}
          onOpenChange={(open) => {
            if (!open) setDetalleRecetaId(null)
          }}
        >
          {detalleReceta && (
            <DialogContent className="max-w-3xl w-11/12 max-h-[90vh] overflow-y-auto">
              <DialogHeader className="text-left">
                <div className="flex flex-wrap items-center gap-2 pr-6">
                  <Badge variant="secondary">{detalleReceta.codigo}</Badge>
                  <Badge variant="default">{detalleReceta.categoria}</Badge>
                  {(detalleReceta.factorRendimiento || 1) > 1 && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Utensils className="h-3 w-3" />
                      Receta para {detalleReceta.factorRendimiento} porciones
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-2xl">{detalleReceta.nombre}</DialogTitle>
                <DialogDescription>{detalleReceta.descripcion}</DialogDescription>
              </DialogHeader>

              {detalleReceta.imagen && (
                <img
                  src={detalleReceta.imagen || "/placeholder.svg"}
                  alt={detalleReceta.nombre}
                  className="w-full h-64 object-cover rounded-lg border"
                />
              )}

              <div className="rounded-xl bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground">Costo estimado por persona</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(calcularCostoReceta(detalleReceta, state.insumos))}
                </p>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-semibold">ADN del Plato</h3>
                <div className="space-y-3">
                  {detalleReceta.insumos.map((item, index) => {
                    const insumo = getInsumoById(item.insumoId)
                    if (!insumo) return null
                    const factor = detalleReceta.factorRendimiento || 1
                    const normalizedQty = normalizeToStockUnit(item.cantidadBasePorPersona, item.unidadReceta, insumo.unidad, contenidoDe(insumo))
                    const costoPorPersona = (normalizedQty / factor) * insumo.precioUnitario
                    const displayUnit = item.unidadReceta || insumo.unidad
                    const cantPorPersona = item.cantidadBasePorPersona / factor

                    return (
                      <div key={index} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                            <FlaskConical className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{insumo.descripcion}</p>
                            {factor > 1 ? (
                              <div className="text-sm text-muted-foreground space-y-0.5">
                                <p>{item.cantidadBasePorPersona} {displayUnit} por preparacion</p>
                                <p className="text-xs text-primary font-medium">→ {cantPorPersona.toFixed(1)} {displayUnit} por persona</p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {item.cantidadBasePorPersona} {displayUnit} por persona
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {item.detalleCorte && <Badge className="mb-1">{item.detalleCorte}</Badge>}
                          <p className="text-sm text-muted-foreground">{formatCurrency(costoPorPersona)}/pers</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <DialogFooter className="border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Se cierra el detalle y se abre el Dialog de edición que
                    // ya existe (mismo formulario que "Nueva Receta").
                    setDetalleRecetaId(null)
                    handleEditReceta()
                  }}
                >
                  Editar
                </Button>
                {/* Si se confirma, la receta deja de existir en state.recetas y
                    este Dialog se cierra solo (detalleReceta pasa a null). */}
                <Button variant="destructive" onClick={handleDeleteReceta}>
                  Eliminar
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </main>
    </div>
  )
}
