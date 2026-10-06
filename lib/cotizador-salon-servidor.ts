// Configuración del cotizador POR SALÓN leída/guardada en la base. Solo servidor.
//
// Tablas: scripts/015_cotizador_por_salon.sql. Cuentas: lib/cotizador-salon.ts.
// La usan /api/administracion/cotizador-salon (con costos, solo
// Administración/Soporte) y /api/vendedor/catalogo (solo precios).
import { sql } from "@/lib/db"
import {
  RECARGO_VACIO,
  SALONES_COTIZADOR,
  esSalonCotizador,
  porcentajesPorRubro,
  reglaRecargoDesdeColumnas,
  validarReglaRecargo,
  type AplicaRegla,
  type ReglaRecargo,
  type PersonaConTarifa,
  type ReglaPersonalSalon,
} from "@/lib/cotizador-salon"

/** jsonb de verdad (no texto), como en app/api/vendedor/cotizaciones. */
const jsonb = (valor: unknown) => sql.json(valor as Parameters<typeof sql.json>[0])

export interface ServicioSalon {
  servicioId: string
  oculto: boolean
  incluido: boolean
}

export interface ConfigSalon {
  salon: string
  costoSalon: number
  /** null = sin capacidad cargada. */
  capacidadMaxima: number | null
  gananciaSalon: number
  gananciaCocina: number
  gananciaBarra: number
  gananciaServicios: number
  /** Recargo de sábado (scripts/018). Valor 0 = sin recargo. */
  recargoSabado: ReglaRecargo
  /** Platos que aparecen como botón, en orden. */
  recetas: string[]
  /** Barras armadas que aparecen. */
  barras: string[]
  /** Solo los servicios con algo distinto de lo normal (oculto o incluido). */
  servicios: ServicioSalon[]
  reglasPersonal: ReglaPersonalSalon[]
}

export interface ServicioConCosto {
  id: string
  nombre: string
  categoria: string
  unidad: string
  /** costo_para_caja_eventos: dato interno, nunca viaja al vendedor. */
  costo: number
}

const APLICA_VALIDOS: AplicaRegla[] = ["siempre", "con_menu", "con_barra"]
/** Tope de ganancia: 1000 % (cualquier cosa más grande es un error de tipeo). */
const GANANCIA_MAXIMA = 1000

const num = (v: unknown) => Number(v) || 0

export function configVacia(salon: string): ConfigSalon {
  return {
    salon,
    costoSalon: 0,
    capacidadMaxima: null,
    gananciaSalon: 0,
    gananciaCocina: 0,
    gananciaBarra: 0,
    gananciaServicios: 0,
    recargoSabado: { ...RECARGO_VACIO, rubros: [...RECARGO_VACIO.rubros] },
    recetas: [],
    barras: [],
    servicios: [],
    reglasPersonal: [],
  }
}

/** Configuración de un salón. Si todavía no tiene fila, sale todo en 0. */
export async function leerConfigSalon(salon: string): Promise<ConfigSalon> {
  // En dos tandas chicas por el pooler de Supabase (ver /api/vendedor/catalogo).
  const [filas, recetas, barras] = (await Promise.all([
    sql`SELECT * FROM cotizador_salon WHERE salon = ${salon}`,
    sql`SELECT receta_id FROM cotizador_salon_receta WHERE salon = ${salon} ORDER BY orden ASC, receta_id ASC`,
    sql`SELECT barra_template_id FROM cotizador_salon_barra WHERE salon = ${salon}`,
  ])) as unknown as [Array<Record<string, unknown>>, Array<{ receta_id: string }>, Array<{ barra_template_id: string }>]
  const [servicios, reglas] = (await Promise.all([
    sql`SELECT servicio_id, oculto, incluido FROM cotizador_salon_servicio WHERE salon = ${salon}`,
    sql`
      SELECT funcion, cada_n_invitados, minimo, tarifa, ganancia, aplica
      FROM cotizador_personal_regla WHERE salon = ${salon}
      ORDER BY orden ASC, funcion ASC
    `,
  ])) as unknown as [Array<{ servicio_id: string; oculto: boolean; incluido: boolean }>, Array<Record<string, unknown>>]

  const f = filas[0]
  return {
    ...configVacia(salon),
    ...(f
      ? {
          costoSalon: num(f.costo_salon),
          capacidadMaxima: f.capacidad_maxima == null ? null : num(f.capacidad_maxima),
          gananciaSalon: num(f.ganancia_salon),
          gananciaCocina: num(f.ganancia_cocina),
          gananciaBarra: num(f.ganancia_barra),
          gananciaServicios: num(f.ganancia_servicios),
          recargoSabado: recargoDesdeFila(f),
        }
      : {}),
    recetas: recetas.map((r) => r.receta_id),
    barras: barras.map((b) => b.barra_template_id),
    servicios: servicios
      .filter((s) => s.oculto || s.incluido)
      .map((s) => ({ servicioId: s.servicio_id, oculto: !!s.oculto, incluido: !!s.incluido })),
    reglasPersonal: reglas.map(reglaDesdeFila),
  }
}

