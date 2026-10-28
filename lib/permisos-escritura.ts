// Quién puede modificar la base, y qué. Pedido del dueño (16/10/2026): que
// los perfiles que no son Administración o Soporte no puedan tocar la base ni
// editar información sensible, sin romper lo que hacen hoy.
//
// Administración y Soporte escriben todo, como antes. El resto CONSULTA lo
// mismo que antes (esto no cambia lecturas) y modifica solo lo que usan sus
// pantallas:
// - Cobrar cuota: cobrar y anular cuotas, el contrato (con el PIN de
//   Administración) y los gastos y retiros de Caja Jazmines del botón de
//   Inicio (components/gasto-rapido-modal.tsx).
// - Cocina y Barra: el stock, por sus rutas (/api/stock-salones/*); Cocina,
//   también su vajilla y utensilios (/api/insumos-vajilla).
// - Mantenimiento: la limpieza (/api/stock-salones/* y agregar artículos en
//   /api/insumos-limpieza).
// - Vendedor: sus cotizaciones y paquetes (/api/vendedor/*).
// - Clientes (el simulador): solo sus rutas (/api/clientes/*).
// - Cada perfil, su anotación de cada evento; Coordinación, el cronograma.
// Lo de Cocina, Barra, Mantenimiento, Clientes, las anotaciones y el
// cronograma ya lo controla cada ruta. Acá están las reglas del proxy de la
// base (/api/db), por donde pasa el data-service del navegador, y del
// guardado de eventos: antes los dos dejaban escribir a cualquier sesión,
// incluida la de DJ.
//
// Lógica pura, sin Request ni base, para poder probarla sola
// (scripts/test-permisos-escritura.cjs).

/** Perfiles que modifican todo. */
export const PERFILES_ACCESO_TOTAL = ["administracion", "soporte"] as const

export function tieneAccesoTotal(perfil: string | null | undefined): boolean {
  return !!perfil && (PERFILES_ACCESO_TOTAL as readonly string[]).includes(perfil)
}

export const MOTIVO_SOLO_CONSULTA = "Este perfil puede consultar estos datos, pero no modificarlos."
export const MOTIVO_COBRO = "Desde Cobrar cuota no se puede modificar esto. Lo hace Administración."

// ── Proxy /api/db (data-service → PostgREST) ────────────────────────────────

export interface PedidoProxy {
  /** GET, HEAD, POST, PATCH, PUT o DELETE */
  metodo: string
  /** La ruta después de /api/db, por ejemplo ["rest", "v1", "movimientos_caja"] */
  ruta: string[]
  query: URLSearchParams
  /** Header Prefer ("" si no vino) */
  prefer: string
  /** Header Content-Profile (el esquema); null si no vino */
  esquema: string | null
  /** Cuerpo JSON del pedido; undefined si no hay o no es JSON */
  cuerpo: unknown
}

/** Una fila que hay que leer de la base antes de dejar pasar el pedido. */
export interface FilaAVerificar {
  tabla: string
  id: string
  /** Columnas a leer (select de PostgREST) */
  columnas: string
}

export type DecisionProxy = { ok: true; verificar?: FilaAVerificar } | { ok: false; motivo: string }

const METODOS_LECTURA = new Set(["GET", "HEAD"])
// Un retiro deja 1 movimiento y pagar un gasto repartido, uno por salón.
const MAX_FILAS_POR_PEDIDO = 50

type Fila = Record<string, unknown>

function filasDelCuerpo(cuerpo: unknown): Fila[] | null {
  const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo]
  if (lista.length === 0 || lista.length > MAX_FILAS_POR_PEDIDO) return null
  if (!lista.every((f) => !!f && typeof f === "object" && !Array.isArray(f))) return null
  return lista as Fila[]
}

/**
 * Alta pura: con "resolution=merge-duplicates" (o on_conflict) PostgREST hace
 * un upsert y pisaría una fila que ya existe con el mismo id.
 */
function esSoloAlta(pedido: PedidoProxy): boolean {
  if (/resolution\s*=/i.test(pedido.prefer)) return false
  return [...pedido.query.keys()].every((k) => k === "select" || k === "columns")
}

/** El id de un DELETE que filtra por un único id ("?id=eq.X") y nada más. */
function idDelBorrado(query: URLSearchParams): string | null {
  const entradas = [...query.entries()]
  if (entradas.length !== 1) return null
  const [clave, valor] = entradas[0]
  if (clave !== "id" || !valor.startsWith("eq.") || valor.length <= 3) return null
  return valor.slice(3)
}

