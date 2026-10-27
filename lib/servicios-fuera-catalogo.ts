// Servicios de un evento que ya no están en el catálogo.
//
// El planificador arma la lista de servicios con el catálogo activo: un
// servicio que después se borró o se desactivó sigue guardado en el evento
// (y cuenta en Costos del evento y en Caja Eventos), pero no aparecía en
// ningún lado para destildarlo. Pasó el 27/10/2026 con el evento de MIA:
// "FOTO + VIDEO" se había borrado del catálogo y quedó junto a
// "FOTOGRAFIA 2025", con la fotografía contada dos veces.

import type { Servicio, ServicioEvento } from "./store"

export interface ServicioFueraDeCatalogo {
  servicioId: string
  nombre: string
  /** Costo guardado en el evento (seña + saldo), el que cuenta Costos del evento. */
  costoGuardado: number
  /** true si ya tiene la seña o el saldo pagados: no se quita desde acá. */
  tienePagos: boolean
}

/** Mismo criterio que el planificador: la lista muestra solo los servicios activos. */
export function serviciosFueraDeCatalogo(
  serviciosEvento: ServicioEvento[],
  catalogo: Pick<Servicio, "id" | "activo">[],
): ServicioFueraDeCatalogo[] {
  const activos = new Set(catalogo.filter((s) => s.activo).map((s) => s.id))
  return serviciosEvento
    .filter((se) => !activos.has(se.servicioId))
    .map((se) => {
      const estado = se.estadoPago ?? (se.pagado ? "pagado_total" : "sin_seña")
      return {
        servicioId: se.servicioId,
        nombre: se.nombre || "Servicio sin nombre",
        costoGuardado: (se.montoSeña ?? 0) + (se.saldoPendiente ?? 0),
        tienePagos: estado !== "sin_seña" || !!se.pagoSueldo,
      }
    })
}

/** Saca del evento el servicio fuera de catálogo, sin tocar los demás. */
export function quitarServicioFueraDeCatalogo(
  serviciosEvento: ServicioEvento[],
  servicioId: string,
): ServicioEvento[] {
  return serviciosEvento.filter((se) => se.servicioId !== servicioId)
}