/** La configuración de los 5 salones en pocas consultas (para el catálogo
 *  del vendedor, que necesita todos). Mismo resultado que leerConfigSalon. */
export async function leerConfigTodosLosSalones(): Promise<ConfigSalon[]> {
  const [filas, recetas, barras] = (await Promise.all([
    sql`SELECT * FROM cotizador_salon`,
    sql`SELECT salon, receta_id FROM cotizador_salon_receta ORDER BY orden ASC, receta_id ASC`,
    sql`SELECT salon, barra_template_id FROM cotizador_salon_barra`,
  ])) as unknown as [
    Array<Record<string, unknown>>,
    Array<{ salon: string; receta_id: string }>,
    Array<{ salon: string; barra_template_id: string }>,
  ]
  const [servicios, reglas] = (await Promise.all([
    sql`SELECT salon, servicio_id, oculto, incluido FROM cotizador_salon_servicio`,
    sql`
      SELECT salon, funcion, cada_n_invitados, minimo, tarifa, ganancia, aplica
      FROM cotizador_personal_regla ORDER BY orden ASC, funcion ASC
    `,
  ])) as unknown as [
    Array<{ salon: string; servicio_id: string; oculto: boolean; incluido: boolean }>,
    Array<Record<string, unknown>>,
  ]

  return SALONES_COTIZADOR.map((salon) => {
    const f = filas.find((x) => x.salon === salon)
    return {
      ...configVacia(salon),
      ...(f
        ? {
            costoSalon: num(f.costo_salon),
            capacidadMaxima: f.capacidad_maxima == null ? null : num(f.capacidad_maxima),
            gananciaSalon: num(f.ganancia_salon),
            gananciaCocina: num(f.ganancia_cocina),
            gananciaBarra: num(f.ganancia_barra),
            gananciaServicios: num(f.ganancia_servicios),
            recargoSabado: recargoDesdeFila(f),
          }
        : {}),
      recetas: recetas.filter((r) => r.salon === salon).map((r) => r.receta_id),
      barras: barras.filter((b) => b.salon === salon).map((b) => b.barra_template_id),
      servicios: servicios
        .filter((s) => s.salon === salon && (s.oculto || s.incluido))
        .map((s) => ({ servicioId: s.servicio_id, oculto: !!s.oculto, incluido: !!s.incluido })),
      reglasPersonal: reglas.filter((r) => r.salon === salon).map(reglaDesdeFila),
    }
  })
}

// recargo_sabado_porcentajes (scripts/020) llega con SELECT *; sin la
// columna o en null, se lee como antes (un solo % para los rubros tildados).
function recargoDesdeFila(f: Record<string, unknown>): ReglaRecargo {
  return reglaRecargoDesdeColumnas(
    f.recargo_sabado_tipo,
    f.recargo_sabado_valor,
    f.recargo_sabado_rubros,
    f.recargo_sabado_porcentajes,
  )
}

