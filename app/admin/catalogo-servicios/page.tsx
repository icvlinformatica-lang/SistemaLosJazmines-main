"use client"

import { useState } from "react"
import { useStore } from "@/lib/store-context"
import { generateId, type Servicio, type CategoriaServicio } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Camera,
  Palette,
  Music,
  Cake,
  Car,
  FileText,
  Building,
  Package,
  Users,
} from "lucide-react"

const CATEGORIAS: CategoriaServicio[] = [
  "Salon y Espacio",
  "Fotografia y Video",
  "Decoracion",
  "Entretenimiento",
  "Pasteleria",
  "Transporte",
  "Papeleria",
  "Otros",
]

const CATEGORIA_ICONS: Record<CategoriaServicio, React.ReactNode> = {
  "Salon y Espacio": <Building className="h-4 w-4" />,
  "Fotografia y Video": <Camera className="h-4 w-4" />,
  "Decoracion": <Palette className="h-4 w-4" />,
  "Entretenimiento": <Music className="h-4 w-4" />,
  "Pasteleria": <Cake className="h-4 w-4" />,
  "Transporte": <Car className="h-4 w-4" />,
  "Papeleria": <FileText className="h-4 w-4" />,
  "Otros": <Package className="h-4 w-4" />,
}

const CATEGORIA_COLORS: Record<CategoriaServicio, string> = {
  "Salon y Espacio": "bg-blue-100 text-blue-700 border-blue-200",
  "Fotografia y Video": "bg-purple-100 text-purple-700 border-purple-200",
  "Decoracion": "bg-pink-100 text-pink-700 border-pink-200",
  "Entretenimiento": "bg-amber-100 text-amber-700 border-amber-200",
  "Pasteleria": "bg-rose-100 text-rose-700 border-rose-200",
  "Transporte": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Papeleria": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Otros": "bg-gray-100 text-gray-700 border-gray-200",
}

