// Ajuste del stock de UN insumo en varios salones, desde el lapicito de
// Almacén (cocina) o Almacén de Barra. Lógica pura (sin base ni React) para
// poder probarla en scripts/test-stock-ajuste-almacen.cjs.
//
// Por dentro es lo mismo que una carga de la pantalla de Stock: cada salón
// que cambia queda como una sesión de stock_sesiones (motivo
// 'extraordinaria', con su renglón en Actividad), se pisa la cantidad en
// stock_salones y el Stock total del insumo pasa a ser la suma de los
// salones. Ver app/api/stock-salones/ajuste/route.ts.

export type SectorAjuste = "cocina" | "barra"

export interface ItemAjuste {
  salon: string
  cantidad: number
  /** uuid generado en la pantalla: hace idempotente el reintento. */
  sesionId: string
}

export type ResultadoValidacion =
  | { ok: true; sector: SectorAjuste; insumoId: string; items: ItemAjuste[] }
  | { ok: false; error: string }

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Valida lo que manda la pantalla. El servidor no confía en el navegador:
 * salón que exista, cantidad de 0 o más, un solo valor por salón y un
 * sesionId válido (y distinto) por salón.
 */
export function validarAjusteAlmacen(body: unknown, salonesValidos: Set<string>): ResultadoValidacion {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const sector = b.sector
  if (sector !== "cocina" && sector !== "barra") return { ok: false, error: "Sector inválido" }
  const insumoId = typeof b.insumoId === "string" ? b.insumoId.trim() : ""
  if (!insumoId) return { ok: false, error: "Falta el insumo" }
  const crudos = Array.isArray(b.items) ? b.items : []
  if (crudos.length === 0) return { ok: false, error: "No hay cambios de stock para guardar" }
  if (crudos.length > 20) return { ok: false, error: "Demasiados salones" }

  const items: ItemAjuste[] = []
  const salones = new Set<string>()
  const sesiones = new Set<string>()
  for (const raw of crudos) {
    const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const salon = typeof it.salon === "string" ? it.salon : ""
    const sesionId = typeof it.sesionId === "string" ? it.sesionId.trim() : ""
    // Number("") da 0: un campo vacío no puede colarse como "no hay nada".
    const cantidad = typeof it.cantidad === "number" ? it.cantidad : Number.NaN
    if (!salonesValidos.has(salon)) return { ok: false, error: "Salón inválido" }
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      return { ok: false, error: "Hay una cantidad inválida (tiene que ser 0 o más)" }
    }
    if (!RE_UUID.test(sesionId)) return { ok: false, error: "Sesión inválida" }
    if (salones.has(salon)) return { ok: false, error: "Hay un salón repetido" }
    if (sesiones.has(sesionId)) return { ok: false, error: "Sesión repetida" }
    salones.add(salon)
    sesiones.add(sesionId)
    items.push({ salon, cantidad, sesionId })
  }
  return { ok: true, sector, insumoId, items }
}

/**
 * Qué salones cambiaron en el formulario del lapicito.
 *
 * - `actuales`: lo contado hoy por salón (sin entrada = nadie contó ahí).
 * - `escritos`: lo que quedó tipeado en cada campo, como texto.
 *
 * Un campo vacío NO cambia nada: no hay forma de "des-contar" un salón, y
 * vacío no es lo mismo que 0 (0 es "contamos y no hay"). Tampoco cuenta
 * como cambio volver a escribir el mismo número.
 */
export function cambiosDeStockPorSalon(
  actuales: Map<string, number>,
  escritos: Record<string, string>,
): Array<{ salon: string; cantidad: number }> {
  const cambios: Array<{ salon: string; cantidad: number }> = []
  for (const [salon, texto] of Object.entries(escritos)) {
    const limpio = (texto ?? "").trim().replace(",", ".")
    if (limpio === "") continue
    const cantidad = Number(limpio)
    if (!Number.isFinite(cantidad) || cantidad < 0) continue
    const antes = actuales.get(salon)
    if (antes !== undefined && Math.abs(antes - cantidad) < 0.0001) continue
    cambios.push({ salon, cantidad })
  }
  return cambios
}

/**
 * Total que va a quedar en la columna Stock: la suma de todos los salones,
 * con lo nuevo donde cambió. Un salón sin conteo suma 0, igual que en el
 * servidor.
 */
export function totalConCambios(
  actuales: Map<string, number>,
  cambios: Array<{ salon: string; cantidad: number }>,
): number {
  const porSalon = new Map(actuales)
  for (const c of cambios) porSalon.set(c.salon, c.cantidad)
  let total = 0
  for (const v of porSalon.values()) total += v
  return Math.round(total * 10000) / 10000
}
