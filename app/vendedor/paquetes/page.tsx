"use client"

// Pantalla de paquetes para el perfil Vendedor (Etapa 4). Lee y crea filas
// en "paquetes_salones" — la misma tabla que usa Administración en
// /admin/servicios — pero siempre a través de /api/vendedor/paquetes, que
// nunca expone precioInterno/costoTotal/ganancia/margen por servicio (eso
// sigue siendo exclusivo de Administración).

import { Fragment, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Briefcase, CheckCircle, Package, Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonColor, salonLabel } from "@/lib/store"

interface ServicioCatalogo {
  id: string
  nombre: string
  categoria: string
  unidad: string
  precioVenta: number
}

interface PaqueteVendedor {
  id: string
  salon: string
  nombre: string
  descripcion: string
  capacidadMinima: number
  capacidadMaxima: number
  precioVenta: number
  servicios: Array<{ servicioId: string; nombre: string; categoria: string; unidad: string; cantidad: number; precioVenta: number }>
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

function agruparPorCategoria<T extends { categoria: string }>(items: T[]): Array<{ categoria: string; items: T[] }> {
  const grupos = new Map<string, T[]>()
  for (const item of items) {
    if (!grupos.has(item.categoria)) grupos.set(item.categoria, [])
    grupos.get(item.categoria)!.push(item)
  }
  return Array.from(grupos.entries()).map(([categoria, items]) => ({ categoria, items }))
}

export default function PaquetesPage() {
  const { toast } = useToast()

  const [cargando, setCargando] = useState(true)
  const [paquetes, setPaquetes] = useState<PaqueteVendedor[]>([])
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([])
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Formulario del nuevo paquete
  const [nombre, setNombre] = useState("")
  const [salon, setSalon] = useState<string>("")
  const [descripcion, setDescripcion] = useState("")
  const [capacidadMinima, setCapacidadMinima] = useState(0)
  const [capacidadMaxima, setCapacidadMaxima] = useState(0)
  const [serviciosElegidos, setServiciosElegidos] = useState<string[]>([])

  const cargarDatos = () => {
    setCargando(true)
    Promise.all([
      fetch("/api/vendedor/paquetes").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/vendedor/catalogo").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([paquetesData, catalogoData]) => {
        if (paquetesData?.ok) setPaquetes(paquetesData.paquetes || [])
        if (catalogoData?.ok) setServicios(catalogoData.servicios || [])
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(cargarDatos, [])

  const paquetesPorSalon = useMemo(() => {
    const grupos = new Map<string, PaqueteVendedor[]>()
    for (const s of SALONES) grupos.set(s, [])
    for (const p of paquetes) {
      if (!grupos.has(p.salon)) grupos.set(p.salon, [])
      grupos.get(p.salon)!.push(p)
    }
    return Array.from(grupos.entries()).filter(([, items]) => items.length > 0)
  }, [paquetes])

  const resetFormulario = () => {
    setNombre("")
    setSalon("")
    setDescripcion("")
    setCapacidadMinima(0)
    setCapacidadMaxima(0)
    setServiciosElegidos([])
  }

  const toggleServicio = (servicioId: string) => {
    setServiciosElegidos((prev) => (prev.includes(servicioId) ? prev.filter((id) => id !== servicioId) : [...prev, servicioId]))
  }

  const crearPaquete = async () => {
    if (!nombre.trim() || !salon || serviciosElegidos.length === 0) {
      toast({ title: "Completá nombre, salón y al menos un servicio", variant: "destructive" })
      return
    }
    setGuardando(true)
    try {
      const res = await fetch("/api/vendedor/paquetes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          salon,
          descripcion,
          capacidadMinima,
          capacidadMaxima,
          servicios: serviciosElegidos.map((servicioId) => ({ servicioId, cantidad: 1 })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo crear el paquete", variant: "destructive" })
        return
      }
      toast({ title: "Paquete creado" })
      setDialogoAbierto(false)
      resetFormulario()
      cargarDatos()
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sticky top-0 z-40">
        <div className="mx-auto max-w-4xl flex items-center gap-3">
          <Link href="/vendedor" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">Paquetes</h1>
          </div>
          <Button size="sm" onClick={() => setDialogoAbierto(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo paquete
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : paquetesPorSalon.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
            <Package className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Todavía no hay paquetes creados</p>
            <Button onClick={() => setDialogoAbierto(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Crear el primero
            </Button>
          </div>
        ) : (
          paquetesPorSalon.map(([salonNombre, items]) => (
            <div key={salonNombre} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: salonColor(salonNombre) }}>
                {salonLabel(salonNombre)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border-l-4 border border-border bg-card overflow-hidden"
                    style={{ borderLeftColor: salonColor(p.salon) }}
                  >
                    <div className="px-4 py-3">
                      <p className="font-semibold text-card-foreground">{p.nombre}</p>
                      {p.descripcion && <p className="text-sm text-muted-foreground mt-0.5">{p.descripcion}</p>}
                      {(p.capacidadMinima > 0 || p.capacidadMaxima > 0) && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {p.capacidadMinima} - {p.capacidadMaxima} personas
                        </div>
                      )}
                    </div>
                    <div className="border-t border-border px-4 py-3 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Incluye</p>
                      {p.servicios.map((s) => (
                        <div key={s.servicioId} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {s.nombre}
                            {s.cantidad > 1 ? ` ×${s.cantidad}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground">Precio de venta</span>
                      <span className="text-lg font-bold text-emerald-700">{fmt(p.precioVenta)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      <Dialog
        open={dialogoAbierto}
        onOpenChange={(open) => {
          setDialogoAbierto(open)
          if (!open) resetFormulario()
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo paquete</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Paquete Casamiento Clásico" />
            </div>

            <div className="space-y-2">
              <Label>Salón *</Label>
              <Select value={salon} onValueChange={setSalon}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir salón" />
                </SelectTrigger>
                <SelectContent>
                  {SALONES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {salonLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Capacidad mínima</Label>
                <Input type="number" min={0} value={capacidadMinima} onChange={(e) => setCapacidadMinima(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Capacidad máxima</Label>
                <Input type="number" min={0} value={capacidadMaxima} onChange={(e) => setCapacidadMaxima(Number(e.target.value) || 0)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                Servicios incluidos *
              </Label>
              <div className="rounded-lg border border-border max-h-64 overflow-y-auto">
                {agruparPorCategoria(servicios).map((grupo) => (
                  <Fragment key={grupo.categoria}>
                    <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white" style={{ backgroundColor: "#2d5a3d" }}>
                      {grupo.categoria}
                    </p>
                    {grupo.items.map((s) => {
                      const seleccionado = serviciosElegidos.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleServicio(s.id)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm border-b border-border/40 last:border-b-0 transition-colors ${
                            seleccionado ? "bg-emerald-50" : "hover:bg-muted/40"
                          }`}
                        >
                          <div
                            className={`w-[18px] h-[18px] shrink-0 rounded border-2 flex items-center justify-center ${
                              seleccionado ? "bg-emerald-600 border-emerald-600" : "border-muted-foreground/30 bg-background"
                            }`}
                          >
                            {seleccionado && <CheckCircle className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                          </div>
                          <span className="flex-1">{s.nombre}</span>
                          <span className="text-emerald-700 font-medium">{fmt(s.precioVenta)}</span>
                        </button>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
              {serviciosElegidos.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {serviciosElegidos.length} servicio{serviciosElegidos.length > 1 ? "s" : ""} — precio de venta total:{" "}
                  <span className="font-semibold text-emerald-700">
                    {fmt(servicios.filter((s) => serviciosElegidos.includes(s.id)).reduce((sum, s) => sum + s.precioVenta, 0))}
                  </span>
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={crearPaquete} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear paquete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
