"use client"

// Detalle de una cotización del modelo NUEVO (costo + ganancia por salón,
// servicios_elegidos.version 2) en la bandeja de Administración
// (/eventos/cotizaciones). Acá SÍ se ven costo, ganancia y precio de cada
// rubro y los avisos (la bandeja es solo de Administración/Soporte y su API
// corta por perfil).
//
// También arma el PERSONAL del evento a partir de las reglas del salón: por
// cada línea ("4 Mozo") se preasignan personas activas de esa función con la
// tarifa usada en la cotización. Administración puede cambiar personas y
// montos antes de aprobar; si faltan personas de una función, lo avisa.

import { AlertTriangle, Calendar, IdCard, UserCheck, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChipDia, PuntoRubro } from "@/components/cotizador-colores"
import type { DiaCotizado } from "@/lib/cotizador-salon"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export interface DesgloseCotizacionV2 {
  version: 2
  salon: string
  adultos: number
  ninos: number
  comensales: number
  capacidadMaxima: number | null
  superaCapacidad: boolean
  modalidad: string
  rubros: Array<{ clave: string; nombre: string; costo: number | null; precio: number; ganancia: number | null }>
  recetas: Array<{ id: string; nombre: string; costoPorcion: number; precioPorcion: number }>
  barra: { id: string; nombre: string; cocteles: string[]; costoPorAdulto: number; precioPorAdulto: number } | null
  servicios: Array<{
    servicioId: string
    nombre: string
    unidad: string
    cantidad: number
    incluido: boolean
    costoUnitario: number | null
    precioUnitario: number
    precioTotal: number
  }>
  personal: Array<{ funcion: string; cantidad: number; tarifa: number; origenTarifa: string; ganancia: number; precioUnitario: number }>
  /** Desde scripts/018 (las anteriores no lo tienen). */
  dia?: Pick<DiaCotizado, "tipo" | "etiqueta" | "fechaEspecial">
  recargo?: { nombre: string; origen: "sabado" | "especial"; tipo: "monto" | "porcentaje"; valor: number; rubros: string[]; monto: number } | null
  avisos: Array<{ codigo: string; nivel: "ambar" | "rojo"; texto: string }>
  costoTotal: number | null
  total: number
}

export interface PersonaRoster {
  id: string
  nombre: string
  apellido: string
  funcion: string
  tarifaBase: number
  activo: boolean
}

/** Un lugar del personal del evento: una persona (o vacío) con su monto. */
export interface AsignacionPersonal {
  funcion: string
  personalId: string
  monto: number
}

/** Preasigna personas activas de cada función, con la tarifa de la cotización. */
export function asignacionesIniciales(desglose: DesgloseCotizacionV2, roster: PersonaRoster[]): AsignacionPersonal[] {
  const resultado: AsignacionPersonal[] = []
  for (const linea of desglose.personal) {
    const candidatos = roster
      .filter((p) => p.activo && p.funcion === linea.funcion)
      .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, "es"))
    for (let i = 0; i < linea.cantidad; i++) {
      resultado.push({ funcion: linea.funcion, personalId: candidatos[i]?.id ?? "", monto: linea.tarifa })
    }
  }
  return resultado
}

