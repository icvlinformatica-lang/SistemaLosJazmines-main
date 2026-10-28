export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { perfilDesdeRequest, salonesConfigurados, fechaHoraCortaArgentina } from "@/lib/stock-salones-server"
import { puedeEditarCatalogoLimpieza } from "@/lib/stock-salones"
import { AVISO_SIN_TABLA, faltaTabla, precioPorUnidadCompra, validarCompraLimpieza } from "@/lib/insumos-limpieza"

/**
 * POST — suma al stock de un salón lo que se compró de un artículo de
 * limpieza, desde "Cargar gastos" (Caja Jazmines). Pedido de Rodrigo,
 * 21/10/2026.
 *
 * body: { id (uuid), insumoId, salon, cantidad, monto }
 *
 * El gasto en sí NO se escribe acá: lo agenda la pantalla en
 * costos_operativos por el camino de siempre (addCostoOperativo del store),
 * después de que esta ruta responda bien. Acá, en una sola transacción:
 *   - una sesión de stock (motivo 'extraordinaria', un solo artículo) con su
 *     detalle antes → ahora, para que figure en el historial de /stock;
 *   - stock_salones += cantidad en ese salón (si nadie había contado ahí,
 *     arranca de 0; la suma la hace la base);
 *   - el precio del artículo pasa a ser el de esta compra (monto / cantidad);
 *   - un renglón en Actividad con el mismo id que la sesión.
 *
 * Idempotente: el id de la operación es el de la sesión. Si llega dos veces
 * (reintento de fetchWithRetry, doble clic), no se suma de nuevo.
 *
 * Solo Administración y Soporte (puedeEditarCatalogoLimpieza): cambia el
 * precio del artículo y es parte de un gasto de caja.
 */
export async function POST(req: Request) {
  try {
    const perfil = await perfilDesdeRequest(req)
    if (!puedeEditarCatalogoLimpieza(perfil)) {
      return NextResponse.json({ ok: false, error: "Este perfil no puede cargar compras de limpieza" }, { status: 403 })
    }
    const salones = await salonesConfigurados()
    const v = validarCompraLimpieza(await req.json().catch(() => ({})), new Set(salones.keys()))
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 })
    const c = v.compra

    // Quién: el nombre con el que entró (cookie lj_usuario, la misma que usa
    // logActivity). Si no está, el perfil.
    const cookieUsuario = (req.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("lj_usuario="))
    let usuario = ""
    try {
      usuario = cookieUsuario ? decodeURIComponent(cookieUsuario.slice("lj_usuario=".length)).trim() : ""
    } catch {
      usuario = ""
    }
    const cargadoPor = (usuario || (perfil === "soporte" ? "Soporte" : "Administración")).slice(0, 60)
    const ahora = new Date()
    const precioUnitario = precioPorUnidadCompra(c.monto, c.cantidad)

    const resultado = await sql.begin(async (trx) => {
      // Los tipos de postgres.js no marcan la transacción como invocable
      // (TS2349), aunque en ejecución funciona igual que sql.
      const tx = trx as unknown as typeof sql
      const articulo = (await tx`
        SELECT id, descripcion, unidad FROM insumos_limpieza WHERE id = ${c.insumoId} FOR UPDATE
      `) as unknown as Array<{ id: string; descripcion: string; unidad: string | null }>
      if (!articulo.length) return { error: "El artículo ya no existe" as const }
      const a = articulo[0]

      const creada = (await tx`
        INSERT INTO stock_sesiones (id, salon, sector, cargado_por, evento_id, motivo, iniciada_en, cerrada_en, cantidad_items)
        VALUES (${c.id}, ${c.salon}, 'limpieza', ${cargadoPor}, ${null}, 'extraordinaria', ${ahora}, ${ahora}, 1)
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `) as unknown as Array<{ id: string }>
      // Ya estaba guardada (reintento): no se suma dos veces.
      if (!creada.length) return { duplicada: true as const }

      const previo = (await tx`
        SELECT cantidad FROM stock_salones
        WHERE insumo_tipo = 'limpieza' AND insumo_id = ${c.insumoId} AND salon = ${c.salon}
        FOR UPDATE
      `) as unknown as Array<{ cantidad: string }>
      const anterior = previo.length ? Number(previo[0].cantidad) : null
      // La suma la hace la base (cantidad + lo comprado): si dos compras del
      // mismo salón llegan juntas y todavía no había fila, ninguna pisa a la otra.
      const sumada = (await tx`
        INSERT INTO stock_salones (insumo_tipo, insumo_id, salon, cantidad, ultima_sesion_id, actualizado_por, actualizado_en)
        VALUES ('limpieza', ${c.insumoId}, ${c.salon}, ${c.cantidad}, ${c.id}, ${cargadoPor}, ${ahora})
        ON CONFLICT (insumo_tipo, insumo_id, salon) DO UPDATE SET
          cantidad = stock_salones.cantidad + EXCLUDED.cantidad,
          ultima_sesion_id = EXCLUDED.ultima_sesion_id,
          actualizado_por = EXCLUDED.actualizado_por,
          actualizado_en = EXCLUDED.actualizado_en
        RETURNING cantidad
      `) as unknown as Array<{ cantidad: string }>
      const nueva = Number(sumada[0]?.cantidad ?? c.cantidad)

      await tx`
        INSERT INTO stock_sesion_items (sesion_id, insumo_tipo, insumo_id, descripcion, unidad, cantidad_anterior, cantidad_nueva)
        VALUES (${c.id}, 'limpieza', ${c.insumoId}, ${a.descripcion}, ${a.unidad}, ${anterior}, ${nueva})
      `
      await tx`
        UPDATE insumos_limpieza SET precio_unitario = ${precioUnitario}, updated_at = NOW() WHERE id = ${c.insumoId}
      `

      const salonNombre = salones.get(c.salon) || c.salon
      const unidad = a.unidad || "UN"
      const detalle = `Compra cargada en Caja Jazmines · ${fechaHoraCortaArgentina(ahora)} · ${cargadoPor} · ${a.descripcion}: ${
        anterior === null ? "sin contar" : anterior
      } → ${nueva} (+${c.cantidad} ${unidad}) · $${c.monto} ($${precioUnitario} por ${unidad})`
      await tx`
        INSERT INTO activity_log (id, tipo, accion, nombre, detalle)
        VALUES (${c.id}::uuid, 'stock_sesion', 'modificado', ${`${salonNombre} — limpieza`}, ${detalle})
      `
      return { anterior, nueva }
    })

    if ("error" in resultado) return NextResponse.json({ ok: false, error: resultado.error }, { status: 404 })
    return NextResponse.json({ ok: true, precioUnitario, ...resultado })
  } catch (err) {
    if (faltaTabla(err)) return NextResponse.json({ ok: false, error: AVISO_SIN_TABLA }, { status: 503 })
    console.error("[API] Error en insumos-limpieza/compra POST:", err)
    return NextResponse.json(
      { ok: false, error: "No se pudo sumar la compra al stock. No se guardó nada: volvé a intentar." },
      { status: 500 },
    )
  }
}
