"use client"

import { useState, Suspense } from "react"

import { useStore } from "@/lib/store-context"
import { type InsumoBarra, type Unidad, type CategoriaInsumoBarra, formatCurrency } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Plus, Search, Pencil, Trash2 } from "lucide-react"

const unidades: Unidad[] = ["CC", "KG", "UN", "LT", "GR", "GRS", "L"]
const categorias: CategoriaInsumoBarra[] = ["Alcoholes", "Licores", "Mixers", "Jugos", "Garnish", "Otros"]

function BarraAlmacenContent() {
  const { insumosBarra, loading: isLoading, addInsumoBarra, updateInsumoBarra, deleteInsumoBarra } = useStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaInsumoBarra | "Todos">("Todos")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingInsumo, setEditingInsumo] = useState<InsumoBarra | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    codigo: "",
    descripcion: "",
    unidad: "CC" as Unidad,
    stockActual: 0,
    precioUnitario: 0,
    categoria: "Alcoholes" as CategoriaInsumoBarra,
    proveedor: "",
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
    })
    setEditingInsumo(null)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      if (editingInsumo) {
        await updateInsumoBarra(editingInsumo.id, formData)
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
    })
    setEditingInsumo(insumo)
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
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Cargando insumos de barra...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Almacen de Insumos de Barra</h1>
        <p className="mt-1 text-base text-muted-foreground">Gestiona insumos de cocteleria y bebidas</p>
      </div>

      {/* Category Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Inventario de Barra</CardTitle>
              <CardDescription>{filteredInsumos.length} insumos encontrados</CardDescription>
            </div>
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
                    <DialogTitle>{editingInsumo ? "Editar Insumo de Barra" : "Nuevo Insumo de Barra"}</DialogTitle>
                    <DialogDescription>
                      {editingInsumo ? "Modifica los datos del insumo" : "Agrega un nuevo insumo al almacen de barra"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="codigo" className="text-right">Codigo</Label>
                      <Input
                        id="codigo"
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                        className="col-span-3"
                        placeholder="Ej: BAR001"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="descripcion" className="text-right">Descripcion</Label>
                      <Input
                        id="descripcion"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        className="col-span-3"
                        placeholder="Ej: Vodka Absolut"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="categoria" className="text-right">Categoria</Label>
                      <Select
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
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="precio" className="text-right">Precio $</Label>
                      <Input
                        id="precio"
                        type="number"
                        step="0.01"
                        value={formData.precioUnitario}
                        onChange={(e) => setFormData({ ...formData, precioUnitario: Number.parseFloat(e.target.value) || 0 })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="proveedor" className="text-right">Proveedor</Label>
                      <Input
                        id="proveedor"
                        value={formData.proveedor}
                        onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                        className="col-span-3"
                        placeholder="Opcional"
                      />
                    </div>
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
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Codigo</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead className="w-[100px]">Categoria</TableHead>
                  <TableHead className="w-[80px]">Unidad</TableHead>
                  <TableHead className="w-[100px] text-right">Stock</TableHead>
                  <TableHead className="w-[120px] text-right">Precio Unit.</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInsumos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No se encontraron insumos de barra
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInsumos.map((insumo) => (
                    <TableRow key={insumo.id}>
                      <TableCell className="font-mono text-sm">{insumo.codigo}</TableCell>
                      <TableCell className="font-medium">{insumo.descripcion}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{insumo.categoria}</TableCell>
                      <TableCell>{insumo.unidad}</TableCell>
                      <TableCell className="text-right">{insumo.stockActual.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(insumo.precioUnitario)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(insumo)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(insumo.id)}>
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
        </CardContent>
      </Card>
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