function reglaDesdeFila(r: Record<string, unknown>): ReglaPersonalSalon {
  return {
    funcion: String(r.funcion),
    cadaNInvitados: num(r.cada_n_invitados),
    minimo: num(r.minimo),
    tarifa: r.tarifa == null ? null : num(r.tarifa),
    ganancia: num(r.ganancia),
    aplica: (APLICA_VALIDOS.includes(r.aplica as AplicaRegla) ? r.aplica : "siempre") as AplicaRegla,
  }
}

/** Servicios activos con su costo (costo_para_caja_eventos). Solo Administración. */
export async function leerServiciosConCosto(): Promise<ServicioConCosto[]> {
  const filas = (await sql`
    SELECT id, nombre, categoria, unidad, costo_para_caja_eventos
    FROM servicios WHERE activo = true
    ORDER BY orden ASC NULLS LAST, nombre ASC
  `) as unknown as Array<{ id: string; nombre: string; categoria: string; unidad: string | null; costo_para_caja_eventos: unknown }>
  return filas.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    categoria: s.categoria,
    unidad: s.unidad || "Fijo",
    costo: num(s.costo_para_caja_eventos),
  }))
}

/** Personal activo con su tarifa base, para la tarifa más alta por función. */
export async function leerPersonalConTarifa(): Promise<PersonaConTarifa[]> {
  const filas = (await sql`
    SELECT id, nombre, apellido, funcion, tarifa_base
    FROM personal WHERE activo = true
    ORDER BY funcion ASC, apellido ASC
  `) as unknown as Array<{ id: string; nombre: string; apellido: string; funcion: string; tarifa_base: unknown }>
  return filas.map((p) => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, funcion: p.funcion, tarifaBase: num(p.tarifa_base) }))
}

const numeroValido = (v: unknown, max = Number.POSITIVE_INFINITY) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null
}

/**
 * Valida lo que manda la pantalla. Devuelve la config limpia o un mensaje de
 * error para mostrar. `funcionesPermitidas`: funciones del personal activo +
 * las que ya tenía guardadas el salón (para no trabar el guardado si alguien
 * dio de baja a la única persona de una función).
 */