export default function CatalogoServiciosPage() {
  const { servicios, addServicio, updateServicio, deleteServicio, personal, eventos } = useStore()
  const { toast } = useToast()

  const [busqueda, setBusqueda] = useState("")
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaServicio | "todas">("todas")
  const [dialogAbierto, setDialogAbierto] = useState(false)
  const [servicioEditando, setServicioEditando] = useState<Partial<Servicio> | null>(null)

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    categoria: "Otros" as CategoriaServicio,
  })

  // Filtrar servicios
  const serviciosFiltrados = servicios.filter((s) => {
    if (!s.activo) return false
    if (categoriaFiltro !== "todas" && s.categoria !== categoriaFiltro) return false
    if (busqueda) {
      const searchLower = busqueda.toLowerCase()
      return (
        s.nombre.toLowerCase().includes(searchLower) ||
        s.descripcion?.toLowerCase().includes(searchLower) ||
        s.categoria.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  // Contar personal por servicio
  const contarPersonalPorServicio = (servicioId: string) => {
    return personal.filter(
      (p) => p.activo && p.servicioVinculadoId === servicioId
    ).length
  }

  const handleNuevoServicio = () => {
    setServicioEditando(null)
    setFormData({
      nombre: "",
      descripcion: "",
      categoria: "Otros",
    })
    setDialogAbierto(true)
  }

  const handleEditarServicio = (servicio: Servicio) => {
    setServicioEditando(servicio)
    setFormData({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion || "",
      categoria: servicio.categoria,
    })
    setDialogAbierto(true)
  }

  const handleGuardar = () => {
    if (!formData.nombre.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" })
      return
    }

    if (servicioEditando?.id) {
      // Editar existente
      updateServicio(servicioEditando.id, {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        categoria: formData.categoria,
      })
      toast({ title: "Servicio actualizado" })
    } else {
      // Crear nuevo
      const nuevoServicio: Servicio = {
        id: generateId(),
        codigo: `SRV-${Date.now().toString(36).toUpperCase()}`,
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        categoria: formData.categoria,
        margenGanancia: 0,
        unidad: "Fijo",
        activo: true,
      }
      addServicio(nuevoServicio)
      toast({ title: "Servicio creado" })
    }

    setDialogAbierto(false)
  }

  const handleEliminar = (servicio: Servicio) => {
    const personalVinculado = contarPersonalPorServicio(servicio.id)
    if (personalVinculado > 0) {
      toast({
        title: "No se puede eliminar",
        description: `Hay ${personalVinculado} persona(s) vinculada(s) a este servicio`,
        variant: "destructive",
      })
      return
    }
    const afectados = (eventos || []).filter((ev) =>
      (ev.servicios || []).some((s) => s.servicioId === servicio.id),
    )
    const aviso =
      afectados.length > 0
        ? `\n\nATENCION: esta contratado en ${afectados.length} ${afectados.length === 1 ? "evento" : "eventos"}. Los montos de seña y saldo pendientes quedaran congelados con los precios actuales.`
        : ""
    if (!confirm(`¿Eliminar el servicio "${servicio.nombre}"? Esta acción no se puede deshacer.${aviso}`)) return
    deleteServicio(servicio.id)
    toast({ title: "Servicio eliminado" })
  }

  // Agrupar por categoría
  const serviciosPorCategoria = CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = serviciosFiltrados.filter((s) => s.categoria === cat)
    return acc
  }, {} as Record<CategoriaServicio, Servicio[]>)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catalogo de Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Define los servicios que ofreces. El precio se determina por el personal asignado.
          </p>
        </div>
        <Button onClick={handleNuevoServicio} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar servicio..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoriaFiltro}
          onValueChange={(v) => setCategoriaFiltro(v as CategoriaServicio | "todas")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas las categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorias</SelectItem>
            {CATEGORIAS.map((cat) => (
              <SelectItem key={cat} value={cat}>
                <span className="flex items-center gap-2">
                  {CATEGORIA_ICONS[cat]}
                  {cat}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Servicios por categoría */}
      {categoriaFiltro === "todas" ? (
        <div className="space-y-6">
          {CATEGORIAS.map((categoria) => {
            const serviciosCat = serviciosPorCategoria[categoria]
            if (serviciosCat.length === 0) return null

            return (
              <div key={categoria}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className={CATEGORIA_COLORS[categoria]}>
                    {CATEGORIA_ICONS[categoria]}
                    <span className="ml-1">{categoria}</span>
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({serviciosCat.length})
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {serviciosCat.map((servicio) => (
                    <ServicioCard
                      key={servicio.id}
                      servicio={servicio}
                      personalCount={contarPersonalPorServicio(servicio.id)}
                      onEditar={() => handleEditarServicio(servicio)}
                      onEliminar={() => handleEliminar(servicio)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {serviciosFiltrados.map((servicio) => (
            <ServicioCard
              key={servicio.id}
              servicio={servicio}
              personalCount={contarPersonalPorServicio(servicio.id)}
              onEditar={() => handleEditarServicio(servicio)}
              onEliminar={() => handleEliminar(servicio)}
            />
          ))}
        </div>
      )}

      {serviciosFiltrados.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {busqueda || categoriaFiltro !== "todas"
                ? "No se encontraron servicios con esos filtros"
                : "No hay servicios en el catalogo"}
            </p>
            <Button onClick={handleNuevoServicio}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Servicio
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {servicioEditando ? "Editar Servicio" : "Nuevo Servicio"}
            </DialogTitle>
            <DialogDescription>
              El precio se define por las tarifas del personal asignado a cada evento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre del Servicio *</Label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Fotografia, DJ, Decoracion..."
              />
            </div>

            <div>
              <Label>Categoria *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(v) => setFormData({ ...formData, categoria: v as CategoriaServicio })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        {CATEGORIA_ICONS[cat]}
                        {cat}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Descripcion</Label>
              <Textarea
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripcion opcional del servicio..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar}>
              {servicioEditando ? "Guardar Cambios" : "Crear Servicio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Componente Card de Servicio
function ServicioCard({
  servicio,
  personalCount,
  onEditar,
  onEliminar,
}: {
  servicio: Servicio
  personalCount: number
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-2 rounded-lg ${CATEGORIA_COLORS[servicio.categoria].split(" ")[0]}`}>
              {CATEGORIA_ICONS[servicio.categoria]}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{servicio.nombre}</CardTitle>
              <p className="text-xs text-muted-foreground">{servicio.categoria}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditar}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEliminar} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {servicio.descripcion && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {servicio.descripcion}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={personalCount > 0 ? "text-foreground" : "text-muted-foreground"}>
            {personalCount} {personalCount === 1 ? "persona" : "personas"} vinculadas
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