function sinEvento(valor: unknown): boolean {
  return valor === null || valor === undefined
}

/**
 * Lo que escribe Cobrar cuota por el proxy (todo desde lib/store-context.tsx):
 * - Retiro de Caja Jazmines y pago de un gasto: addMovimientosCaja, siempre
 *   egresos de Caja Jazmines sin evento.
 * - Archivo del retiro: archivarGasto con origen "caja_jazmines_variable".
 * - Agendar un gasto variable: addCostoOperativo (upsert de un gasto por
 *   vez, con un id nuevo). El id no puede existir: editar o pisar un gasto
 *   que ya está es de Caja Jazmines (se verifica con la fila).
 * - Anular un pago (devuelve sus ingresos): deleteMovimientoCaja de a un id;
 *   se verifica con la fila que sea un ingreso de un evento.
 * Cobrar una cuota NO pasa por acá: va por PATCH /api/eventos/[id].
 */
function revisarCobro(pedido: PedidoProxy): DecisionProxy {
  const rechazo: DecisionProxy = { ok: false, motivo: MOTIVO_COBRO }
  const { ruta, metodo } = pedido
  if (ruta.length !== 3 || ruta[0] !== "rest" || ruta[1] !== "v1") return rechazo
  if (pedido.esquema && pedido.esquema !== "public") return rechazo
  const tabla = ruta[2]

  if (metodo === "POST") {
    const filas = filasDelCuerpo(pedido.cuerpo)
    if (!filas) return rechazo
    if (tabla === "movimientos_caja") {
      const ok =
        esSoloAlta(pedido) &&
        filas.every((f) => f.tipo === "egreso" && f.caja_destino === "caja_jazmines" && sinEvento(f.evento_id))
      return ok ? { ok: true } : rechazo
    }
    if (tabla === "gastos_archivados") {
      const ok = esSoloAlta(pedido) && filas.every((f) => f.origen === "caja_jazmines_variable")
      return ok ? { ok: true } : rechazo
    }
    if (tabla === "costos_operativos") {
      const [fila] = filas
      const queryOk = [...pedido.query.entries()].every(
        ([k, v]) => k === "select" || k === "columns" || (k === "on_conflict" && v === "id"),
      )
      const ok = filas.length === 1 && queryOk && typeof fila.id === "string" && fila.id !== "" && fila.es_variable === true
      return ok ? { ok: true, verificar: { tabla, id: fila.id as string, columnas: "id" } } : rechazo
    }
    return rechazo
  }

  if (metodo === "DELETE" && tabla === "movimientos_caja") {
    const id = idDelBorrado(pedido.query)
    if (!id) return rechazo
    return { ok: true, verificar: { tabla, id, columnas: "id,tipo,evento_id,caja_destino" } }
  }

  return rechazo
}

/**
 * ¿Deja pasar el proxy este pedido? Las lecturas siempre (como antes);
 * Administración y Soporte, todo; Cobrar cuota, solo lo de revisarCobro; el
 * resto de los perfiles, ninguna escritura.
 *
 * Si vuelve `verificar`, el proxy lee esa fila con la service role y llama a
 * revisarFilaExistente antes de reenviar el pedido.
 */
export function revisarPedidoProxy(perfil: string | null | undefined, pedido: PedidoProxy): DecisionProxy {
  if (METODOS_LECTURA.has(pedido.metodo)) return { ok: true }
  if (tieneAccesoTotal(perfil)) return { ok: true }
  if (perfil === "cobro") return revisarCobro(pedido)
  return { ok: false, motivo: MOTIVO_SOLO_CONSULTA }
}

/**
 * Segunda mitad de revisarPedidoProxy, con la fila ya leída de la base
 * (null si no existe).
 */
export function revisarFilaExistente(verificar: FilaAVerificar, fila: Fila | null): DecisionProxy {
  if (verificar.tabla === "costos_operativos") {
    // Inicio > Cargar gastos solo agenda gastos nuevos. Cambiar uno que ya
    // está (el monto, si está pagado) es de Caja Jazmines.
    return fila
      ? { ok: false, motivo: "Desde Cobrar cuota solo se agendan gastos nuevos. Cambiarlos lo hace Administración." }
      : { ok: true }
  }
  if (verificar.tabla === "movimientos_caja") {
    // Un borrado que no borra nada.
    if (!fila) return { ok: true }
    // Ingreso de un evento en una de sus cajas: lo único que borra "Anular
    // pago" (app/eventos/pagos/page.tsx).
    const ingresoDeEvento =
      fila.tipo === "ingreso" &&
      !!fila.evento_id &&
      (fila.caja_destino === "caja_eventos" || fila.caja_destino === "caja_jazmines")
    return ingresoDeEvento ? { ok: true } : { ok: false, motivo: MOTIVO_COBRO }
  }
  return { ok: false, motivo: MOTIVO_COBRO }
}

