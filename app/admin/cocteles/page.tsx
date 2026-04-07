"use client"

import { useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  type Coctel,
  type InsumoCoctel,
  type BarraTemplate,
  type UnidadReceta,
  type CategoriaCoctel,
  generateId,
  getCompatibleRecipeUnits,
  getDefaultRecipeUnit,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Plus, Trash2, Wine, Pencil, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

export default function CoctelesPage() {
  const { state, addCoctel, updateCoctel, deleteCoctel, addBarraTemplate, updateBarraTemplate, deleteBarraTemplate } = useStore()
  const [selectedCoctel, setSelectedCoctel] = useState<Coctel | null>(state.cocteles[0] || null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  // Bar template state
  const [isBarraDialogOpen, setIsBarraDialogOpen] = useState(false)
  const [editingBarra, setEditingBarra] = useState<BarraTemplate | null>(null)
  const [barraFormData, setBarraFormData] = useState({
    nombre: "",
    coctelesIncluidos: [] as string[],
  })

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

  const filteredCocteles = state.cocteles.filter((c) => {
    if (filterCategoria === "all") return true
    return (c.categoria || "Con Alcohol") === filterCategoria
  })

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

  // === Barra Template Handlers ===
  const resetBarraForm = () => {
    setBarraFormData({ nombre: "", coctelesIncluidos: [] })
    setEditingBarra(null)
  }

  const handleOpenAddBarra = () => {
    resetBarraForm()
    setIsBarraDialogOpen(true)
  }

  const handleEditBarra = (template: BarraTemplate) => {
    setBarraFormData({
      nombre: template.nombre,
      coctelesIncluidos: [...template.coctelesIncluidos],
    })
    setEditingBarra(template)
    setIsBarraDialogOpen(true)
  }

  const handleDeleteBarra = (id: string) => {
    if (confirm("Eliminar esta barra?")) {
      deleteBarraTemplate(id)
    }
  }

  const handleSubmitBarra = async () => {
    if (!barraFormData.nombre) return
    if (editingBarra) {
      await updateBarraTemplate(editingBarra.id, barraFormData)
    } else {
      await addBarraTemplate(barraFormData)
    }
    resetBarraForm()
    setIsBarraDialogOpen(false)
  }

  const toggleCoctelInBarraForm = (coctelId: string) => {
    const current = barraFormData.coctelesIncluidos
    if (current.includes(coctelId)) {
      setBarraFormData({ ...barraFormData, coctelesIncluidos: current.filter((id) => id !== coctelId) })
    } else {
      setBarraFormData({ ...barraFormData, coctelesIncluidos: [...current, coctelId] })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carta de Cocteles</h1>
            <p className="mt-1 text-base text-muted-foreground">Crea y gestiona tus recetas de cocteles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="bg-transparent" onClick={handleOpenAddBarra}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Barra
            </Button>
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
                        <Label htmlFor="codigo">Codigo</Label>
                        <Input
                          id="codigo"
                          value={formData.codigo}
                          onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                          placeholder="Ej: COC001"
                        />
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
                              {state.insumosBarra.map((insumo) => (
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
        </div>

        {/* Category Filter */}
        <div className="mb-6 flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "Con Alcohol", "Sin Alcohol"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategoria(cat)}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors",
                  filterCategoria === cat
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground",
                )}
              >
                {cat === "all" ? "Todos" : cat}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {filteredCocteles.length} {filteredCocteles.length === 1 ? "coctel" : "cocteles"}
          </span>
        </div>

        {/* Two column: List + Detail */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Cocktail List */}
          <div className="md:col-span-1 space-y-2 overflow-y-auto max-h-[520px] pr-1">
            {filteredCocteles.map((coctel) => (
              <button
                key={coctel.id}
                type="button"
                onClick={() => setSelectedCoctel(coctel)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  selectedCoctel?.id === coctel.id
                    ? "border-foreground bg-muted"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium">{coctel.nombre}</p>
                  {(coctel.categoria || "Con Alcohol") === "Sin Alcohol" && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Sin Alcohol</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{coctel.insumos.length} insumos</p>
              </button>
            ))}
            {filteredCocteles.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No hay cocteles</p>
            )}
          </div>

          {/* Cocktail Detail */}
          <div className="md:col-span-2">
            {selectedCoctel ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Wine className="h-5 w-5" />
                        {selectedCoctel.nombre}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={(selectedCoctel.categoria || "Con Alcohol") === "Sin Alcohol" ? "secondary" : "outline"}>
                          {selectedCoctel.categoria || "Con Alcohol"}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">{selectedCoctel.descripcion}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="bg-transparent" onClick={handleEditCoctel}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="bg-transparent text-destructive" onClick={handleDeleteCoctel}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <h4 className="font-semibold mb-3">Insumos</h4>
                  {selectedCoctel.insumos.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Sin insumos cargados</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedCoctel.insumos.map((ing, idx) => {
                        const insumo = getInsumoBarraById(ing.insumoBarraId)
                        return (
                          <div key={idx} className="flex items-center justify-between rounded-md border p-3">
                            <span className="font-medium">{insumo?.descripcion || "Desconocido"}</span>
                            <span className="font-mono text-sm">
                              {ing.cantidadPorCoctel} {ing.unidadCoctel || insumo?.unidad}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {selectedCoctel.preparacion && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Preparacion</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedCoctel.preparacion}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Wine className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Selecciona un coctel para ver sus detalles</p>
              </div>
            )}
          </div>
        </div>

        {/* ==================== BARRAS SECTION ==================== */}
        <Separator className="my-10" />

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutGrid className="h-6 w-6" />
              Barras
            </h2>
            <p className="mt-1 text-base text-muted-foreground">
              Barras personalizadas con cocteles seleccionados
            </p>
          </div>
          <Button variant="outline" className="bg-transparent" onClick={handleOpenAddBarra}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva barra
          </Button>
        </div>

        {(state.barrasTemplates || []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <LayoutGrid className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No hay barras creadas</p>
            <Button variant="outline" className="mt-4 bg-transparent" onClick={handleOpenAddBarra}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primera barra
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(state.barrasTemplates || []).map((template) => {
              const coctelesNames = template.coctelesIncluidos
                .map((id) => state.cocteles.find((c) => c.id === id)?.nombre)
                .filter(Boolean)
              return (
                <Card key={template.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{template.nombre}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditBarra(template)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBarra(template.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{template.coctelesIncluidos.length} cocteles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {coctelesNames.map((name) => (
                        <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                      ))}
                      {coctelesNames.length === 0 && (
                        <span className="text-sm text-muted-foreground italic">Sin cocteles asignados</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Barra Template Dialog */}
        <Dialog
          open={isBarraDialogOpen}
          onOpenChange={(open) => {
            setIsBarraDialogOpen(open)
            if (!open) resetBarraForm()
          }}
        >
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingBarra ? "Editar Barra" : "Nueva Barra"}</DialogTitle>
              <DialogDescription>
                {editingBarra ? "Modifica los cocteles de esta barra" : "Crea una barra personalizada seleccionando los cocteles"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              <div>
                <Label htmlFor="barraName">Nombre de la barra</Label>
                <Input
                  id="barraName"
                  value={barraFormData.nombre}
                  onChange={(e) => setBarraFormData({ ...barraFormData, nombre: e.target.value })}
                  placeholder="Ej: Barra Tropical, Barra Whisky..."
                />
              </div>

              <div>
                <Label className="text-base">Cocteles ({barraFormData.coctelesIncluidos.length} seleccionados)</Label>
                <div className="grid grid-cols-1 gap-1 mt-2 max-h-72 overflow-y-auto border rounded-lg p-3">
                  {state.cocteles.map((coctel) => (
                    <label
                      key={coctel.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={barraFormData.coctelesIncluidos.includes(coctel.id)}
                        onCheckedChange={() => toggleCoctelInBarraForm(coctel.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{coctel.nombre}</p>
                        <p className="text-xs text-muted-foreground">{coctel.descripcion}</p>
                      </div>
                    </label>
                  ))}
                  {state.cocteles.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Primero crea algunos cocteles
                    </p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="bg-transparent" onClick={() => setIsBarraDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitBarra} disabled={!barraFormData.nombre || barraFormData.coctelesIncluidos.length === 0}>
                {editingBarra ? "Guardar" : "Crear Barra"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
