export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  eventoPendienteEnBase,
  perfilDesdeRequest,
  salonesConfigurados,
  fechaHoraCortaArgentina,
} from "@/lib/stock-salones-server"
import { verifyPinStockExtra } from "@/lib/auth/server"
import { sectoresPermitidos, type SectorStock } from "@/lib/stock-salones"

/**
 * POST — confirma una sesión de carga de stock de un salón.
 *
 * body: {
 *   sesionId: string (uuid generado por la pantalla al empezar la carga)
 *   salon: string
 *   sector: "cocina" | "barra"
 *   cargadoPor: string (nombre tipeado al iniciar, obligatorio)
 *   pin?: string (solo para la carga extraordinaria, ver abajo)
 *   iniciadaEn?: string (ISO)
 *   items: { insumoId: string, cantidad: number }[]
 * }
 *
 * DOS PUERTAS para poder cargar:
 *   1. Por evento — hay un evento terminado pendiente de carga en ese salón y
 *      sector. Sin PIN. La sesión queda atada a ese evento (motivo 'evento').
 *   2. Extraordinaria — no hay evento. Hace falta PIN_STOCK_EXTRA y la sesión
 *      queda rotulada 'extraordinaria', con evento_id en null.
 * Sin evento y sin PIN correcto: 403.
 *
 * Cuál de las dos es lo decide el SERVIDOR: vuelve a calcular si hay evento
 * pendiente en vez de creerle al cliente. El eventoId que mande la pantalla
 * se ignora — si la puerta la abre un evento, se usa ese; si no, ninguno.
 *
 * Se guarda COMPLETA o no se guarda: una sola transacción que inserta
 * stock_sesiones + todos los stock_sesion_items + upsert en stock_salones +
 * un renglón en activity_log (con el MISMO id que la sesión, para abrir el
 * detalle desde el historial). Si se corta internet a mitad, no queda media
 * sesión.
 *
 * Idempotente por sesionId: si la misma sesión llega dos veces (doble clic,
 * reintento tras un corte), la segunda no hace nada y responde ok.
 *
 * ACTUALIZA insumos.stock_actual / insumos_barra.stock_actual: desde que el
 * conteo por salón es el stock real, el total de un insumo es la SUMA de lo
 * que hay en cada salón. Se recalcula acá, dentro de la misma transacción,
 * solo para los insumos de esta sesión — si falla, no queda stock_salones
 * actualizado con el total viejo.
 *
 * OJO: ese total alimenta dos cálculos de plata — el costo estimado de
 * compras del evento (lib/store.ts, que va al reparto de cajas) y la
 * valorización del patrimonio en Caja Eventos. Cargar un conteo los mueve.
 */

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS = 1000

interface ItemBody {
  insumoId: string
  cantidad: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const sesionId = typeof body.sesionId === "string" ? body.sesionId.trim() : ""
    const salon = typeof body.salon === "string" ? body.salon : ""
    const sector = body.sector as SectorStock
    const cargadoPor = typeof body.cargadoPor === "string" ? body.cargadoPor.trim().slice(0, 60) : ""
    const pin = typeof body.pin === "string" ? body.pin : ""
    const itemsBody: ItemBody[] = Array.isArray(body.items) ? body.items : []

    // ── Permisos: perfil real de la sesión ────────────────────────────────
    const perfil = await perfilDesdeRequest(req)
    if (!sectoresPermitidos(perfil).includes(sector)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede cargar ese sector" }, { status: 403 })
    }

