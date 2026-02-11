"use client"

import { useState, Suspense } from "react"

import { useStore } from "@/lib/store-context"
import { type Insumo, type Unidad, formatCurrency } from "@/lib/store"
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

const unidades: Unidad[] = ["CC", "KG", "UN", "LT", "GR"]

function AlmacenContent() {
  const { state, addInsumo, updateInsumo, deleteInsumo } = useStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    codigo: "",
    descripcion: "",
    unidad: "KG" as Unidad,
    stockActual: 0,
    precioUnitario: 0,
    proveedor: "",
  })

  const filteredInsumos = state.insumos.filter(
    (insumo) =>
      insumo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insumo.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (insumo.proveedor || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const totalItems = state.insumos.length

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

  const handleSubmit = () => {
    if (editingInsumo) {
      updateInsumo(editingInsumo.id, formData)
    } else {
      addInsumo(formData)
    }
    resetForm()
    setIsAddDialogOpen(false)
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

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este insumo?")) {
      deleteInsumo(id)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Almacen de Insumos</h1>
        <p className="mt-1 text-base text-muted-foreground">Gestiona tu inventario de insumos, precios y stock</p>
      </div>

      {/* Search and Add */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Inventario de Insumos</CardTitle>
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
                    <DialogTitle>{editingInsumo ? "Editar Insumo" : "Nuevo Insumo"}</DialogTitle>
                    <DialogDescription>
                      {editingInsumo ? "Modifica los datos del insumo" : "Agrega un nuevo insumo al almacén"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="codigo" className="text-right">
                        Código
                      </Label>
                      <Input
                        id="codigo"
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                        className="col-span-3"
                        placeholder="Ej: A1"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="descripcion" className="text-right">
                        Descripción
                      </Label>
                      <Input
                        id="descripcion"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        className="col-span-3"
                        placeholder="Ej: Aceite Girasol"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="unidad" className="text-right">
                        Unidad
                      </Label>
                      <Select
                        value={formData.unidad}
                        onValueChange={(value) => setFormData({ ...formData, unidad: value as Unidad })}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unidades.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="stock" className="text-right">
                        Stock
                      </Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stockActual}
                        onChange={(e) =>
                          setFormData({ ...formData, stockActual: Number.parseFloat(e.target.value) || 0 })
                        }
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="precio" className="text-right">
                        Precio $
                      </Label>
                      <Input
                        id="precio"
                        type="number"
                        step="0.01"
                        value={formData.precioUnitario}
                        onChange={(e) =>
                          setFormData({ ...formData, precioUnitario: Number.parseFloat(e.target.value) || 0 })
                        }
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="proveedor" className="text-right">
                        Proveedor
                      </Label>
                      <Input
                        id="proveedor"
                        value={formData.proveedor}
                        onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                        className="col-span-3"
                        placeholder="Ej: Distribuidora Norte"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit}>{editingInsumo ? "Guardar" : "Agregar"}</Button>
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

export default function AlmacenPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <AlmacenContent />
      </Suspense>
    </div>
  )
}
