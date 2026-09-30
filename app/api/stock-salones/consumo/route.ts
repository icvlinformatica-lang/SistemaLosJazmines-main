export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados, fechaHoraCortaArgentina } from "@/lib/stock-salones-server"
import { puedeVerConsolidado } from "@/lib/stock-salones"

/**
 * POST — lo que un evento consume (o devuelve) sale del SALÓN donde se hace.
 *
 * body: {
 *   salon: string
 *   eventoId?: string | null
 *   motivo: "impresion" | "cierre" | "devolucion"
 *   nombreEvento?: string (para el renglón de Actividad)
 *   items: { insumoId, sector: "cocina"|"barra", delta: number }[]
 *     delta < 0 descuenta (se usó), delta > 0 devuelve (se recupera).
 * }
 *
 * Antes esto se hacía con PATCH /api/insumos/:id sobre el stock global, que
 * mezcla los cinco salones: un evento en Quinta descontaba mercadería de
 * Casona. Ahora se toca la fila de ESE salón en stock_salones y el total se
 * recalcula como suma, igual que cuando un salón carga su conteo — así el
 * total y la suma de los salones no se separan nunca.
 *
 * REGLA IMPORTANTE: si en ese salón nadie contó ese insumo, NO se descuenta
 * nada. No se puede restar de un número que no existe; inventar la fila sería
 * inventar un conteo que nadie hizo. Se devuelve cuántos quedaron afuera para
 * que la pantalla lo pueda avisar.
 *
 * Todo en una transacción: o se aplica entero o no se aplica nada.
 */

const MAX_ITEMS = 1000

interface ItemBody {
  insumoId: string
  sector: "cocina" | "barra"
  delta: number
}

export async function POST(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeVerConsolidado(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede mover stock de un evento" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const salon = typeof body.salon === "string" ? body.salon : ""
    const motivo = body.motivo
    const eventoId = typeof body.eventoId === "string" && body.eventoId ? body.eventoId : null
    const nombreEvento = typeof body.nombreEvento === "string" ? body.nombreEvento.slice(0, 120) : ""
    const items: ItemBody[] = Array.isArray(body.items) ? body.items : []

    if (!["impresion", "cierre", "devolucion"].includes(motivo)) {
      return NextResponse.json({ ok: false, error: "Motivo inválido" }, { status: 400 })
    }
    const salones = await salonesConfigurados()
    if (!salones.has(salon)) {
      return NextResponse.json({ ok: false, error: "Salón inválido" }, { status: 400 })
    }
    if (items.length === 0) {
      return NextResponse.json({ ok: true, aplicados: 0, sinConteo: 0, saltados: [] })
    }
    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ ok: false, error: "Demasiados insumos" }, { status: 400 })
    }
    for (const it of items) {
      if (typeof it?.insumoId !== "string" || !it.insumoId) {
        return NextResponse.json({ ok: false, error: "Hay un insumo inválido" }, { status: 400 })
      }
      if (it.sector !== "cocina" && it.sector !== "barra") {
        return NextResponse.json({ ok: false, error: "Hay un sector inválido" }, { status: 400 })
      }
      if (!Number.isFinite(Number(it.delta))) {
        return NextResponse.json({ ok: false, error: "Hay una cantidad inválida" }, { status: 400 })
      }
    }

    const resultado = await sql.begin(async (trx) => {
      // Los tipos de postgres.js no marcan la transacción como invocable
      // (TS2349), aunque en ejecución funciona igual que sql.
      const tx = trx as unknown as typeof sql
      const saltados: string[] = []
      let aplicados = 0

      for (const it of items) {
        const delta = Number(it.delta)
        if (delta === 0) continue

        const fila = (await tx`
          SELECT cantidad FROM stock_salones
          WHERE insumo_tipo = ${it.sector} AND insumo_id = ${it.insumoId} AND salon = ${salon}
          FOR UPDATE
        `) as unknown as Array<{ cantidad: string }>

        // Nadie contó este insumo en este salón: no hay de dónde descontar.
        if (!fila.length) {
          saltados.push(it.insumoId)
          continue
        }

        const nueva = Math.max(0, Number(fila[0].cantidad) + delta)
        await tx`
          UPDATE stock_salones SET cantidad = ${nueva}, actualizado_en = NOW()
          WHERE insumo_tipo = ${it.sector} AND insumo_id = ${it.insumoId} AND salon = ${salon}
        `

        // El total vuelve a ser la suma de todos los salones.
        const total = (await tx`
          SELECT COALESCE(SUM(cantidad), 0) AS total FROM stock_salones
          WHERE insumo_tipo = ${it.sector} AND insumo_id = ${it.insumoId}
        `) as unknown as Array<{ total: string }>
        const suma = Number(total[0]?.total ?? 0)
        if (it.sector === "cocina") {
          await tx`UPDATE insumos SET stock_actual = ${suma}, updated_at = NOW() WHERE id = ${it.insumoId}`
        } else {
          await tx`UPDATE insumos_barra SET stock_actual = ${suma}, updated_at = NOW() WHERE id = ${it.insumoId}`
        }
        aplicados++
      }

      if (aplicados > 0 || saltados.length > 0) {
        const queHizo =
          motivo === "devolucion" ? "Stock devuelto" : motivo === "cierre" ? "Stock descontado al cerrar" : "Stock descontado al imprimir"
        const detalle =
          `${queHizo} en ${salones.get(salon) || salon} · ${fechaHoraCortaArgentina(new Date())} · ` +
          `${aplicados} ${aplicados === 1 ? "insumo" : "insumos"}` +
          (saltados.length > 0 ? ` · ${saltados.length} sin conteo en ese salón, no se tocaron` : "")
        await tx`
          INSERT INTO activity_log (tipo, accion, nombre, detalle)
          VALUES ('evento', 'modificado', ${nombreEvento || "Evento"}, ${detalle})
        `
      }

      return { aplicados, saltados }
    })

    return NextResponse.json({
      ok: true,
      aplicados: resultado.aplicados,
      sinConteo: resultado.saltados.length,
      saltados: resultado.saltados,
      eventoId,
    })
  } catch (err) {
    console.error("[API] Error en stock-salones/consumo:", err)
    return NextResponse.json(
      { ok: false, error: "No se pudo mover el stock. No se aplicó nada: volvé a intentar." },
      { status: 500 },
    )
  }
}