// ── Guardado de eventos (PATCH /api/eventos/[id]) ───────────────────────────

// Lo que mandan las pantallas de Cobrar cuota al guardar un evento, siempre
// por updateEvento (lib/store-context.tsx), que agrega los campos de control.
const CAMPOS_COBRO = new Set([
  // Cobrar y anular cuotas (app/eventos/pagos/page.tsx). planCuotas y
  // montoTotalPlan no son columnas: el servidor no los guarda.
  "pagos", "planDeCuotas", "planCuotas", "montoTotalPlan",
  // Control de concurrencia e idempotencia del cobro.
  "_planEsperado", "_pagosEsperados", "_movimientosCobro", "_operacionCobro",
  // El servidor la ignora si no la manda Administración (lib/fecha-alta.ts).
  "fechaAlta",
])

/**
 * El contrato (components/contrato-panel.tsx): Cobrar cuota lo abre con el
 * PIN de Administración. Tiene los datos del cliente (DNI, teléfono,
 * dirección), así que el servidor exige el pase que deja ese PIN
 * (lib/auth/server.ts, signPaseContrato).
 */
export const CAMPOS_CONTRATO = new Set([
  "contrato", "condicionIVA", "condicionIva", "versionesContrato", "generacionesContrato", "fechaImpresion",
])

export const MOTIVO_PASE_CONTRATO =
  "Para cambiar el contrato hace falta el PIN de Administración. Cerrá el contrato y volvé a abrirlo con el PIN."

export type DecisionEvento = { ok: true } | { ok: false; motivo: string; campo?: string }

/**
 * ¿Puede este perfil guardar estos cambios de un evento?
 * - Administración y Soporte: todo, como antes.
 * - Cobrar cuota: solo lo que mandan sus pantallas. El contrato, con el pase
 *   del PIN de Administración; la observación del evento, solo borrarla
 *   (es lo único que ofrece su pantalla).
 * - El resto: nada. Sus pantallas no guardan eventos; la anotación y el
 *   cronograma van por sus propias rutas.
 */
export function revisarCambioEvento(
  perfil: string | null | undefined,
  cambios: unknown,
  { paseContrato }: { paseContrato: boolean },
): DecisionEvento {
  if (tieneAccesoTotal(perfil)) return { ok: true }
  if (perfil !== "cobro") return { ok: false, motivo: "Este perfil puede ver los eventos, pero no modificarlos." }
  if (!cambios || typeof cambios !== "object" || Array.isArray(cambios)) {
    return { ok: false, motivo: "Datos del evento inválidos." }
  }
  const datos = cambios as Record<string, unknown>
  for (const clave of Object.keys(datos)) {
    if (CAMPOS_CONTRATO.has(clave)) {
      if (!paseContrato) return { ok: false, motivo: MOTIVO_PASE_CONTRATO, campo: clave }
      continue
    }
    if (clave === "notasInternas") {
      if (datos.notasInternas !== "") {
        return { ok: false, motivo: "Desde Cobrar cuota solo se puede borrar la observación del evento.", campo: clave }
      }
      continue
    }
    if (!CAMPOS_COBRO.has(clave)) {
      return { ok: false, motivo: `Desde Cobrar cuota no se puede cambiar "${clave}" del evento.`, campo: clave }
    }
  }
  return { ok: true }
}

// ── Otras rutas ─────────────────────────────────────────────────────────────

export const MOTIVO_COTIZADOR = "Solo el Vendedor y Administración pueden cambiar cotizaciones y paquetes."

/** Cotizaciones y paquetes del cotizador (/api/vendedor/*): el Vendedor y quien lo administra. */
export function puedeEscribirCotizador(perfil: string | null | undefined): boolean {
  return perfil === "vendedor" || tieneAccesoTotal(perfil)
}

/** Cerrar una novedad: la ven en Inicio Administración, Soporte y Cobrar cuota. */
export function puedeCerrarNovedades(perfil: string | null | undefined): boolean {
  return perfil === "cobro" || tieneAccesoTotal(perfil)
}
