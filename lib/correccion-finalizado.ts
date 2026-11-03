// Corregir los costos de un evento finalizado desde Costos del evento (pedido
// de Rodrigo, 3/11/2026: "quiero poder corregir si un costo estuvo mal, pero
// desde esta misma pantalla y al guardar que modifique correctamente las
// cajas. No quiero desarchivar, corregir y después volver a archivar").
//
// Un evento finalizado muestra la foto de costos que se guardó al finalizar
// (`costosCalculados.archivoCongelado`). Corregir una línea (menú, barra, la
// seña o el saldo de un servicio, el sueldo de una persona) hace dos cosas:
//  1. Cambia esa línea en la foto, que es lo que usan Costos del evento, la
//     tabla del desglose y el reparto de las cuotas que falten cobrar.
//  2. Si esa línea ya se pagó desde Caja Eventos, el egreso pasa a ser el
//     monto corregido (se reemplaza, con su misma fecha y concepto): la caja
//     recupera o paga la diferencia. Si todavía no se pagó, la caja no cambia
//     hasta que se marque pagada (por el monto corregido).
//
// También sirve para marcar pagado el sueldo de una persona de un finalizado:
// el estado "pagado" del personal vive en la foto (`fotoConPersonalPagado`).

export type LineaCostoFinalizado =
  | { rubro: "cocina" }
  | { rubro: "barra" }
  | { rubro: "seña"; servicioId: string }
  | { rubro: "saldo"; servicioId: string }
  | { rubro: "sueldo"; personalId: string }

type Foto = Record<string, unknown> & {
  personal?: Array<Record<string, unknown> & { id?: string; monto?: number; pagado?: boolean }>
  serviciosCalc?: Array<{ servicioId: string; montoSeña: number; saldo: number }>
}

const redondear = (n: number) => Math.round(n * 100) / 100

/** Recalcula los totales guardados en la foto para que sigan sumando bien. */
function conTotales(foto: Foto): Foto {
  const totalServicios = (foto.serviciosCalc || []).reduce((s, c) => s + (c.montoSeña || 0) + (c.saldo || 0), 0)
  const totalPersonal = (foto.personal || []).reduce((s, p) => s + (p.monto || 0), 0)
  return { ...foto, totalServicios: redondear(totalServicios), totalPersonal: redondear(totalPersonal) }
}

/**
 * Devuelve `costosCalculados` con la línea corregida en la foto del evento
 * finalizado. Sin foto, o si la línea no está en la foto, devuelve null (no
 * hay nada que corregir y quien llama no guarda).
 *
 * Menú y barra: el costo corregido queda en `montoPagadoCocina/Barra`, que es
 * lo que la foto usa como costo de ese rubro (pagado o no).
 */
export function fotoConCostoCorregido<T extends Record<string, unknown>>(
  costosCalculados: T | null | undefined,
  linea: LineaCostoFinalizado,
  monto: number,
): T | null {
  const foto = costosCalculados?.archivoCongelado as Foto | undefined
  if (!costosCalculados || !foto || !Number.isFinite(monto) || monto < 0) return null
  const valor = redondear(monto)
  let nueva: Foto
  if (linea.rubro === "cocina") nueva = { ...foto, montoPagadoCocina: valor }
  else if (linea.rubro === "barra") nueva = { ...foto, montoPagadoBarra: valor }
  else if (linea.rubro === "sueldo") {
    if (!(foto.personal || []).some((p) => p.id === linea.personalId)) return null
    nueva = { ...foto, personal: (foto.personal || []).map((p) => (p.id === linea.personalId ? { ...p, monto: valor } : p)) }
  } else {
    const campo = linea.rubro === "seña" ? "montoSeña" : "saldo"
    if (!(foto.serviciosCalc || []).some((s) => s.servicioId === linea.servicioId)) return null
    nueva = {
      ...foto,
      serviciosCalc: (foto.serviciosCalc || []).map((s) => (s.servicioId === linea.servicioId ? { ...s, [campo]: valor } : s)),
    }
  }
  return { ...costosCalculados, archivoCongelado: conTotales(nueva) }
}

/** Marca (o desmarca) pagado el sueldo de una persona en la foto. Null si no está. */
export function fotoConPersonalPagado<T extends Record<string, unknown>>(
  costosCalculados: T | null | undefined,
  personalId: string,
  pagado: boolean,
): T | null {
  const foto = costosCalculados?.archivoCongelado as Foto | undefined
  if (!costosCalculados || !foto || !(foto.personal || []).some((p) => p.id === personalId)) return null
  return {
    ...costosCalculados,
    archivoCongelado: { ...foto, personal: (foto.personal || []).map((p) => (p.id === personalId ? { ...p, pagado } : p)) },
  }
}

