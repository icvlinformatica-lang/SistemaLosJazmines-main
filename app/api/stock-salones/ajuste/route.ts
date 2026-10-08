export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados, fechaHoraCortaArgentina } from "@/lib/stock-salones-server"
import { puedeVerConsolidado } from "@/lib/stock-salones"
import { validarAjusteAlmacen } from "@/lib/stock-ajuste-almacen"

/**
 * POST — ajusta el stock de UN insumo en uno o más salones, desde el
 * lapicito de Almacén (cocina) o Almacén de Barra.
 *
 * body: {
 *   sector: "cocina" | "barra"
 *   insumoId: string
 *   items: { salon: string, cantidad: number, sesionId: string (uuid) }[]
 * }
 *
 * Solo Administración y Soporte (los mismos que ven las columnas por salón).
 * No pide el PIN de carga extraordinaria: quien entra con esos perfiles es
 * quien administra el stock, y queda registrado igual.
 *
 * Reusa el camino de la pantalla de Stock (app/api/stock-salones/sesiones)
 * para que todo lo que ya lee esas tablas siga andando igual:
 *   - una sesión por salón en stock_sesiones (motivo 'extraordinaria', un
 *     solo insumo) con su detalle en stock_sesion_items (antes → ahora);
 *   - la cantidad nueva en stock_salones;
 *   - un renglón en Actividad con el mismo id que la sesión;
 *   - el Stock total del insumo (stock_actual) pasa a ser la suma de todos
 *     los salones, igual que al cargar un conteo.
 * Todo en una sola transacción: o se guarda completo o no se guarda nada.
 *
 * Idempotente: cada salón trae su sesionId. Si llega dos veces (reintento de
 * fetchWithRetry, doble clic) esa sesión ya existe y no se aplica de nuevo.
 *
 * OJO: igual que una carga desde Stock, mover estos números mueve el costo
 * estimado de compras de los eventos (que mira lo que hay en su salón) y la
 * valorización del inventario en Caja Eventos.
 */
export async function POST(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeVerConsolidado(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede ajustar el stock por salón" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const salones = await salonesConfigurados()
    const v = validarAjusteAlmacen(body, new Set(salones.keys()))
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
    const { sector, insumoId, items } = v

    const catalogo = (sector === "cocina"
      ? await sql`SELECT id, descripcion, unidad FROM insumos WHERE id = ${insumoId}`
      : await sql`SELECT id, descripcion, unidad FROM insumos_barra WHERE id = ${insumoId}`) as unknown as Array<{
      id: string
      descripcion: string
      unidad: string | null
    }>
    const insumo = catalogo[0]
    if (!insumo) {
      return NextResponse.json({ ok: false, error: `El insumo no es de ${sector} o ya no existe` }, { status: 400 })
    }

    // Quién: el nombre con el que entró Administración (cookie lj_usuario,
    // la misma que usa logActivity). Si no está, el perfil.
    const cookieUsuario = (req.headers.get("cookie") || "")
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("lj_usuario="))
    let usuario = ""
    try {
      usuario = cookieUsuario ? decodeURIComponent(cookieUsuario.slice("lj_usuario=".length)).trim() : ""
    } catch {
      usuario = ""
    }
    const cargadoPor = (usuario || (perfil === "soporte" ? "Soporte" : "Administración")).slice(0, 60)
    const ahora = new Date()

    const resultado = await sql.begin(async (trx) => {
      // Los tipos de postgres.js no marcan la transacción como invocable
      // (TS2349), aunque en ejecución funciona igual que sql.
      const tx = trx as unknown as typeof sql
      let aplicados = 0
      for (const it of items) {
        const creada = (await tx`
          INSERT INTO stock_sesiones (id, salon, sector, cargado_por, evento_id, motivo, iniciada_en, cerrada_en, cantidad_items)
          VALUES (${it.sesionId}, ${it.salon}, ${sector}, ${cargadoPor}, ${null}, 'extraordinaria', ${ahora}, ${ahora}, 1)
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `) as unknown as Array<{ id: string }>
        // Ya estaba guardada (reintento): no se aplica dos veces.
        if (!creada.length) continue
        aplicados++

        const previo = (await tx`
          SELECT cantidad FROM stock_salones
          WHERE insumo_tipo = ${sector} AND insumo_id = ${insumoId} AND salon = ${it.salon}
          FOR UPDATE
        `) as unknown as Array<{ cantidad: string }>
        const anterior = previo.length ? Number(previo[0].cantidad) : null

        await tx`
          INSERT INTO stock_sesion_items (sesion_id, insumo_tipo, insumo_id, descripcion, unidad, cantidad_anterior, cantidad_nueva)
          VALUES (${it.sesionId}, ${sector}, ${insumoId}, ${insumo.descripcion}, ${insumo.unidad}, ${anterior}, ${it.cantidad})
        `
        await tx`
          INSERT INTO stock_salones (insumo_tipo, insumo_id, salon, cantidad, ultima_sesion_id, actualizado_por, actualizado_en)
          VALUES (${sector}, ${insumoId}, ${it.salon}, ${it.cantidad}, ${it.sesionId}, ${cargadoPor}, ${ahora})
          ON CONFLICT (insumo_tipo, insumo_id, salon) DO UPDATE SET
            cantidad = EXCLUDED.cantidad,
            ultima_sesion_id = EXCLUDED.ultima_sesion_id,
            actualizado_por = EXCLUDED.actualizado_por,
            actualizado_en = EXCLUDED.actualizado_en
        `

        const salonNombre = salones.get(it.salon) || it.salon
        const detalle = `Ajuste desde Almacén · ${fechaHoraCortaArgentina(ahora)} · ${cargadoPor} · ${insumo.descripcion}: ${
          anterior === null ? "sin contar" : anterior
        } → ${it.cantidad}`
        await tx`
          INSERT INTO activity_log (id, tipo, accion, nombre, detalle)
          VALUES (${it.sesionId}::uuid, 'stock_sesion', 'modificado', ${`${salonNombre} — ${sector}`}, ${detalle})
        `
      }

      // El total pasa a ser la suma de todos los salones (un salón sin fila
      // suma 0), como en una carga desde Stock. Se recalcula aunque sea un
      // reintento, así la respuesta trae siempre el total vigente.
      const total = (await tx`
        SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock_salones
        WHERE insumo_tipo = ${sector} AND insumo_id = ${insumoId}
      `) as unknown as Array<{ total: string }>
      const suma = Number(total[0]?.total ?? 0)
      if (aplicados > 0) {
        if (sector === "cocina") {
          await tx`UPDATE insumos SET stock_actual = ${suma}, updated_at = NOW() WHERE id = ${insumoId}`
        } else {
          await tx`UPDATE insumos_barra SET stock_actual = ${suma}, updated_at = NOW() WHERE id = ${insumoId}`
        }
      }
      return { aplicados, total: suma }
    })

    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    console.error("[API] Error en stock-salones/ajuste POST:", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar el stock. No se guardó nada: volvé a intentar." }, { status: 500 })
  }
}
