import type { HistorialIPCEntry } from "./store"

export interface PasoIPCCuota {
  mes: number
  anio: number
  porcentaje: number
  montoAnterior: number
  incremento: number
  montoAjustado: number
}

/** Reconstrucción informativa; nunca modifica el importe guardado ni prueba qué meses se aplicaron. */
export function reconstruirDesgloseIPC(
  montoBase: number,
  montoActual: number,
  historial: HistorialIPCEntry[],
  ahora: number = Date.now(),
): PasoIPCCuota[] {
  if (!Number.isFinite(montoBase) || !Number.isFinite(montoActual) || montoBase <= 0 || montoActual <= montoBase) return []

  const registros = historial
    .filter((entry) => {
      const aplicada = Date.parse(entry.fechaAplicacion)
      return Number.isFinite(aplicada) && aplicada <= ahora
    })
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)

  const meses = new Set<string>()
  for (const registro of registros) {
    const clave = `${registro.anio}-${registro.mes}`
    if (meses.has(clave) || !Number.isInteger(registro.mes) || registro.mes < 0 || registro.mes > 11 ||
      !Number.isInteger(registro.anio) || !Number.isFinite(registro.porcentaje) || registro.porcentaje < 0) return []
    meses.add(clave)
  }

  const coincidencias: PasoIPCCuota[][] = []
  for (let inicio = 0; inicio < registros.length; inicio++) {
    let monto = montoBase
    const pasos = registros.slice(inicio).map((registro) => {
      const montoAnterior = monto
      // El mismo redondeo a pesos usado por actualizarCuotasIPC, en cada mes, no al final.
      monto = Math.round(montoAnterior * (1 + registro.porcentaje / 100))
      return {
        mes: registro.mes,
        anio: registro.anio,
        porcentaje: registro.porcentaje,
        montoAnterior,
        incremento: monto - montoAnterior,
        montoAjustado: monto,
      }
    })
    if (Math.abs(monto - montoActual) < 0.01) coincidencias.push(pasos)
  }

  // Una coincidencia de importes no es una auditoría; ante ambigüedad no atribuimos meses.
  return coincidencias.length === 1 ? coincidencias[0] : []
}
