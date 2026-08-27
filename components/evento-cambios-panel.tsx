"use client"

import { ArrowRight, ListChecks } from "lucide-react"
import { formatCurrency, salonLabel, type EventoGuardado, type Receta } from "@/lib/store"

/** Fila de cambio detectado entre el evento original y el estado en edicion. */
export interface CambioEvento {
  campo: string
  antes: string
  despues: string
  /** Como impacta este cambio en el resto del sistema. */
  impacto: string
}

const fmtFecha = (f?: string) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-AR") : "—")

const sameSet = (a: string[] = [], b: string[] = []) => {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

/**
 * Compara el evento cargado al entrar en edicion contra el estado actual y
 * devuelve una fila por cada parametro modificado, con su "antes → despues"
 * y una nota de como impacta en el sistema.
 */
export function detectarCambiosEvento(
  original: EventoGuardado,
  actual: EventoGuardado,
  recetas: Receta[] = [],
  catalogoServicios: { id: string; nombre: string }[] = [],
  barrasTemplates: { id: string; nombre: string }[] = [],
): CambioEvento[] {
  const cambios: CambioEvento[] = []
  const nombreReceta = (id: string) => recetas.find((r) => r.id === id)?.nombre || id
  const nombreServicio = (id: string) => catalogoServicios.find((s) => s.id === id)?.nombre || id

  // --- Fecha / salon / horarios ---
  if (original.fecha !== actual.fecha) {
    cambios.push({
      campo: "Fecha del evento",
      antes: fmtFecha(original.fecha),
      despues: fmtFecha(actual.fecha),
      impacto: "Mueve el evento en el Calendario y recalcula vencimientos y alertas asociadas.",
    })
  }
  if ((original.salon || "") !== (actual.salon || "")) {
    cambios.push({
      campo: "Salón",
      antes: original.salon ? salonLabel(original.salon) : "—",
      despues: actual.salon ? salonLabel(actual.salon) : "—",
      impacto: "Cambia la caja del salón en Caja Jazmines y la ubicación en Calendario y Lista.",
    })
  }
  if ((original.horario || "") !== (actual.horario || "") || (original.horarioFin || "") !== (actual.horarioFin || "")) {
    cambios.push({
      campo: "Horario",
      antes: `${original.horario || "—"} a ${original.horarioFin || "—"}`,
      despues: `${actual.horario || "—"} a ${actual.horarioFin || "—"}`,
      impacto: "Actualiza el horario en el contrato impreso y el Calendario.",
    })
  }
  if ((original.tipoEvento || "") !== (actual.tipoEvento || "")) {
    cambios.push({
      campo: "Tipo de evento",
      antes: original.tipoEvento || "—",
      despues: actual.tipoEvento || "—",
      impacto: "Cambia el título del contrato impreso.",
    })
  }
  if ((original.nombrePareja || "") !== (actual.nombrePareja || "")) {
    cambios.push({
      campo: "Agasajados",
      antes: original.nombrePareja || "—",
      despues: actual.nombrePareja || "—",
      impacto: "Cambia el nombre del evento en todo el sistema (Lista, Calendario, Pagos, contrato).",
    })
  }

  // --- Invitados ---
  const invitados: { campo: string; a: number; b: number }[] = [
    { campo: "Adultos", a: original.adultos || 0, b: actual.adultos || 0 },
    { campo: "Adolescentes", a: original.adolescentes || 0, b: actual.adolescentes || 0 },
    { campo: "Niños", a: original.ninos || 0, b: actual.ninos || 0 },
    { campo: "Dietas especiales", a: original.personasDietasEspeciales || 0, b: actual.personasDietasEspeciales || 0 },
  ]
  for (const inv of invitados) {
    if (inv.a !== inv.b) {
      cambios.push({
        campo: `Invitados · ${inv.campo}`,
        antes: String(inv.a),
        despues: String(inv.b),
        impacto: "Recalcula los costos de cocina, la lista de compras y los cubiertos del contrato.",
      })
    }
  }

  // --- Menu (recetas por tipo de comensal) ---
  const gruposMenu: { campo: string; a: string[]; b: string[] }[] = [
    { campo: "Menú adultos", a: original.recetasAdultos || [], b: actual.recetasAdultos || [] },
    { campo: "Menú adolescentes", a: original.recetasAdolescentes || [], b: actual.recetasAdolescentes || [] },
    { campo: "Menú niños", a: original.recetasNinos || [], b: actual.recetasNinos || [] },
    { campo: "Menú dietas especiales", a: original.recetasDietasEspeciales || [], b: actual.recetasDietasEspeciales || [] },
  ]
  for (const g of gruposMenu) {
    if (!sameSet(g.a, g.b)) {
      const agregadas = g.b.filter((id) => !g.a.includes(id)).map(nombreReceta)
      const quitadas = g.a.filter((id) => !g.b.includes(id)).map(nombreReceta)
      const partes: string[] = []
      if (agregadas.length) partes.push(`+ ${agregadas.join(", ")}`)
      if (quitadas.length) partes.push(`− ${quitadas.join(", ")}`)
      cambios.push({
        campo: g.campo,
        antes: `${g.a.length} receta${g.a.length === 1 ? "" : "s"}`,
        despues: partes.join(" · ") || `${g.b.length} recetas`,
        impacto: "Impacta los costos de cocina, la lista de compras y el Anexo I del contrato.",
      })
    }
  }

  // --- Barras ---
  const barrasA = (original.barras || []).map((b) => b.barraTemplateId).filter(Boolean) as string[]
  const barrasB = (actual.barras || []).map((b) => b.barraTemplateId).filter(Boolean) as string[]
  const coctelesA = (original.barras || []).flatMap((b) => b.coctelesIncluidos || [])
  const coctelesB = (actual.barras || []).flatMap((b) => b.coctelesIncluidos || [])
  if (!sameSet(barrasA, barrasB) || !sameSet(coctelesA, coctelesB)) {
    const nombreBarra = (id: string) => barrasTemplates.find((t) => t.id === id)?.nombre || id
    cambios.push({
      campo: "Barras",
      antes: barrasA.length ? barrasA.map(nombreBarra).join(", ") : "Sin barras",
      despues: barrasB.length ? barrasB.map(nombreBarra).join(", ") : "Sin barras",
      impacto: "Recalcula el costo de barra del evento y el detalle de tragos del contrato.",
    })
  }

  // --- Personal del evento ---
  const persA = (original.personalEvento || []).map((p) => `${p.nombre} (${p.funcion})`)
  const persB = (actual.personalEvento || []).map((p) => `${p.nombre} (${p.funcion})`)
  if (!sameSet(persA, persB)) {
    cambios.push({
      campo: "Personal del evento",
      antes: persA.length ? `${persA.length} persona${persA.length === 1 ? "" : "s"}` : "Sin personal",
      despues: persB.length ? persB.join(", ") : "Sin personal",
      impacto: "Impacta los sueldos a pagar en Caja Eventos y el personal asignado del contrato.",
    })
  }

  // --- Servicios del contrato ---
  const svcA = original.serviciosContrato || []
  const svcB = actual.serviciosContrato || []
  const libresA = original.serviciosLibresContrato || []
  const libresB = actual.serviciosLibresContrato || []
  if (!sameSet(svcA, svcB) || !sameSet(libresA, libresB)) {
    const agregados = [...svcB.filter((id) => !svcA.includes(id)).map(nombreServicio), ...libresB.filter((s) => !libresA.includes(s))]
    const quitados = [...svcA.filter((id) => !svcB.includes(id)).map(nombreServicio), ...libresA.filter((s) => !libresB.includes(s))]
    const partes: string[] = []
    if (agregados.length) partes.push(`+ ${agregados.join(", ")}`)
    if (quitados.length) partes.push(`− ${quitados.join(", ")}`)
    cambios.push({
      campo: "Servicios del contrato",
      antes: `${svcA.length + libresA.length} servicio${svcA.length + libresA.length === 1 ? "" : "s"}`,
      despues: partes.join(" · ") || `${svcB.length + libresB.length} servicios`,
      impacto: "Cambia la cláusula 5 del contrato y los costos de servicios del evento.",
    })
  }

  // --- Servicios contratados (con costo) ---
  const svcEvA = (original.servicios || []).map((s) => s.nombre)
  const svcEvB = (actual.servicios || []).map((s) => s.nombre)
  if (!sameSet(svcEvA, svcEvB)) {
    cambios.push({
      campo: "Servicios contratados",
      antes: svcEvA.length ? svcEvA.join(", ") : "Sin servicios",
      despues: svcEvB.length ? svcEvB.join(", ") : "Sin servicios",
      impacto: "Recalcula los costos del evento y las señas/saldos de proveedores en Caja Eventos.",
    })
  }

  // --- Plan de cuotas ---
  const pa = original.planDeCuotas
  const pb = actual.planDeCuotas
  if (
    (pa?.montoTotal ?? 0) !== (pb?.montoTotal ?? 0) ||
    (pa?.montoSena ?? 0) !== (pb?.montoSena ?? 0) ||
    (pa?.numeroCuotas ?? 0) !== (pb?.numeroCuotas ?? 0) ||
    (pa?.diaVencimiento ?? 0) !== (pb?.diaVencimiento ?? 0) ||
    (pa?.modalidadPago ?? "") !== (pb?.modalidadPago ?? "")
  ) {
    const resumen = (p?: EventoGuardado["planDeCuotas"]) =>
      p
        ? `${formatCurrency(p.montoTotal || 0)}${p.montoSena ? ` · seña ${formatCurrency(p.montoSena)}` : ""}${p.numeroCuotas ? ` · ${p.numeroCuotas} cuotas` : ""}`
        : "Sin plan"
    cambios.push({
      campo: "Plan de pagos",
      antes: resumen(pa),
      despues: resumen(pb),
      impacto: "Cambia los vencimientos en Pagos, la Caja y la cláusula 3 (forma de pago) del contrato.",
    })
  }

  // --- Datos del cliente / contrato ---
  const ca = original.contrato || {}
  const cb = actual.contrato || {}
  const camposCliente: { campo: string; a?: string; b?: string }[] = [
    { campo: "Nombre completo (cliente)", a: ca.nombreCompleto, b: cb.nombreCompleto },
    { campo: "DNI (cliente)", a: ca.dni, b: cb.dni },
    { campo: "Teléfono (cliente)", a: ca.telefono, b: cb.telefono },
    { campo: "Dirección (cliente)", a: ca.direccion, b: cb.direccion },
    { campo: "Email (cliente)", a: ca.email, b: cb.email },
    { campo: "Observaciones del contrato", a: ca.observaciones, b: cb.observaciones },
  ]
  for (const c of camposCliente) {
    if ((c.a || "") !== (c.b || "")) {
      cambios.push({
        campo: c.campo,
        antes: c.a || "—",
        despues: c.b || "—",
        impacto: "Actualiza los datos personales que se imprimen en el contrato.",
      })
    }
  }
  if ((ca.vendedor || "") !== (cb.vendedor || "")) {
    cambios.push({
      campo: "Vendedor",
      antes: ca.vendedor || "—",
      despues: cb.vendedor || "—",
      impacto: "Cambia a quién se le liquida la comisión en Vendedores y Caja Jazmines.",
    })
  }

  return cambios
}

/**
 * Panel lateral que muestra en vivo los cambios que se estan haciendo sobre
 * el evento y como impactan en el resto del sistema.
 */
export function EventoCambiosPanel({ cambios, acento = "#2d5a3d" }: { cambios: CambioEvento[]; acento?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: `color-mix(in srgb, ${acento} 8%, white)` }}
      >
        <ListChecks className="h-4 w-4 shrink-0" style={{ color: acento }} aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold" style={{ color: `color-mix(in srgb, ${acento} 80%, black)` }}>
          Cambios en este evento
        </span>
        {cambios.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
            style={{ color: acento, backgroundColor: `color-mix(in srgb, ${acento} 14%, white)` }}
          >
            {cambios.length}
          </span>
        )}
      </div>

      <div className="max-h-[38vh] overflow-y-auto">
        {cambios.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Todavía no hiciste cambios. Desbloqueá una sección con &quot;Modificar&quot; y editá el evento.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {cambios.map((c) => (
              <li key={c.campo} className="px-3 py-2">
                <p className="text-xs font-semibold text-foreground">{c.campo}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.antes}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium" style={{ color: acento }}>
                    {c.despues}
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700">{c.impacto}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
