"use client"

import { useState } from "react"
import Link from "next/link"
import { useStore } from "@/lib/store-context"
import {
  type Coctel,
  type InsumoCoctel,
  type UnidadReceta,
  type CategoriaCoctel,
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
import { Plus, Trash2, Wine, Pencil, Beer } from "lucide-react"
import { cn } from "@/lib/utils"

export default function CoctelesPage() {
  const { state, addCoctel, updateCoctel, deleteCoctel } = useStore()
  const [selectedCoctel, setSelectedCoctel] = useState<Coctel | null>(state.cocteles[0] || null)
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
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carta de Cocteles</h1>
            <p className="mt-1 text-base text-muted-foreground">Crea y gestiona tus recetas de cocteles</p>
          </div>
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
                        {state.insumosBarra.map((i) => (
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
      </main>
    </div>
  )
}
