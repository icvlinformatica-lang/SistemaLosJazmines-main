"use client"

import { useState } from "react"
import { useStore } from "@/lib/store-context"
import {
  type CostoOperativo,
  type TipoCostoOperativo,
  formatCurrency,
  SALONES,
} from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Zap,
  Building2,
  Wrench,
  Users,
  Receipt,
  Shield,
  HelpCircle,
  CalendarClock,
} from "lucide-react"

const tipoCostoIcons: Record<TipoCostoOperativo, React.ElementType> = {
  "Servicios Basicos": Zap,
  "Alquiler": Building2,
  "Mantenimiento": Wrench,
  "Personal Fijo": Users,
  "Impuestos y Tasas": Receipt,
  "Seguros": Shield,
  "Otros": HelpCircle,
}

const tiposCosto: TipoCostoOperativo[] = [
  "Servicios Basicos",
  "Alquiler",
  "Mantenimiento",
  "Personal Fijo",
  "Impuestos y Tasas",
  "Seguros",
  "Otros",
]

export default function GastosFijosPage() {
  const { costosOperativos, addCostoOperativo, updateCostoOperativo, deleteCostoOperativo } = useStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipo, setFilterTipo] = useState<string>("all")
  const [filterSalon, setFilterSalon] = useState<string>("all")
  const [selectedTab, setSelectedTab] = useState<string>("Salón")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCosto, setEditingCosto] = useState<CostoOperativo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CostoOperativo | null>(null)

  const emptyForm = {
    concepto: "",
    tipo: "Otros" as TipoCostoOperativo,
    monto: 0,
    frecuencia: "Por Evento" as CostoOperativo["frecuencia"],
    esPorPersona: false,
    montoPorPersona: 0,
    salon: "",
    activo: true,
    notas: "",
    fechaVencimiento: "",
  }
  const [form, setForm] = useState(emptyForm)

  const filtered = (costosOperativos || []).filter((c) => {
    const matchesSearch = c.concepto.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTipo = filterTipo === "all" || c.tipo === filterTipo
    const matchesTab = c.salon === selectedTab || (!c.salon && selectedTab === "Todos")
    return matchesSearch && matchesTipo && matchesTab
  })

  const resetForm = () => {
    setForm(emptyForm)
    setEditingCosto(null)
  }

  const handleOpenAdd = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (costo: CostoOperativo) => {
    setForm({
      concepto: costo.concepto,
      tipo: costo.tipo,
      monto: costo.monto,
      frecuencia: costo.frecuencia,
      esPorPersona: costo.esPorPersona,
      montoPorPersona: costo.montoPorPersona || 0,
      salon: costo.salon || "",
      activo: costo.activo,
      notas: costo.notas || "",
      fechaVencimiento: costo.fechaVencimiento || "",
    })
    setEditingCosto(costo)
    setIsDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.concepto) return
    if (editingCosto) {
      updateCostoOperativo(editingCosto.id, form)
    } else {
      addCostoOperativo(form)
    }
    resetForm()
    setIsDialogOpen(false)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteCostoOperativo(deleteTarget.id)
    setDeleteTarget(null)
  }

  const totalMensual = (costosOperativos || []).filter((c) => c.activo).reduce((sum, c) => {
    if (c.frecuencia === "Mensual") return sum + c.monto
    if (c.frecuencia === "Anual") return sum + c.monto / 12
    if (c.frecuencia === "Por Evento") return sum + c.monto * 4
    return sum
  }, 0)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gastos Fijos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Costos operativos fijos del salón para calcular la rentabilidad
          </p>
        </div>
        <Button onClick={handleOpenAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Tabs para cada salón */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="Salón">Salón</TabsTrigger>
          <TabsTrigger value="Quinta">Quinta</TabsTrigger>
          <TabsTrigger value="Casona">Casona</TabsTrigger>
          <TabsTrigger value="Todos">Todos</TabsTrigger>
        </TabsList>

        {/* Estadísticas compactas */}
        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-bold">{filtered.length}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <span className="text-muted-foreground">Activos:</span>
            <span className="font-bold text-emerald-600">{filtered.filter((c) => c.activo).length}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800">
            <span>Total por evento:</span>
            <span className="font-bold">
              {formatCurrency(
                filtered
                  .filter((c) => c.activo && c.frecuencia === "Por Evento")
                  .reduce((s, c) => s + c.monto, 0)
              )}
            </span>
          </div>
        </div>

        {/* Controles de búsqueda y filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por concepto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo de costo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {tiposCosto.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contenido de cada tab */}
        {["Salón", "Quinta", "Casona", "Todos"].map((salon) => (
          <TabsContent key={salon} value={salon} className="mt-0">
            {filtered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium mb-2">No hay gastos registrados</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {salon === "Todos" ? "Comienza agregando un gasto fijo" : `No hay gastos para ${salon}`}
                  </p>
                  <Button size="sm" onClick={handleOpenAdd}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Gasto
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((costo) => {
                  const Icon = tipoCostoIcons[costo.tipo]
                  return (
                    <Card key={costo.id} className={!costo.activo ? "opacity-50" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Icono y tipo */}
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>

                          {/* Información principal */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold truncate">{costo.concepto}</h3>
                              {!costo.activo && (
                                <Badge variant="secondary" className="text-xs">Inactivo</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs">{costo.tipo}</Badge>
                              </span>
                              <span>•</span>
                              <span>{costo.frecuencia}</span>
                              {costo.esPorPersona && (
                                <>
                                  <span>•</span>
                                  <span>{formatCurrency(costo.montoPorPersona || 0)}/persona</span>
                                </>
                              )}
                              {costo.fechaVencimiento && (
                                <>
                                  <span>•</span>
                                  <span className={`flex items-center gap-1 ${
                                    (() => {
                                      const today = new Date()
                                      today.setHours(0, 0, 0, 0)
                                      const venc = new Date(costo.fechaVencimiento + "T00:00:00")
                                      const diffDays = Math.ceil((venc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                      if (diffDays < 0) return "text-destructive font-medium"
                                      if (diffDays <= 3) return "text-amber-600 font-medium"
                                      return ""
                                    })()
                                  }`}>
                                    <CalendarClock className="h-3 w-3" />
                                    Vence: {new Date(costo.fechaVencimiento + "T00:00:00").toLocaleDateString("es-AR")}
                                  </span>
                                </>
                              )}
                            </div>
                            {costo.notas && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{costo.notas}</p>
                            )}
                          </div>

                          {/* Monto y acciones */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">
                                {formatCurrency(costo.monto)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {costo.salon || "Todos"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(costo)}
                                className="h-8 w-8 p-0"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(costo)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCosto ? "Editar Costo Operativo" : "Nuevo Costo Operativo"}</DialogTitle>
            <DialogDescription>
              {editingCosto ? "Modifica los datos del costo" : "Agrega un costo fijo del salon"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="co-concepto">Concepto</Label>
              <Input
                id="co-concepto"
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                placeholder="Ej: Consumo Electrico Mensual"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="co-tipo">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoCostoOperativo })}>
                  <SelectTrigger id="co-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposCosto.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="co-freq">Frecuencia</Label>
                <Select
                  value={form.frecuencia}
                  onValueChange={(v) => setForm({ ...form, frecuencia: v as CostoOperativo["frecuencia"] })}
                >
                  <SelectTrigger id="co-freq">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Por Evento">Por Evento</SelectItem>
                    <SelectItem value="Mensual">Mensual</SelectItem>
                    <SelectItem value="Anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="co-monto">Monto ($)</Label>
                <Input
                  id="co-monto"
                  type="number"
                  min={0}
                  value={form.monto || ""}
                  onChange={(e) => setForm({ ...form, monto: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="co-salon">Salon</Label>
                <Select
                  value={form.salon || "todos"}
                  onValueChange={(v) => setForm({ ...form, salon: v === "todos" ? "" : v })}
                >
                  <SelectTrigger id="co-salon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los salones</SelectItem>
                    {SALONES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="co-porpersona"
                checked={form.esPorPersona}
                onCheckedChange={(checked) => setForm({ ...form, esPorPersona: checked === true })}
              />
              <Label htmlFor="co-porpersona">El costo escala por persona</Label>
            </div>
            {form.esPorPersona && (
              <div className="grid gap-2">
                <Label htmlFor="co-mpp">Monto por persona ($)</Label>
                <Input
                  id="co-mpp"
                  type="number"
                  min={0}
                  value={form.montoPorPersona || ""}
                  onChange={(e) => setForm({ ...form, montoPorPersona: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="co-vencimiento">Fecha de Vencimiento</Label>
              <Input
                id="co-vencimiento"
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Fecha limite de pago de este gasto</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="co-notas">Notas</Label>
              <Textarea
                id="co-notas"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="co-activo"
                checked={form.activo}
                onCheckedChange={(checked) => setForm({ ...form, activo: checked === true })}
              />
              <Label htmlFor="co-activo">Costo activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!form.concepto}>
              {editingCosto ? "Guardar" : "Crear Costo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Costo Operativo</AlertDialogTitle>
            <AlertDialogDescription>
              Estas seguro de eliminar &ldquo;{deleteTarget?.concepto}&rdquo;? Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
