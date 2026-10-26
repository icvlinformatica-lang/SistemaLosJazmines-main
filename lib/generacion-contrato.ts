// Registro de cada impresión del contrato (`generacionesContrato` del evento)
// y el freno para no imprimir un contrato con cambios sin guardar.
//
// Por qué existe (26/10/2026): apareció un contrato impreso por el sistema
// (fecha de impresión 29/8/2026) de un evento que nunca se guardó. La vista
// previa del planificador dejaba imprimir lo que se estaba escribiendo sin
// guardarlo, y ni esa impresión ni la del Calendario quedaban anotadas.
import type { EventoGuardado, GeneracionContrato, PagoPersonal } from "@/lib/store"

export type OrigenGeneracionContrato = GeneracionContrato["origen"]

const ETIQUETAS_ORIGEN: Record<OrigenGeneracionContrato, string> = {
  contratos: "Contratos",
  generador: "el planificador",
  lista: "la Lista de eventos",
  calendario: "el Calendario",
  planificador: "el planificador",
}

/** "desde el Calendario", para el historial de impresiones del contrato. */
export function etiquetaOrigenGeneracion(origen: string | undefined): string {
  const etiqueta = origen ? ETIQUETAS_ORIGEN[origen as OrigenGeneracionContrato] : undefined
  return etiqueta ? `desde ${etiqueta}` : ""
}

/**
 * El contrato no se imprime con cambios sin guardar: lo impreso tiene que
 * ser lo que quedó en el sistema. `cantidadCambios` es lo que muestra el
 * panel "Cambios en curso"; además se miran la condición de IVA y el precio,
 * que salen en el contrato y ese panel no lista. Devuelve el aviso a
 * mostrar, o null si se puede imprimir.
 */
export function motivoParaNoImprimir(
  cantidadCambios: number,
  original?: Pick<EventoGuardado, "condicionIVA" | "precioVenta"> | null,
  actual?: Pick<EventoGuardado, "condicionIVA" | "precioVenta"> | null,
): string | null {
  const otrosCambios =
    !!original && !!actual &&
    ((original.condicionIVA || "") !== (actual.condicionIVA || "") ||
      (original.precioVenta ?? 0) !== (actual.precioVenta ?? 0))
  return cantidadCambios > 0 || otrosCambios
    ? "Tenés cambios sin guardar. Guardá el evento y después imprimí el contrato: así lo impreso queda registrado en el sistema."
    : null
}

/** Anotación de una impresión, con la misma cuenta que usa la Lista de eventos. */
export function nuevaGeneracionContrato(
  evento: Pick<EventoGuardado, "versionesContrato" | "personalEvento" | "planDeCuotas" | "id">,
  origen: OrigenGeneracionContrato,
  pagosPersonal: Pick<PagoPersonal, "eventoId" | "personalId" | "nombrePersonal">[] = [],
  ahora: Date = new Date(),
): GeneracionContrato {
  const versiones = evento.versionesContrato || []
  const personalEvento = evento.personalEvento || []
  const personalExtra = pagosPersonal.filter(
    (pp) =>
      pp.eventoId === evento.id &&
      !personalEvento.some(
        (pe) => pe.personalId === pp.personalId || pe.nombre.toLowerCase() === (pp.nombrePersonal || "").toLowerCase(),
      ),
  ).length
  return {
    id: `gen-${ahora.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    fecha: ahora.toISOString(),
    origen,
    version: versiones.length ? Math.max(...versiones.map((v) => v.version)) : undefined,
    cantidadPersonal: personalEvento.length + personalExtra,
    montoTotal: evento.planDeCuotas?.montoTotal || undefined,
  }
}

/** Lo que se le guarda al evento después de imprimir su contrato. */
export function cambiosAlImprimirContrato(
  evento: Parameters<typeof nuevaGeneracionContrato>[0] & Pick<EventoGuardado, "generacionesContrato">,
  origen: OrigenGeneracionContrato,
  pagosPersonal: Parameters<typeof nuevaGeneracionContrato>[2] = [],
  ahora: Date = new Date(),
): Pick<EventoGuardado, "generacionesContrato" | "fechaImpresion"> {
  return {
    generacionesContrato: [...(evento.generacionesContrato || []), nuevaGeneracionContrato(evento, origen, pagosPersonal, ahora)],
    fechaImpresion: ahora.toISOString(),
  }
}