export function validarConfigSalon(body: unknown, funcionesPermitidas: Set<string>): ConfigSalon | string {
  const b = (body ?? {}) as Record<string, unknown>
  if (!esSalonCotizador(b.salon)) return "Salón inválido."
  const costoSalon = numeroValido(b.costoSalon)
  if (costoSalon == null) return "Costo del salón inválido."

  let capacidadMaxima: number | null = null
  if (b.capacidadMaxima != null && b.capacidadMaxima !== "") {
    const c = Number(b.capacidadMaxima)
    if (!Number.isInteger(c) || c <= 0) return "La capacidad máxima tiene que ser un número entero mayor a 0."
    capacidadMaxima = c
  }

  const ganancias: Record<string, number> = {}
  for (const [campo, nombre] of [
    ["gananciaSalon", "salón"],
    ["gananciaCocina", "cocina"],
    ["gananciaBarra", "barra"],
    ["gananciaServicios", "servicios"],
  ] as const) {
    const g = numeroValido(b[campo], GANANCIA_MAXIMA)
    if (g == null) return `Ganancia de ${nombre} inválida (de 0 a ${GANANCIA_MAXIMA} %).`
    ganancias[campo] = g
  }

  // Sin el bloque (pantalla vieja abierta) → sin recargo, igual que hoy.
  const recargoSabado = b.recargoSabado == null ? RECARGO_VACIO : validarReglaRecargo(b.recargoSabado, "Recargo de sábado")
  if (typeof recargoSabado === "string") return recargoSabado

  const textos = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))] : []

  const servicios: ServicioSalon[] = []
  const vistos = new Set<string>()
  for (const s of Array.isArray(b.servicios) ? b.servicios : []) {
    const id = (s as Record<string, unknown>)?.servicioId
    if (typeof id !== "string" || !id || vistos.has(id)) continue
    vistos.add(id)
    const oculto = !!(s as Record<string, unknown>).oculto
    const incluido = !!(s as Record<string, unknown>).incluido
    if (oculto || incluido) servicios.push({ servicioId: id, oculto, incluido })
  }

  const reglasPersonal: ReglaPersonalSalon[] = []
  const funciones = new Set<string>()
  for (const r of Array.isArray(b.reglasPersonal) ? b.reglasPersonal : []) {
    const x = (r ?? {}) as Record<string, unknown>
    const funcion = typeof x.funcion === "string" ? x.funcion : ""
    if (!funcion) return "Hay una regla de personal sin función elegida."
    if (!funcionesPermitidas.has(funcion)) return `"${funcion}" no es una función del personal activo.`
    if (funciones.has(funcion)) return `La función "${funcion}" está repetida.`
    funciones.add(funcion)
    const cada = Number(x.cadaNInvitados)
    const minimo = Number(x.minimo)
    if (!Number.isInteger(cada) || cada < 0) return `${funcion}: "cada N invitados" tiene que ser un entero (0 = fijo).`
    if (!Number.isInteger(minimo) || minimo < 0) return `${funcion}: el mínimo tiene que ser un entero.`
    let tarifa: number | null = null
    if (x.tarifa != null && x.tarifa !== "") {
      tarifa = numeroValido(x.tarifa)
      if (tarifa == null) return `${funcion}: tarifa inválida.`
    }
    const ganancia = numeroValido(x.ganancia, GANANCIA_MAXIMA)
    if (ganancia == null) return `${funcion}: ganancia inválida (de 0 a ${GANANCIA_MAXIMA} %).`
    const aplica = APLICA_VALIDOS.includes(x.aplica as AplicaRegla) ? (x.aplica as AplicaRegla) : null
    if (!aplica) return `${funcion}: "aplica" inválido.`
    reglasPersonal.push({ funcion, cadaNInvitados: cada, minimo, tarifa, ganancia, aplica })
  }

  return {
    salon: b.salon,
    costoSalon,
    capacidadMaxima,
    gananciaSalon: ganancias.gananciaSalon,
    gananciaCocina: ganancias.gananciaCocina,
    gananciaBarra: ganancias.gananciaBarra,
    gananciaServicios: ganancias.gananciaServicios,
    recargoSabado,
    recetas: textos(b.recetas),
    barras: textos(b.barras),
    servicios,
    reglasPersonal,
  }
}

/** Funciones que puede tener una regla del salón: las del personal activo +
 *  las que el salón ya tenía guardadas. */
export async function funcionesPermitidas(salon: string): Promise<Set<string>> {
  const filas = (await sql`
    SELECT funcion FROM personal WHERE activo = true
    UNION
    SELECT funcion FROM cotizador_personal_regla WHERE salon = ${salon}
  `) as unknown as Array<{ funcion: string }>
  return new Set(filas.map((f) => f.funcion))
}

/**
 * Guarda TODA la configuración de un salón en una transacción (todo o nada).
 * Solo toca filas de ESE salón: los demás salones no se mueven.
 * Recetas, barras y servicios que ya no existen se descartan antes de
 * insertar (si no, la referencia a la tabla haría fallar todo el guardado).
 */
