// Fechas especiales del cotizador (scripts/018). Solo servidor.
//
// Un día puntual (no se repite solo cada año) que se cotiza distinto en
// todos los salones o en algunos: "como sábado", "como viernes" o con un
// recargo propio. La cuenta está en lib/cotizador-salon.ts (resolverDia).
//
// Tablas: cotizador_fecha_especial (los datos) y
// cotizador_fecha_especial_salon (a qué salones aplica). Esta última tiene
// clave (fecha, salon): la BASE rechaza dos fechas especiales el mismo día
// para el mismo salón, además del chequeo de acá con un mensaje claro.
import { sql } from "@/lib/db"
import {
  SALONES_COTIZADOR,
  diaDeSemana,
  esSalonCotizador,
  fechaCorta,
  porcentajesPorRubro,
  reglaRecargoDesdeColumnas,
  validarReglaRecargo,
  type FechaEspecial,
  type ModoFechaEspecial,
} from "@/lib/cotizador-salon"

/** jsonb de verdad (no texto), como en app/api/vendedor/cotizaciones. */
const jsonb = (valor: unknown) => sql.json(valor as Parameters<typeof sql.json>[0])

const MODOS: ModoFechaEspecial[] = ["sabado", "viernes", "propio"]

interface Fila {
  id: string
  fecha: string
  nombre: string
  todos_los_salones: boolean
  modo: string
  recargo_tipo: string | null
  recargo_valor: unknown
  recargo_rubros: unknown
  /** scripts/020: el % de cada rubro (jsonb). Se lee con to_jsonb para que
   *  ande aunque la columna todavía no exista. */
  recargo_porcentajes: unknown
}

function desdeFila(f: Fila, salones: string[]): FechaEspecial {
  const modo = (MODOS.includes(f.modo as ModoFechaEspecial) ? f.modo : "viernes") as ModoFechaEspecial
  return {
    id: f.id,
    fecha: f.fecha,
    nombre: f.nombre,
    todosLosSalones: !!f.todos_los_salones,
    salones,
    modo,
    recargo:
      modo === "propio"
        ? reglaRecargoDesdeColumnas(f.recargo_tipo, f.recargo_valor, f.recargo_rubros, f.recargo_porcentajes)
        : null,
  }
}

/**
 * Fechas especiales ordenadas por fecha. `desde` ("YYYY-MM-DD") deja solo
 * de ese día en adelante; `fecha` trae solo ese día (para cotizar).
 * La fecha sale como texto (fecha::text): el driver convierte `date` en un
 * Date de JS y eso volvería a meter la zona horaria.
 */
export async function leerFechasEspeciales(filtro: { desde?: string; fecha?: string } = {}): Promise<FechaEspecial[]> {
  const filas = (filtro.fecha
    ? await sql`
        SELECT id, fecha::text AS fecha, nombre, todos_los_salones, modo, recargo_tipo, recargo_valor, recargo_rubros,
          (to_jsonb(cotizador_fecha_especial) -> 'recargo_porcentajes') AS recargo_porcentajes
        FROM cotizador_fecha_especial WHERE fecha = ${filtro.fecha}::date ORDER BY fecha, nombre`
    : filtro.desde
      ? await sql`
        SELECT id, fecha::text AS fecha, nombre, todos_los_salones, modo, recargo_tipo, recargo_valor, recargo_rubros,
          (to_jsonb(cotizador_fecha_especial) -> 'recargo_porcentajes') AS recargo_porcentajes
        FROM cotizador_fecha_especial WHERE fecha >= ${filtro.desde}::date ORDER BY fecha, nombre`
      : await sql`
        SELECT id, fecha::text AS fecha, nombre, todos_los_salones, modo, recargo_tipo, recargo_valor, recargo_rubros,
          (to_jsonb(cotizador_fecha_especial) -> 'recargo_porcentajes') AS recargo_porcentajes
        FROM cotizador_fecha_especial ORDER BY fecha, nombre`) as unknown as Fila[]
  if (filas.length === 0) return []
  const salones = (await sql`
    SELECT fecha_especial_id, salon FROM cotizador_fecha_especial_salon
  `) as unknown as Array<{ fecha_especial_id: string; salon: string }>
  return filas.map((f) =>
    desdeFila(
      f,
      SALONES_COTIZADOR.filter((s) => salones.some((x) => x.fecha_especial_id === f.id && x.salon === s)),
    ),
  )
}