export function DetalleCotizacionNueva({
  desglose,
  clienteDni,
  fechaEvento,
  tipoEvento,
  roster,
  asignaciones,
  onAsignaciones,
}: {
  desglose: DesgloseCotizacionV2
  clienteDni: string | null
  fechaEvento: string | null
  tipoEvento: string | null
  roster: PersonaRoster[]
  asignaciones: AsignacionPersonal[]
  onAsignaciones: (a: AsignacionPersonal[]) => void
}) {
  const ganancia = desglose.costoTotal != null ? desglose.total - desglose.costoTotal : null
  const cambiar = (i: number, cambios: Partial<AsignacionPersonal>) =>
    onAsignaciones(asignaciones.map((a, j) => (j === i ? { ...a, ...cambios } : a)))
  const faltantes = asignaciones.filter((a) => !a.personalId)

  return (
    <div className="space-y-4">
      {/* Datos */}
      <div className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
        {fechaEvento && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {fechaEvento}
            {desglose.dia && <ChipDia dia={desglose.dia} recargo={desglose.recargo?.monto ?? 0} />}
          </div>
        )}
        {clienteDni && (
          <div className="flex items-center gap-1.5">
            <IdCard className="h-3.5 w-3.5" /> DNI {clienteDni}
          </div>
        )}
        {tipoEvento && <div>Tipo: {tipoEvento}</div>}
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {desglose.comensales} invitados ({desglose.adultos} adultos · {desglose.ninos} niños)
          {desglose.capacidadMaxima ? <span className="text-xs">· entran {desglose.capacidadMaxima}</span> : null}
        </div>
      </div>

      {/* Avisos */}
      {desglose.avisos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {desglose.avisos.map((a) => (
            <span
              key={a.codigo}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                a.nivel === "rojo" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {a.texto}
            </span>
          ))}
        </div>
      )}

      {/* Desglose por rubro: costo, ganancia y precio */}
      <div className="overflow-hidden rounded-lg border border-border text-sm">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <span>Rubro</span>
          <span className="text-right">Costo</span>
          <span className="text-right">Ganancia</span>
          <span className="text-right">Precio</span>
        </div>
        {/* Mismos colores por rubro que Configuración y el vendedor
            (components/cotizador-colores.tsx). Rojo/ámbar quedan solo para avisos. */}
        {desglose.rubros.map((r) => (
          <div key={r.clave} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-t border-border px-3 py-1.5 tabular-nums">
            <span className="flex min-w-0 items-center gap-2">
              <PuntoRubro clave={r.clave} origen={desglose.recargo?.origen} />
              <span className="min-w-0">{r.nombre}</span>
            </span>
            <span className="text-right text-muted-foreground">{fmt(r.costo ?? 0)}</span>
            <span className="text-right text-muted-foreground">
              {r.clave === "recargo"
                ? desglose.recargo?.tipo === "porcentaje"
                  ? `${desglose.recargo.valor} % de ${desglose.recargo.rubros.length} ${desglose.recargo.rubros.length === 1 ? "rubro" : "rubros"}`
                  : "monto fijo"
                : r.ganancia == null
                  ? "por función"
                  : `${r.ganancia} %`}
            </span>
            <span className="text-right">{fmt(r.precio)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-t-2 border-border px-3 py-1.5 font-semibold tabular-nums">
          <span>Total</span>
          <span className="text-right text-muted-foreground">{fmt(desglose.costoTotal ?? 0)}</span>
          <span className="text-right">{ganancia != null ? fmt(ganancia) : "—"}</span>
          <span className="text-right text-primary">{fmt(desglose.total)}</span>
        </div>
      </div>

      {/* De dónde sale cada rubro */}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        {desglose.recetas.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <PuntoRubro clave="cocina" />
              Menú
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {desglose.recetas.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>{r.nombre}</span>
                  <span className="tabular-nums">
                    {fmt(r.costoPorcion)} → {fmt(r.precioPorcion)}
                  </span>
                </li>
              ))}
            </ul>
            {desglose.recetas.length > 1 && <p className="text-xs text-muted-foreground">Se cobra el promedio por persona.</p>}
          </div>
        )}
        {desglose.barra && (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <PuntoRubro clave="barra" />
              Barra
            </p>
            <p className="text-muted-foreground">
              {desglose.barra.nombre} · {desglose.barra.cocteles.length} cócteles ·{" "}
              <span className="tabular-nums">
                {fmt(desglose.barra.costoPorAdulto)} → {fmt(desglose.barra.precioPorAdulto)} por adulto
              </span>
            </p>
          </div>
        )}
        {desglose.servicios.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <PuntoRubro clave="servicios" />
              Servicios (costo / precio)
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {desglose.servicios.map((s) => (
                <li key={s.servicioId} className="flex justify-between gap-2">
                  <span>
                    {s.nombre}
                    {s.cantidad > 1 ? ` ×${s.cantidad}` : ""}
                    {s.incluido && <span className="ml-1 text-xs">(incluido en el salón, no suma)</span>}
                  </span>
                  <span className="tabular-nums">
                    {fmt((s.costoUnitario ?? 0) * s.cantidad)}
                    {" / "}
                    <span className="text-foreground">{fmt(s.precioTotal)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Personal del evento: armado desde las reglas, editable */}
      {asignaciones.length > 0 && (
        <div className="text-sm">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PuntoRubro clave="personal" />
            <UserCheck className="h-3.5 w-3.5" />
            Personal del evento (sale de las reglas del salón)
          </p>
          {faltantes.length > 0 && (
            <p className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Faltan personas activas para: {[...new Set(faltantes.map((a) => a.funcion))].join(", ")}. Esos lugares quedan sin
              cargar en el evento.
            </p>
          )}
          <div className="space-y-1.5">
            {asignaciones.map((a, i) => {
              const candidatos = roster.filter((p) => p.activo && p.funcion === a.funcion)
              const ocupados = new Set(asignaciones.filter((_, j) => j !== i).map((x) => x.personalId).filter(Boolean))
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">{a.funcion}</span>
                  <Select value={a.personalId || "ninguno"} onValueChange={(v) => cambiar(i, { personalId: v === "ninguno" ? "" : v })}>
                    <SelectTrigger className="h-8 min-w-0 flex-1 sm:max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">Sin asignar</SelectItem>
                      {candidatos.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={ocupados.has(p.id)}>
                          {p.nombre} {p.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    aria-label={`Monto de ${a.funcion}`}
                    value={a.monto}
                    onChange={(e) => cambiar(i, { monto: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-8 w-28 shrink-0 text-right"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