export async function guardarConfigSalon(cfg: ConfigSalon): Promise<void> {
  // Tablas chicas: se traen todos los ids (el proxy de lib/db.ts confunde un
  // array suelto con un template, así que no se usa sql(lista)).
  const [recetasOk, barrasOk, serviciosOk] = (await Promise.all([
    sql`SELECT id FROM recetas`,
    sql`SELECT id FROM barra_templates`,
    sql`SELECT id FROM servicios`,
  ])) as unknown as [Array<{ id: string }>, Array<{ id: string }>, Array<{ id: string }>]
  const existe = (filas: Array<{ id: string }>) => new Set(filas.map((f) => f.id))
  const recetasExisten = existe(recetasOk)
  const barrasExisten = existe(barrasOk)
  const serviciosExisten = existe(serviciosOk)

  // El % de cada rubro (scripts/020); en monto fijo queda en null.
  const porcentajes = cfg.recargoSabado.tipo === "porcentaje" ? jsonb(porcentajesPorRubro(cfg.recargoSabado)) : null
  await sql.begin(async (tx) => {
    const db = tx as unknown as typeof sql
    await db`
      INSERT INTO cotizador_salon (salon, costo_salon, capacidad_maxima, ganancia_salon,
        ganancia_cocina, ganancia_barra, ganancia_servicios,
        recargo_sabado_tipo, recargo_sabado_valor, recargo_sabado_rubros, recargo_sabado_porcentajes, updated_at)
      VALUES (${cfg.salon}, ${cfg.costoSalon}, ${cfg.capacidadMaxima}, ${cfg.gananciaSalon},
        ${cfg.gananciaCocina}, ${cfg.gananciaBarra}, ${cfg.gananciaServicios},
        ${cfg.recargoSabado.tipo}, ${cfg.recargoSabado.valor},
        string_to_array(${cfg.recargoSabado.rubros.join(",")}, ','), ${porcentajes}, now())
      ON CONFLICT (salon) DO UPDATE SET
        costo_salon = excluded.costo_salon,
        capacidad_maxima = excluded.capacidad_maxima,
        ganancia_salon = excluded.ganancia_salon,
        ganancia_cocina = excluded.ganancia_cocina,
        ganancia_barra = excluded.ganancia_barra,
        ganancia_servicios = excluded.ganancia_servicios,
        recargo_sabado_tipo = excluded.recargo_sabado_tipo,
        recargo_sabado_valor = excluded.recargo_sabado_valor,
        recargo_sabado_rubros = excluded.recargo_sabado_rubros,
        recargo_sabado_porcentajes = excluded.recargo_sabado_porcentajes,
        updated_at = now()
    `

    await db`DELETE FROM cotizador_salon_receta WHERE salon = ${cfg.salon}`
    let orden = 0
    for (const recetaId of cfg.recetas) {
      if (!recetasExisten.has(recetaId)) continue
      orden++
      await db`INSERT INTO cotizador_salon_receta (salon, receta_id, orden) VALUES (${cfg.salon}, ${recetaId}, ${orden})`
    }

    await db`DELETE FROM cotizador_salon_barra WHERE salon = ${cfg.salon}`
    for (const barraId of cfg.barras) {
      if (!barrasExisten.has(barraId)) continue
      await db`INSERT INTO cotizador_salon_barra (salon, barra_template_id) VALUES (${cfg.salon}, ${barraId})`
    }

    await db`DELETE FROM cotizador_salon_servicio WHERE salon = ${cfg.salon}`
    for (const s of cfg.servicios) {
      if (!serviciosExisten.has(s.servicioId)) continue
      await db`
        INSERT INTO cotizador_salon_servicio (salon, servicio_id, oculto, incluido)
        VALUES (${cfg.salon}, ${s.servicioId}, ${s.oculto}, ${s.incluido})
      `
    }

    await db`DELETE FROM cotizador_personal_regla WHERE salon = ${cfg.salon}`
    let ordenRegla = 0
    for (const r of cfg.reglasPersonal) {
      ordenRegla++
      await db`
        INSERT INTO cotizador_personal_regla
          (salon, funcion, cada_n_invitados, minimo, tarifa, ganancia, aplica, orden)
        VALUES (${cfg.salon}, ${r.funcion}, ${r.cadaNInvitados}, ${r.minimo}, ${r.tarifa},
          ${r.ganancia}, ${r.aplica}, ${ordenRegla})
      `
    }
  })
}

/** Copia la configuración completa de un salón a otro (pisa la del destino). */
export async function copiarConfigSalon(desde: string, hacia: string): Promise<void> {
  const origen = await leerConfigSalon(desde)
  await guardarConfigSalon({ ...origen, salon: hacia })
}