/** Valida lo que manda la pantalla. Devuelve la fecha limpia o un error. */
export function validarFechaEspecial(body: unknown): Omit<FechaEspecial, "id"> | string {
  const b = (body ?? {}) as Record<string, unknown>
  const fecha = typeof b.fecha === "string" ? b.fecha : ""
  if (diaDeSemana(fecha) == null) return "Elegí un día válido."
  const nombre = typeof b.nombre === "string" ? b.nombre.trim() : ""
  if (!nombre) return "Poné un nombre (ej. «Víspera 9 de Julio»)."
  if (nombre.length > 80) return "El nombre es muy largo (máximo 80 letras)."
  const todosLosSalones = b.todosLosSalones !== false
  let salones: string[] = [...SALONES_COTIZADOR]
  if (!todosLosSalones) {
    const pedidos = Array.isArray(b.salones) ? b.salones : []
    if (pedidos.some((s) => !esSalonCotizador(s))) return "Hay un salón inválido."
    salones = SALONES_COTIZADOR.filter((s) => pedidos.includes(s))
    if (salones.length === 0) return "Elegí al menos un salón."
  }
  if (!MODOS.includes(b.modo as ModoFechaEspecial)) return "Elegí cómo se cotiza ese día."
  const modo = b.modo as ModoFechaEspecial
  let recargo: FechaEspecial["recargo"] = null
  if (modo === "propio") {
    const r = validarReglaRecargo(b.recargo, "Recargo propio")
    if (typeof r === "string") return r
    recargo = r
  }
  return { fecha, nombre, todosLosSalones, salones, modo, recargo }
}

/** Si ya hay OTRA fecha especial ese día para alguno de esos salones,
 *  devuelve el mensaje para mostrar. */
async function choque(fe: Omit<FechaEspecial, "id">, id: string | null): Promise<string | null> {
  const filas = (await sql`
    SELECT s.salon, f.nombre
    FROM cotizador_fecha_especial_salon s
    JOIN cotizador_fecha_especial f ON f.id = s.fecha_especial_id
    WHERE s.fecha = ${fe.fecha}::date AND s.fecha_especial_id <> ${id ?? ""}
  `) as unknown as Array<{ salon: string; nombre: string }>
  const pisadas = filas.filter((f) => fe.salones.includes(f.salon))
  if (pisadas.length === 0) return null
  return `Ya hay una fecha especial el ${fechaCorta(fe.fecha)} para ${pisadas.map((p) => p.salon).join(", ")}: «${pisadas[0].nombre}». Editá esa o elegí otros salones.`
}

/**
 * Alta (id null) o edición de una fecha especial, en una transacción (todo o
 * nada). Devuelve el id, o un mensaje si choca con otra del mismo día.
 */
export async function guardarFechaEspecial(fe: Omit<FechaEspecial, "id">, id: string | null): Promise<{ id: string } | string> {
  const msg = await choque(fe, id)
  if (msg) return msg
  const r = fe.recargo
  // El % de cada rubro (scripts/020); en monto fijo o sin recargo, null.
  const porcentajes = r?.tipo === "porcentaje" ? jsonb(porcentajesPorRubro(r)) : null
  try {
    return await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql
      let fid = id
      if (fid) {
        const filas = (await db`
          UPDATE cotizador_fecha_especial SET
            fecha = ${fe.fecha}::date, nombre = ${fe.nombre}, todos_los_salones = ${fe.todosLosSalones},
            modo = ${fe.modo}, recargo_tipo = ${r?.tipo ?? null}, recargo_valor = ${r?.valor ?? null},
            recargo_rubros = string_to_array(${r ? r.rubros.join(",") : null}::text, ','),
            recargo_porcentajes = ${porcentajes}, updated_at = now()
          WHERE id = ${fid} RETURNING id
        `) as unknown as Array<{ id: string }>
        if (!filas.length) throw new ErrorVisible("Esa fecha especial ya no existe (¿la borró alguien?).")
        await db`DELETE FROM cotizador_fecha_especial_salon WHERE fecha_especial_id = ${fid}`
      } else {
        const filas = (await db`
          INSERT INTO cotizador_fecha_especial (fecha, nombre, todos_los_salones, modo, recargo_tipo, recargo_valor, recargo_rubros, recargo_porcentajes)
          VALUES (${fe.fecha}::date, ${fe.nombre}, ${fe.todosLosSalones}, ${fe.modo}, ${r?.tipo ?? null}, ${r?.valor ?? null},
            string_to_array(${r ? r.rubros.join(",") : null}::text, ','), ${porcentajes})
          RETURNING id
        `) as unknown as Array<{ id: string }>
        fid = filas[0].id
      }
      for (const salon of fe.salones) {
        await db`
          INSERT INTO cotizador_fecha_especial_salon (fecha_especial_id, fecha, salon)
          VALUES (${fid}, ${fe.fecha}::date, ${salon})
        `
      }
      return { id: fid as string }
    })
  } catch (err) {
    if (err instanceof ErrorVisible) return err.message
    // Dos guardados a la vez para el mismo día y salón: lo frena la clave.
    if ((err as { code?: string })?.code === "23505") {
      return `Ya hay una fecha especial el ${fechaCorta(fe.fecha)} para alguno de esos salones.`
    }
    throw err
  }
}

class ErrorVisible extends Error {}

export async function borrarFechaEspecial(id: string): Promise<boolean> {
  const filas = (await sql`DELETE FROM cotizador_fecha_especial WHERE id = ${id} RETURNING id`) as unknown as Array<{ id: string }>
  return filas.length > 0
}