export type AccionCaja =
  /** No se pagó todavía, o el monto no cambia: la caja queda igual. */
  | { accion: "ninguna"; diferencia: 0 }
  /** Marcado pagado pero sin egreso en Caja Eventos (datos viejos): la caja queda igual. */
  | { accion: "sinEgreso"; diferencia: 0 }
  /** El egreso pasa a `montoEgreso`. diferencia > 0: sale más plata de la caja. */
  | { accion: "reemplazar"; montoEgreso: number; diferencia: number }
  /** Menú pagado solo a proveedores, a cuenta: se agrega un egreso por la diferencia. */
  | { accion: "agregar"; montoEgreso: number; diferencia: number }
  /** El costo corregido queda por debajo de lo pagado aparte (a proveedores): no se puede acá. */
  | { accion: "imposible"; minimo: number; diferencia: 0 }

/**
 * Qué hacer en Caja Eventos al corregir una línea.
 *  - pagado: si la línea está marcada pagada.
 *  - egresoMonto: el monto del egreso de esa línea, si se encontró.
 *  - pagadoAparte: lo pagado por otro camino que también cuenta en la línea
 *    (solo el menú: lo dado a proveedores desde Caja Eventos → Por pagar).
 */
export function accionCajaAlCorregir(opts: {
  pagado: boolean
  egresoMonto?: number
  pagadoAparte?: number
  montoNuevo: number
}): AccionCaja {
  const aparte = redondear(opts.pagadoAparte ?? 0)
  const nuevo = redondear(opts.montoNuevo)
  if (!opts.pagado) return { accion: "ninguna", diferencia: 0 }
  const objetivo = redondear(nuevo - aparte)
  if (objetivo < -0.005) return { accion: "imposible", minimo: aparte, diferencia: 0 }
  if (opts.egresoMonto !== undefined) {
    const diferencia = redondear(objetivo - opts.egresoMonto)
    if (Math.abs(diferencia) < 0.005) return { accion: "ninguna", diferencia: 0 }
    return { accion: "reemplazar", montoEgreso: objetivo, diferencia }
  }
  if (aparte > 0.005) {
    if (objetivo < 0.005) return { accion: "ninguna", diferencia: 0 }
    return { accion: "agregar", montoEgreso: objetivo, diferencia: objetivo }
  }
  return { accion: "sinEgreso", diferencia: 0 }
}

export type SectorCompra = "cocina" | "barra"

type LineaCompra = Record<string, unknown> & {
  insumoId?: string
  insumoBarraId?: string
  cantidadNecesaria?: number
  costoMateriaPrima?: number
}

/**
 * Corrige UN insumo de la cocina o la barra de un evento finalizado (pedido
 * de Rodrigo, 3/11/2026: "insumo por insumo, pero solo para ese evento, sin
 * que modifique otro ni stock"). Cambia solo esa fila de la foto: no toca el
 * Almacén, las recetas, el stock ni otros eventos.
 *
 * La cantidad va en la unidad del insumo (la que muestra la lista) y el costo
 * de la fila es cantidad × precio por unidad. El costo del rubro pasa a ser
 * la suma de las filas (queda en `montoPagadoCocina/Barra`, como al corregir
 * el total), así lista y total cierran.
 *
 * Devuelve la foto nueva con el total de antes y el nuevo, o null si no hay
 * foto, la fila no está o los números no sirven.
 */
export function fotoConInsumoCorregido<T extends Record<string, unknown>>(
  costosCalculados: T | null | undefined,
  sector: SectorCompra,
  id: string,
  cantidad: number,
  precioUnitario: number,
): { costosCalculados: T; totalAntes: number; totalNuevo: number; costoLinea: number } | null {
  const foto = costosCalculados?.archivoCongelado as (Foto & Record<string, unknown>) | undefined
  if (!costosCalculados || !foto) return null
  if (!Number.isFinite(cantidad) || cantidad < 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) return null
  const claveLista = sector === "cocina" ? "comprasCocina" : "comprasBarra"
  const claveId = sector === "cocina" ? "insumoId" : "insumoBarraId"
  const clavePagado = sector === "cocina" ? "montoPagadoCocina" : "montoPagadoBarra"
  const lista = (foto[claveLista] as LineaCompra[] | undefined) || []
  if (!lista.some((c) => c[claveId] === id)) return null

  const sumaAntes = lista.reduce((s, c) => s + (c.costoMateriaPrima || 0), 0)
  const pagadoGuardado = foto[clavePagado]
  const totalAntes = redondear(typeof pagadoGuardado === "number" ? pagadoGuardado : sumaAntes)
  const costoLinea = redondear(cantidad * precioUnitario)
  const nuevaLista = lista.map((c) =>
    c[claveId] === id ? { ...c, cantidadNecesaria: cantidad, costoMateriaPrima: costoLinea, costoEstimado: costoLinea } : c,
  )
  const totalNuevo = redondear(nuevaLista.reduce((s, c) => s + (c.costoMateriaPrima || 0), 0))
  const nueva = {
    ...foto,
    [claveLista]: nuevaLista,
    [clavePagado]: totalNuevo,
    [sector === "cocina" ? "costoCocina" : "costoBarra"]: totalNuevo,
  }
  return { costosCalculados: { ...costosCalculados, archivoCongelado: nueva }, totalAntes, totalNuevo, costoLinea }
}
