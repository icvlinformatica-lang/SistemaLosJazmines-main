"use client"

// Pantalla de cotización para el perfil Vendedor (Etapa 3). Arma una fila en
// la tabla "cotizaciones" (estado "borrador" / "lista_para_revisar"),
// NUNCA en "eventos". El precio final se calcula siempre del lado del
// servidor (/api/vendedor/cotizaciones) a partir del catálogo real de
// servicios — acá solo se muestra un preview con la misma fórmula, nunca el
// desglose de costos internos (eso vive en costos_internos, que este
// endpoint ni siquiera devuelve).

import { Fragment, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { SALONES, salonLabel } from "@/lib/store"

const TIPOS_EVENTO = ["Casamiento", "Cumpleaños de 15", "Empresarial", "Cumpleaños", "Bautismo", "Otro"] as const

type Segmento = "adultos" | "adolescentes" | "ninos" | "dietasEspeciales"
const SEGMENTOS: { key: Segmento; label: string }[] = [
  { key: "adultos", label: "Adultos" },
  { key: "adolescentes", label: "Adolescentes" },
  { key: "ninos", label: "Niños" },
  { key: "dietasEspeciales", label: "Dietas especiales" },
]

interface ServicioCatalogo {
  id: string
  nombre: string
  categoria: string
  unidad: "Fijo" | "Por Persona" | "Por Hora" | "Por Cantidad"
  precioVenta: number
}

interface RecetaCatalogo {
  id: string
  nombre: string
  categoria: string
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

export default function CotizarPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([])
  const [recetas, setRecetas] = useState<RecetaCatalogo[]>([])
  const [preciosVenta, setPreciosVenta] = useState<Record<string, Record<string, number>>>({})

  // Cliente
  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteTelefono, setClienteTelefono] = useState("")

  // Evento
  const [fechaEvento, setFechaEvento] = useState("")
  const [salon, setSalon] = useState<string>("")
  const [tipoEvento, setTipoEvento] = useState<string>("")

  // Invitados
  const [invitados, setInvitados] = useState({ adultos: 0, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0 })

  // Menú por segmento: recetaId[] por segmento
  const [recetasElegidas, setRecetasElegidas] = useState<Record<Segmento, string[]>>({
    adultos: [],
    adolescentes: [],
    ninos: [],
    dietasEspeciales: [],
  })

  // Servicios elegidos: servicioId -> cantidad (solo importa para "Por Hora"/"Por Cantidad")
  const [serviciosElegidos, setServiciosElegidos] = useState<Record<string, number>>({})

  const [cotizacionId, setCotizacionId] = useState<string | null>(null)
  const [estado, setEstado] = useState<"borrador" | "lista_para_revisar">("borrador")
  const [guardando, setGuardando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch("/api/vendedor/catalogo")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok) {
          setServicios(data.servicios || [])
          setRecetas(data.recetas || [])
          setPreciosVenta(data.preciosVenta || {})
        }
      })
      .catch(() => {})
      .finally(() => setCargandoCatalogo(false))
  }, [])

  const toggleReceta = (segmento: Segmento, recetaId: string) => {
    setRecetasElegidas((prev) => {
      const actual = prev[segmento]
      const yaEsta = actual.includes(recetaId)
      return { ...prev, [segmento]: yaEsta ? actual.filter((id) => id !== recetaId) : [...actual, recetaId] }
    })
  }

  const toggleServicio = (servicioId: string) => {
    setServiciosElegidos((prev) => {
      if (servicioId in prev) {
        const { [servicioId]: _quitado, ...resto } = prev
        return resto
      }
      return { ...prev, [servicioId]: 1 }
    })
  }

  const cambiarCantidadServicio = (servicioId: string, cantidad: number) => {
    setServiciosElegidos((prev) => ({ ...prev, [servicioId]: Math.max(1, cantidad || 1) }))
  }

  // Preview de precio: misma fórmula que usa el planificador real
  // (app/evento/page.tsx) y que vuelve a calcular el servidor al guardar.
  const { serviciosConPrecio, totalServicios, precioBaseSalon, precioVentaSugerido } = useMemo(() => {
    const conPrecio = servicios
      .filter((s) => s.id in serviciosElegidos)
      .map((s) => {
        const usaCantidad = s.unidad === "Por Hora" || s.unidad === "Por Cantidad"
        const cantidad = usaCantidad ? Math.max(1, serviciosElegidos[s.id] || 1) : 1
        return { ...s, cantidad, usaCantidad, precioTotal: s.precioVenta * cantidad }
      })
    const total = conPrecio.reduce((sum, s) => sum + s.precioTotal, 0)
    const base = salon && fechaEvento ? preciosVenta[salon]?.[fechaEvento] ?? 0 : 0
    return { serviciosConPrecio: conPrecio, totalServicios: total, precioBaseSalon: base, precioVentaSugerido: base + total }
  }, [servicios, serviciosElegidos, salon, fechaEvento, preciosVenta])

  const puedeGuardar = clienteNombre.trim().length > 0 && estado === "borrador"

  const guardar = async (accion: "guardar" | "enviar") => {
    if (!clienteNombre.trim()) {
      toast({ title: "Falta el nombre del cliente", variant: "destructive" })
      return
    }
    accion === "enviar" ? setEnviando(true) : setGuardando(true)
    try {
      const res = await fetch("/api/vendedor/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cotizacionId,
          clienteNombre,
          clienteTelefono,
          fechaEvento,
          salon,
          tipoEvento,
          invitados,
          recetasElegidas,
          serviciosElegidos: Object.entries(serviciosElegidos).map(([servicioId, cantidad]) => ({ servicioId, cantidad })),
          accion,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast({ title: data.error || "No se pudo guardar", variant: "destructive" })
        return
      }
      setCotizacionId(data.id)
      setEstado(data.estado)
      if (accion === "enviar") {
        toast({ title: "Cotización enviada a revisión" })
      } else {
        toast({ title: "Borrador guardado" })
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" })
    } finally {
      setGuardando(false)
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1a3a2a]">Nueva cotización</h1>
        <Button variant="ghost" size="sm" onClick={() => router.push("/vendedor")}>
          Volver
        </Button>
      </div>

      {estado === "lista_para_revisar" && (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardContent className="py-3 text-sm text-emerald-800">
            Esta cotización ya se envió a revisión. Administración te va a avisar si necesita algún ajuste.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              disabled={estado !== "borrador"}
              placeholder="Nombre y apellido"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono</Label>
            <Input
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
              disabled={estado !== "borrador"}
              placeholder="Opcional"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={fechaEvento}
              onChange={(e) => setFechaEvento(e.target.value)}
              disabled={estado !== "borrador"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Salón</Label>
            <Select value={salon} onValueChange={setSalon} disabled={estado !== "borrador"}>
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
          <div className="space-y-1.5">
            <Label>Tipo de evento</Label>
            <Select value={tipoEvento} onValueChange={setTipoEvento} disabled={estado !== "borrador"}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_EVENTO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invitados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { key: "adultos", label: "Adultos" },
              { key: "adolescentes", label: "Adolescentes" },
              { key: "ninos", label: "Niños" },
              { key: "personasDietasEspeciales", label: "Dietas especiales" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                type="number"
                min={0}
                value={invitados[key]}
                onChange={(e) => setInvitados((prev) => ({ ...prev, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                disabled={estado !== "borrador"}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Menú</CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoCatalogo ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : recetas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay recetas cargadas en el catálogo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left font-semibold text-muted-foreground">Receta</th>
                    {SEGMENTOS.map((s) => (
                      <th key={s.key} className="py-2 px-2 text-center font-semibold text-muted-foreground">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agruparPorCategoria(recetas).map((grupo) => (
                    <Fragment key={grupo.categoria}>
                      <tr>
                        <td colSpan={SEGMENTOS.length + 1} className="py-1.5 px-1 text-xs font-bold uppercase tracking-wide text-[#2d5a3d]">
                          {grupo.categoria}
                        </td>
                      </tr>
                      {grupo.items.map((receta) => (
                        <tr key={receta.id} className="border-b border-border/40">
                          <td className="py-1.5 pr-3">{receta.nombre}</td>
                          {SEGMENTOS.map((s) => (
                            <td key={s.key} className="py-1.5 px-2 text-center">
                              <Checkbox
                                checked={recetasElegidas[s.key].includes(receta.id)}
                                onCheckedChange={() => toggleReceta(s.key, receta.id)}
                                disabled={estado !== "borrador"}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoCatalogo ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : servicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay servicios activos en el catálogo.</p>
          ) : (
            <div className="space-y-1">
              {agruparPorCategoria(servicios).map((grupo) => (
                <div key={grupo.categoria}>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#2d5a3d]">{grupo.categoria}</p>
                  {grupo.items.map((s) => {
                    const seleccionado = s.id in serviciosElegidos
                    const usaCantidad = s.unidad === "Por Hora" || s.unidad === "Por Cantidad"
                    return (
                      <div key={s.id} className="flex items-center gap-3 border-b border-border/40 py-1.5">
                        <Checkbox
                          checked={seleccionado}
                          onCheckedChange={() => toggleServicio(s.id)}
                          disabled={estado !== "borrador"}
                        />
                        <span className="flex-1 text-sm">{s.nombre}</span>
                        {seleccionado && usaCantidad && (
                          <Input
                            type="number"
                            min={1}
                            value={serviciosElegidos[s.id]}
                            onChange={(e) => cambiarCantidadServicio(s.id, Number(e.target.value))}
                            disabled={estado !== "borrador"}
                            className="w-20"
                          />
                        )}
                        <span className="w-28 text-right text-sm tabular-nums text-emerald-700">
                          {fmt(s.precioVenta)}
                          {usaCantidad ? "/u" : ""}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#c9a227]">
        <CardContent className="flex flex-col gap-1 py-4">
          {precioBaseSalon > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Precio base del salón</span>
              <span className="tabular-nums">{fmt(precioBaseSalon)}</span>
            </div>
          )}
          {serviciosConPrecio.map((s) => (
            <div key={s.id} className="flex justify-between text-sm text-muted-foreground">
              <span>
                {s.nombre}
                {s.usaCantidad ? ` × ${s.cantidad}` : ""}
              </span>
              <span className="tabular-nums">{fmt(s.precioTotal)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold text-[#1a3a2a]">
            <span>Precio de venta sugerido</span>
            <span className="tabular-nums">{fmt(precioVentaSugerido)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 pb-8 sm:flex-row sm:justify-end">
        <Button variant="outline" disabled={!puedeGuardar || guardando || enviando} onClick={() => guardar("guardar")}>
          {guardando ? "Guardando..." : "Guardar borrador"}
        </Button>
        <Button
          className="bg-[#1a3a2a] hover:bg-[#25503c]"
          disabled={!puedeGuardar || guardando || enviando}
          onClick={() => guardar("enviar")}
        >
          {enviando ? "Enviando..." : "Enviar a revisión"}
        </Button>
      </div>
    </div>
  )
}