    // ── Validaciones ──────────────────────────────────────────────────────
    if (!RE_UUID.test(sesionId)) {
      return NextResponse.json({ ok: false, error: "Sesión inválida" }, { status: 400 })
    }
    const salones = await salonesConfigurados()
    if (!salones.has(salon)) {
      return NextResponse.json({ ok: false, error: "Salón inválido" }, { status: 400 })
    }
    if (!cargadoPor) {
      return NextResponse.json({ ok: false, error: "Falta el nombre de quien carga" }, { status: 400 })
    }
    if (itemsBody.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay insumos para guardar" }, { status: 400 })
    }
    if (itemsBody.length > MAX_ITEMS) {
      return NextResponse.json({ ok: false, error: "Demasiados insumos en una sola carga" }, { status: 400 })
    }
    const vistos = new Set<string>()
    for (const it of itemsBody) {
      const cantidad = Number(it?.cantidad)
      if (typeof it?.insumoId !== "string" || !it.insumoId) {
        return NextResponse.json({ ok: false, error: "Hay un insumo inválido" }, { status: 400 })
      }
      if (!Number.isFinite(cantidad) || cantidad < 0) {
        return NextResponse.json({ ok: false, error: "Hay una cantidad inválida (tiene que ser 0 o más)" }, { status: 400 })
      }
      if (vistos.has(it.insumoId)) {
        return NextResponse.json({ ok: false, error: "Hay un insumo repetido en la carga" }, { status: 400 })
      }
      vistos.add(it.insumoId)
    }

    // Catálogo del sector (nunca mezclar cocina con barra). Descripción y
    // unidad se COPIAN al detalle: si mañana se renombra el insumo, el
    // registro sigue diciendo qué se contó ese día.
    const ids = itemsBody.map((i) => i.insumoId)
    const catalogo = (sector === "cocina"
      ? await sql`SELECT id, descripcion, unidad FROM insumos WHERE id = ANY(${ids})`
      : await sql`SELECT id, descripcion, unidad FROM insumos_barra WHERE id = ANY(${ids})`) as unknown as Array<{
      id: string
      descripcion: string
      unidad: string | null
    }>
    const porId = new Map(catalogo.map((c) => [c.id, c]))
    const faltante = ids.find((id) => !porId.has(id))
    if (faltante) {
      return NextResponse.json(
        { ok: false, error: `Hay un insumo que no es de ${sector} o ya no existe` },
        { status: 400 },
      )
    }

    // ── La puerta: por evento, o extraordinaria con PIN ───────────────────
    // Se recalcula acá, no se confía en lo que diga la pantalla: si el
    // endpoint aceptara una carga extraordinaria sin PIN, el candado no
    // existiría.
    const pendiente = await eventoPendienteEnBase(salon, sector)
    const motivo: "evento" | "extraordinaria" = pendiente ? "evento" : "extraordinaria"
    const eventoId: string | null = pendiente ? pendiente.evento.id : null
    if (!pendiente && !verifyPinStockExtra(pin)) {
      return NextResponse.json(
        {
          ok: false,
          // El motivo se dice sin revelar si el PIN estuvo cerca: o hay
          // evento, o hace falta el PIN.
          error: pin
            ? "El PIN de carga extraordinaria no es correcto."
            : "No hay ningún evento terminado pendiente de carga en este salón. Para cargar igual hace falta el PIN de carga extraordinaria.",
          necesitaPin: true,
        },
        { status: 403 },
      )
    }

    const ahora = new Date()
    const iniciadaRaw = typeof body.iniciadaEn === "string" ? new Date(body.iniciadaEn) : null
    // Solo se acepta un inicio razonable (últimas 24 h y no en el futuro).
    const iniciadaEn =
      iniciadaRaw && Number.isFinite(iniciadaRaw.getTime()) &&
      iniciadaRaw.getTime() <= ahora.getTime() && ahora.getTime() - iniciadaRaw.getTime() < 24 * 60 * 60 * 1000
        ? iniciadaRaw
        : ahora

    const salonNombre = salones.get(salon) || salon
    const encabezadoDetalle =
      motivo === "extraordinaria" ? "Carga extraordinaria de stock" : "Actualización de insumos"
    const detalle = `${encabezadoDetalle} · ${fechaHoraCortaArgentina(ahora)} · ${cargadoPor} · ${itemsBody.length} ${
      itemsBody.length === 1 ? "insumo actualizado" : "insumos actualizados"
    }`

