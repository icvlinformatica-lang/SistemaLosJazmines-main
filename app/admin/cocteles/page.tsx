"use client"

import { useState } from "react"
import { useStore } from "@/lib/store-context"
import {
  type Coctel,
  type InsumoCoctel,
  type UnidadReceta,
  type CategoriaCoctel,
  getCompatibleRecipeUnits,
  getDefaultRecipeUnit,
  normalizeToStockUnit,
  contenidoDe,
  formatCurrency,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { CostosARevisar } from "@/components/costos-a-revisar"
import { useProfile } from "@/lib/profile-context"
import { puedeEditarCocteles, puedeVerCostosCocteles } from "@/lib/cocteles-permisos"
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
import { Plus, Trash2, Wine, Pencil, Beer, ChevronDown, Search, FlaskConical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { costoPorTrago } from "@/lib/precio-barra"
import { cn } from "@/lib/utils"

export default function CoctelesPage() {
  const { state, addCoctel, updateCoctel, deleteCoctel } = useStore()
  const [selectedCoctel, setSelectedCoctel] = useState<Coctel | null>(null)
  // Cóctel abierto en el Dialog de detalle. Se busca siempre en
  // state.cocteles, así el detalle refleja las ediciones y se cierra solo si
  // se elimina.
  const [detalleCoctelId, setDetalleCoctelId] = useState<string | null>(null)
  const detalleCoctel = state.cocteles.find((c) => c.id === detalleCoctelId) ?? null
  const [busqueda, setBusqueda] = useState("")
  // Barra entra acá solo para consultar de qué está hecho cada cóctel: ve los
  // insumos y las cantidades, no los precios ni los botones de editar. Los
  // precios de la barra los maneja Administración. Esto es la pantalla; el
  // servidor corta igual (lib/cocteles-permisos.ts, usado en /api/cocteles).
  const { perfilActivo } = useProfile()
  const puedeEditar = puedeEditarCocteles(perfilActivo?.id)
  const veCostos = puedeVerCostosCocteles(perfilActivo?.id)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  // Bar template state
  const [filterCategoria, setFilterCategoria] = useState<string>("all")

  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    imagen: "",
    categoria: "Con Alcohol" as CategoriaCoctel,
    insumos: [] as InsumoCoctel[],
    preparacion: "",
  })

  const [newIngredient, setNewIngredient] = useState({
    insumoBarraId: "",
    cantidadPorCoctel: 0,
    unidadCoctel: undefined as UnidadReceta | undefined,
    detallePreparacion: "",
  })

  // Buscador → de la A a la Z → filtro de categoría (mismo criterio que el recetario).
  const coctelesBuscados = state.cocteles
    .filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
  const categoriaDe = (c: Coctel) => c.categoria || "Con Alcohol"
  const filteredCocteles =
    filterCategoria === "all" ? coctelesBuscados : coctelesBuscados.filter((c) => categoriaDe(c) === filterCategoria)

  const resetForm = () => {
    setFormData({
      codigo: "",
      nombre: "",
      descripcion: "",
      imagen: "",
      categoria: "Con Alcohol",
      insumos: [],
      preparacion: "",
    })
    setNewIngredient({
      insumoBarraId: "",
      cantidadPorCoctel: 0,
      unidadCoctel: undefined,
      detallePreparacion: "",
    })
    setIsEditMode(false)
  }

  const handleIngredientSelect = (insumoBarraId: string) => {
    const insumo = state.insumosBarra.find((i) => i.id === insumoBarraId)
    const defaultUnit = insumo ? getDefaultRecipeUnit(insumo.unidad) : undefined
    setNewIngredient({
      ...newIngredient,
      insumoBarraId,
      unidadCoctel: defaultUnit,
    })
  }

  const handleAddIngredient = () => {
    if (!newIngredient.insumoBarraId) return
    setFormData({
      ...formData,
      insumos: [...formData.insumos, { ...newIngredient }],
    })
    setNewIngredient({
      insumoBarraId: "",
      cantidadPorCoctel: 0,
      unidadCoctel: undefined,
      detallePreparacion: "",
    })
  }

  const handleRemoveIngredient = (index: number) => {
    setFormData({
      ...formData,
      insumos: formData.insumos.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = async () => {
    if (isEditMode && selectedCoctel) {
      await updateCoctel(selectedCoctel.id, formData)
      setSelectedCoctel({ ...selectedCoctel, ...formData })
    } else {
      const newCoctel = await addCoctel(formData)
      if (newCoctel) setSelectedCoctel(newCoctel)
    }
    resetForm()
    setIsAddDialogOpen(false)
  }

  const handleEditCoctel = () => {
    if (!selectedCoctel) return
    setFormData({
      codigo: selectedCoctel.codigo,
      nombre: selectedCoctel.nombre,
      descripcion: selectedCoctel.descripcion,
      imagen: selectedCoctel.imagen || "",
      categoria: selectedCoctel.categoria || "Con Alcohol",
      insumos: [...selectedCoctel.insumos],
      preparacion: selectedCoctel.preparacion || "",
    })
    setIsEditMode(true)
    setIsAddDialogOpen(true)
  }

  const handleDeleteCoctel = () => {
    if (!selectedCoctel) return
    if (confirm("Estas seguro de eliminar este coctel?")) {
      deleteCoctel(selectedCoctel.id)
      setSelectedCoctel(state.cocteles.filter((c) => c.id !== selectedCoctel.id)[0] || null)
    }
  }

  const getInsumoBarraById = (id: string) => state.insumosBarra.find((i) => i.id === id)

  // Insumos de barra SIEMPRE en orden alfabético para los selectores
  const insumosBarraOrdenados = [...state.insumosBarra].sort((a, b) =>
    a.descripcion.localeCompare(b.descripcion, "es", { sensitivity: "base" }),
  )

  // Costo del coctel por persona: suma de (cantidad convertida a unidad de stock) x precio unitario de cada insumo.
  // Misma cuenta que usa el cotizador para el precio de la barra personalizada (lib/precio-barra.ts).
  const getCostoCoctel = (coctel: Coctel) => costoPorTrago(coctel, state.insumosBarra)

  // --- Convertir un insumo de barra en un coctel (para que aparezca en el evento) ---
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false)
  const [convertInsumoId, setConvertInsumoId] = useState("")
  const [convertCantidad, setConvertCantidad] = useState<number>(1)

  // Genera el proximo codigo COC disponible (COC001, COC002, ...)
  const getNextCoctelCodigo = () => {
    const nums = state.cocteles
      .map((c) => {
        const m = /^COC(\d+)$/i.exec(c.codigo || "")
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !isNaN(n))
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    return `COC${String(next).padStart(3, "0")}`
  }

  const insumoParaConvertir = state.insumosBarra.find((i) => i.id === convertInsumoId)

  const openConvertDialog = () => {
    setConvertInsumoId("")
    setConvertCantidad(1)
    setIsConvertDialogOpen(true)
  }

  const handleConvertInsumo = async () => {
    const insumo = state.insumosBarra.find((i) => i.id === convertInsumoId)
    if (!insumo) return
    // Categoria del coctel segun el tipo de insumo
    const categoria: CategoriaCoctel =
      insumo.categoria === "Alcoholes" || insumo.categoria === "Licores" ? "Con Alcohol" : "Sin Alcohol"
    const nuevoCoctel: Omit<Coctel, "id"> = {
      codigo: getNextCoctelCodigo(),
      nombre: insumo.descripcion,
      descripcion: `Bebida directa de barra: ${insumo.descripcion}`,
      categoria,
      insumos: [
        {
          insumoBarraId: insumo.id,
          cantidadPorCoctel: convertCantidad > 0 ? convertCantidad : 1,
          unidadCoctel: getDefaultRecipeUnit(insumo.unidad),
        },
      ],
      preparacion: "",
    }
    const created = await addCoctel(nuevoCoctel)
    if (created) setSelectedCoctel(created)
    setIsConvertDialogOpen(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carta de Cocteles</h1>
            {/* Avisa si hay insumos cuyo costo está mal calculado por
                unidades que no se pueden convertir. Se abre solo una vez
                por día; después queda este botón. */}
            {veCostos && (
              <div className="mt-2">
                <CostosARevisar pantalla="cocteles" />
              </div>
            )}
            <p className="mt-1 text-base text-muted-foreground">
              {puedeEditar ? "Crea y gestiona tus recetas de cocteles" : "De qué está hecho cada cóctel"}
            </p>
          </div>
          {puedeEditar && (
          <div className="flex flex-wrap gap-2">
            <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openConvertDialog}>
                  <Beer className="mr-2 h-4 w-4" />
                  Desde insumo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md w-11/12">
                <DialogHeader>
                  <DialogTitle>Agregar bebida desde un insumo</DialogTitle>
                  <DialogDescription>
                    Convertí un insumo de barra (ej: cerveza, agua, gaseosa) en una bebida que podrás
                    seleccionar en la barra del evento.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div>
                    <Label htmlFor="convert-insumo">Insumo de barra</Label>
                    <Select value={convertInsumoId} onValueChange={setConvertInsumoId}>
                      <SelectTrigger id="convert-insumo">
                        <SelectValue placeholder="Elegí un insumo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {insumosBarraOrdenados.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.descripcion} ({i.categoria})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {insumoParaConvertir && (
                    <div>
                      <Label htmlFor="convert-cantidad">
                        Cantidad por unidad ({getDefaultRecipeUnit(insumoParaConvertir.unidad)})
                      </Label>
                      <Input
                        id="convert-cantidad"
                        type="number"
                        min={0}
                        step="any"
                        value={convertCantidad}
                        onChange={(e) => setConvertCantidad(Number(e.target.value))}
                      />
                      <p className="mt-1 text-sm text-muted-foreground">
                        Se creará como{" "}
                        <span className="font-medium text-foreground">
                          {insumoParaConvertir.categoria === "Alcoholes" ||
                          insumoParaConvertir.categoria === "Licores"
                            ? "Con Alcohol"
                            : "Sin Alcohol"}
                        </span>
                        . Podés editarla luego como cualquier cóctel.
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleConvertInsumo} disabled={!convertInsumoId}>
                    Crear bebida
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                  Nuevo Coctel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl w-11/12 max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Editar Coctel" : "Nuevo Coctel"}</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? "Modifica los datos del coctel" : "Crea un nuevo coctel para tu carta"}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto">
                  <div className="grid gap-4 py-4">
                    <div className="space-y-4">
                      <div>
                        <Label>Codigo</Label>
                        <div className="mt-1">
                          {isEditMode ? (
                            <span className="font-mono text-sm">{formData.codigo}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Se asignará automáticamente</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="nombre">Nombre del Coctel</Label>
                        <Input
                          id="nombre"
                          value={formData.nombre}
                          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                          placeholder="Ej: Mojito"
                        />
                      </div>
                      <div>
                        <Label htmlFor="descripcion">Descripcion</Label>
                        <Textarea
                          id="descripcion"
                          value={formData.descripcion}
                          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                          className="min-h-[60px]"
                          placeholder="Descripcion del coctel..."
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="categoria">Categoria</Label>
                        <Select
                          value={formData.categoria}
                          onValueChange={(v) => setFormData({ ...formData, categoria: v as CategoriaCoctel })}
                        >
                          <SelectTrigger id="categoria">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Con Alcohol">Con Alcohol</SelectItem>
                            <SelectItem value="Sin Alcohol">Sin Alcohol</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="preparacion">Preparacion (opcional)</Label>
                        <Textarea
                          id="preparacion"
                          value={formData.preparacion}
                          onChange={(e) => setFormData({ ...formData, preparacion: e.target.value })}
                          className="min-h-[80px]"
                          placeholder="Pasos de preparacion..."
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* Insumos del Coctel */}
                    <div className="mt-4">
                      <h4 className="mb-3 font-semibold">Insumos del Coctel</h4>

                      {formData.insumos.length > 0 && (
                        <div className="mb-4 flex flex-col gap-3">
                          {formData.insumos.map((ing, index) => {
                            const insumo = getInsumoBarraById(ing.insumoBarraId)
                            return (
                              <div key={index} className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                                <div className="flex-1">
                                  <span className="font-medium">{insumo?.descripcion || "Desconocido"}</span>
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    {ing.cantidadPorCoctel} {ing.unidadCoctel || insumo?.unidad}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveIngredient(index)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-sm text-muted-foreground">Insumo de Barra</Label>
                          <Select value={newIngredient.insumoBarraId} onValueChange={handleIngredientSelect}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seleccionar insumo..." />
                            </SelectTrigger>
                            <SelectContent>
                              {insumosBarraOrdenados.map((insumo) => (
                                <SelectItem key={insumo.id} value={insumo.id}>
                                  {insumo.descripcion} ({insumo.unidad})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1 space-y-1">
                            <Label className="text-sm text-muted-foreground">Cantidad por coctel</Label>
                            <Input
                              type="number"
                              step="1"
                              placeholder="Ej: 60"
                              value={newIngredient.cantidadPorCoctel || ""}
                              onChange={(e) =>
                                setNewIngredient({
                                  ...newIngredient,
                                  cantidadPorCoctel: Number.parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          {newIngredient.insumoBarraId && (
                            <div className="w-24 space-y-1">
                              <Label className="text-sm text-muted-foreground">Unidad</Label>
                              <Select
                                value={newIngredient.unidadCoctel}
                                onValueChange={(value) =>
                                  setNewIngredient({ ...newIngredient, unidadCoctel: value as UnidadReceta })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Unidad" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getCompatibleRecipeUnits(
                                    getInsumoBarraById(newIngredient.insumoBarraId)?.unidad || "UN",
                                  ).map((unit) => (
                                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full bg-transparent"
                          onClick={handleAddIngredient}
                          disabled={!newIngredient.insumoBarraId || !newIngredient.cantidadPorCoctel}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Agregar Insumo
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" className="bg-transparent" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit} disabled={!formData.nombre}>
                    {isEditMode ? "Guardar" : "Crear Coctel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          )}
        </div>

        {/* Una línea: título, categoría, cantidad y buscador (mismo diseño que Recetas). */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Mis Cócteles</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-2">
                <span className="text-muted-foreground">Categoría:</span>
                <span className="font-medium">{filterCategoria === "all" ? "Todos" : filterCategoria}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuRadioGroup value={filterCategoria} onValueChange={setFilterCategoria}>
                <DropdownMenuRadioItem value="all" className="justify-between">
                  <span>Todos</span>
                  <span className="text-xs text-muted-foreground">{coctelesBuscados.length}</span>
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {(["Con Alcohol", "Sin Alcohol"] as const).map((cat) => (
                  <DropdownMenuRadioItem key={cat} value={cat} className="justify-between">
                    <span>{cat}</span>
                    <span className="text-xs text-muted-foreground">
                      {coctelesBuscados.filter((c) => categoriaDe(c) === cat).length}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-sm text-muted-foreground">
            {filteredCocteles.length} {filteredCocteles.length === 1 ? "cóctel" : "cócteles"}
          </span>
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cóctel..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredCocteles.map((coctel) => (
            <button
              key={coctel.id}
              type="button"
              onClick={() => {
                // selectedCoctel es el que usan handleEditCoctel y
                // handleDeleteCoctel; detalleCoctelId decide qué muestra el
                // Dialog de detalle.
                setSelectedCoctel(coctel)
                setDetalleCoctelId(coctel.id)
              }}
              className="overflow-hidden rounded-lg border bg-card text-left transition-all hover:shadow-md hover:border-primary/50"
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-primary/5">
                {coctel.imagen ? (
                  <img
                    src={coctel.imagen}
                    alt={coctel.nombre}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      ;(e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden")
                    }}
                  />
                ) : null}
                <Wine className={cn("h-10 w-10 text-primary/30", coctel.imagen ? "hidden" : "")} />
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate font-semibold leading-tight" title={coctel.nombre}>
                  {coctel.nombre}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant={categoriaDe(coctel) === "Sin Alcohol" ? "secondary" : "outline"} className="text-xs">
                    {categoriaDe(coctel)}
                  </Badge>
                  {coctel.insumos.length === 0 && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none border border-amber-400 bg-amber-50 text-amber-600">
                      falta completar
                    </span>
                  )}
                </div>
                {veCostos ? (
                  <p className="text-sm font-medium text-primary">
                    {formatCurrency(getCostoCoctel(coctel))}
                    <span className="text-xs font-normal text-muted-foreground"> /pers</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {coctel.insumos.length} {coctel.insumos.length === 1 ? "insumo" : "insumos"}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        {filteredCocteles.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {state.cocteles.length === 0 ? "Todavía no hay cócteles cargados." : "Ningún cóctel coincide con la búsqueda."}
          </p>
        )}

        <Dialog
          open={detalleCoctel !== null}
          onOpenChange={(open) => {
            if (!open) setDetalleCoctelId(null)
          }}
        >
          {detalleCoctel && (
            <DialogContent className="max-w-3xl w-11/12 max-h-[90vh] overflow-y-auto">
              <DialogHeader className="text-left">
                <div className="flex flex-wrap items-center gap-2 pr-6">
                  {detalleCoctel.codigo && <Badge variant="secondary">{detalleCoctel.codigo}</Badge>}
                  <Badge variant="default">{categoriaDe(detalleCoctel)}</Badge>
                </div>
                <DialogTitle className="text-2xl">{detalleCoctel.nombre}</DialogTitle>
                <DialogDescription>{detalleCoctel.descripcion}</DialogDescription>
              </DialogHeader>

              {detalleCoctel.imagen && (
                <img
                  src={detalleCoctel.imagen}
                  alt={detalleCoctel.nombre}
                  className="w-full h-64 object-cover rounded-lg border"
                />
              )}

              {veCostos && (
                <div className="rounded-xl bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">Costo estimado por persona</p>
                  <p className="text-3xl font-bold text-primary">{formatCurrency(getCostoCoctel(detalleCoctel))}</p>
                </div>
              )}

              <div>
                <h3 className="mb-4 text-lg font-semibold">Insumos</h3>
                {detalleCoctel.insumos.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sin insumos cargados</p>
                ) : (
                  <div className="space-y-3">
                    {detalleCoctel.insumos.map((ing, idx) => {
                      const insumo = getInsumoBarraById(ing.insumoBarraId)
                      const costo = insumo
                        ? normalizeToStockUnit(ing.cantidadPorCoctel, ing.unidadCoctel, insumo.unidad, contenidoDe(insumo)) *
                          (insumo.precioUnitario || 0)
                        : 0
                      return (
                        <div key={idx} className="flex items-center justify-between rounded-lg border p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                              <FlaskConical className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{insumo?.descripcion || "Desconocido"}</p>
                              <p className="text-sm text-muted-foreground">
                                {ing.cantidadPorCoctel} {ing.unidadCoctel || insumo?.unidad} por cóctel
                              </p>
                            </div>
                          </div>
                          {veCostos && insumo && (
                            <p className="text-sm text-muted-foreground">{formatCurrency(costo)}/pers</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {detalleCoctel.preparacion && (
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Preparación</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detalleCoctel.preparacion}</p>
                </div>
              )}

              {puedeEditar && (
                <DialogFooter className="border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Se cierra el detalle y se abre el Dialog de edición que
                      // ya existe (mismo formulario que "Nuevo Coctel").
                      setDetalleCoctelId(null)
                      handleEditCoctel()
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  {/* Si se confirma, el cóctel deja de existir en state.cocteles
                      y este Dialog se cierra solo (detalleCoctel pasa a null). */}
                  <Button variant="destructive" onClick={handleDeleteCoctel}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          )}
        </Dialog>
      </main>
    </div>
  )
}