    // ── Transacción: todo o nada ──────────────────────────────────────────
    const resultado = await sql.begin(async (trx) => {
      // Los tipos de postgres.js no marcan la transacción como invocable
      // (TS2349), aunque en ejecución funciona igual que sql.
      const tx = trx as unknown as typeof sql
      const creada = (await tx`
        INSERT INTO stock_sesiones (id, salon, sector, cargado_por, evento_id, motivo, iniciada_en, cerrada_en, cantidad_items)
        VALUES (${sesionId}, ${salon}, ${sector}, ${cargadoPor}, ${eventoId}, ${motivo}, ${iniciadaEn}, ${ahora}, ${itemsBody.length})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `) as unknown as Array<{ id: string }>
      // Ya estaba guardada (doble clic / reintento): no se aplica dos veces.
      if (!creada.length) return { duplicada: true }

      for (const it of itemsBody) {
        const cat = porId.get(it.insumoId)!
        const cantidad = Number(it.cantidad)
        const previo = (await tx`
          SELECT cantidad FROM stock_salones
          WHERE insumo_tipo = ${sector} AND insumo_id = ${it.insumoId} AND salon = ${salon}
          FOR UPDATE
        `) as unknown as Array<{ cantidad: string }>
        const anterior = previo.length ? Number(previo[0].cantidad) : null

        await tx`
          INSERT INTO stock_sesion_items (sesion_id, insumo_tipo, insumo_id, descripcion, unidad, cantidad_anterior, cantidad_nueva)
          VALUES (${sesionId}, ${sector}, ${it.insumoId}, ${cat.descripcion}, ${cat.unidad}, ${anterior}, ${cantidad})
        `
        await tx`
          INSERT INTO stock_salones (insumo_tipo, insumo_id, salon, cantidad, ultima_sesion_id, actualizado_por, actualizado_en)
          VALUES (${sector}, ${it.insumoId}, ${salon}, ${cantidad}, ${sesionId}, ${cargadoPor}, ${ahora})
          ON CONFLICT (insumo_tipo, insumo_id, salon) DO UPDATE SET
            cantidad = EXCLUDED.cantidad,
            ultima_sesion_id = EXCLUDED.ultima_sesion_id,
            actualizado_por = EXCLUDED.actualizado_por,
            actualizado_en = EXCLUDED.actualizado_en
        `
      }

      // ── El total pasa a ser la suma de todos los salones ───────────────
      // Solo los insumos de esta sesión: recalcular los 276 de una sería
      // gratuito y lento. Se suma sobre TODOS los salones, no solo el que
      // cargó, porque el total es la existencia completa.
      //
      // Un salón sin fila no aporta nada a la suma: "nadie contó acá" pesa
      // como 0. Es correcto desde la migración inicial, que le dio a cada
      // insumo su fila en Casona.
      for (const it of itemsBody) {
        const total = (await tx`
          SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock_salones
          WHERE insumo_tipo = ${sector} AND insumo_id = ${it.insumoId}
        `) as unknown as Array<{ total: string }>
        const suma = Number(total[0]?.total ?? 0)
        if (sector === "cocina") {
          await tx`UPDATE insumos SET stock_actual = ${suma}, updated_at = NOW() WHERE id = ${it.insumoId}`
        } else {
          await tx`UPDATE insumos_barra SET stock_actual = ${suma}, updated_at = NOW() WHERE id = ${it.insumoId}`
        }
      }

      // Un solo renglón por sesión en Configuración → Actividad. El nombre
      // de quien cargó va explícito en el detalle (Cocina/Barra no tienen la
      // cookie lj_usuario que usa logActivity).
      await tx`
        INSERT INTO activity_log (id, tipo, accion, nombre, detalle)
        VALUES (${sesionId}::uuid, 'stock_sesion', 'modificado', ${`${salonNombre} — ${sector}`}, ${detalle})
      `
      return { duplicada: false }
    })

    return NextResponse.json({ ok: true, sesionId, motivo, duplicada: resultado.duplicada, cantidadItems: itemsBody.length })
  } catch (err) {
    console.error("[API] Error en stock-salones/sesiones POST:", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar la carga. No se guardó nada: volvé a intentar." }, { status: 500 })
  }
}
