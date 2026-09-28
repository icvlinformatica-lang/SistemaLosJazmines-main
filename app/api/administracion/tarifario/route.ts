export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Tarifario del cotizador: la grilla de precio del salón, la regla de
 * personal por invitados y los vínculos de cada servicio de Menú/Barra.
 * Se edita desde Eventos > Cotizaciones, al lado del precio base por salón.
 *
 * Acá viven SOLO las cosas que no son servicios. El precio de todo lo que se
 * cotiza como servicio (menús, barras, pantalla, vestido…) sale de la tabla
 * "servicios" y se edita en Finanzas > Servicios — nunca se duplica acá.
 *
 * El POST reemplaza la grilla entera y las reglas enteras dentro de una
 * transacción: así no queda a medio guardar si algo falla, y borrar una fila
 * en la pantalla efectivamente la borra.
 */

interface FilaGrilla {
  salon: string
  invitadosMin: number
  invitadosMax: number
  dia: "viernes" | "sabado"
  modalidad: "solo_salon" | "con_catering"
  precio: number
}

export async function GET() {
  try {
    const [grilla, reglas, vinculosRecetas, vinculosBarra, incluyeServicio, incluyePersonal] = await Promise.all([
      sql`
        SELECT salon, invitados_min, invitados_max, dia, modalidad, precio
        FROM tarifario_salon
        ORDER BY salon ASC, modalidad ASC, dia ASC, invitados_min ASC
      `,
      sql`
        SELECT funcion, cada_n_invitados, minimo, activo
        FROM tarifario_personal_regla
        ORDER BY funcion ASC
      `,
      sql`SELECT servicio_id, receta_id FROM servicio_recetas`,
      sql`SELECT servicio_id, barra_template_id FROM servicio_barra_template`,
      sql`SELECT servicio_id FROM salon_incluye_servicio`,
      sql`SELECT personal_id, dia FROM salon_incluye_personal`,
    ])

    return NextResponse.json({
      ok: true,
      grilla: (grilla as unknown as Array<Record<string, unknown>>).map((f) => ({
        salon: f.salon,
        invitadosMin: Number(f.invitados_min) || 0,
        invitadosMax: Number(f.invitados_max) || 0,
        dia: f.dia,
        modalidad: f.modalidad,
        precio: Number(f.precio) || 0,
      })),
      reglasPersonal: (reglas as unknown as Array<Record<string, unknown>>).map((r) => ({
        funcion: r.funcion,
        cadaNInvitados: Number(r.cada_n_invitados) || 0,
        minimo: Number(r.minimo) || 0,
        activo: !!r.activo,
      })),
      recetasPorServicio: (vinculosRecetas as unknown as Array<Record<string, string>>).reduce(
        (acc: Record<string, string[]>, v) => {
          ;(acc[v.servicio_id] = acc[v.servicio_id] || []).push(v.receta_id)
          return acc
        },
        {},
      ),
      barraTemplatePorServicio: (vinculosBarra as unknown as Array<Record<string, string>>).reduce(
        (acc: Record<string, string>, v) => {
          acc[v.servicio_id] = v.barra_template_id
          return acc
        },
        {},
      ),
      serviciosIncluidosSalon: (incluyeServicio as unknown as Array<{ servicio_id: string }>).map((r) => r.servicio_id),
      personalIncluidoSalon: (incluyePersonal as unknown as Array<{ personal_id: string; dia: string }>).map((r) => ({
        personalId: r.personal_id,
        dia: r.dia,
      })),
    })
  } catch (err) {
    console.error("[API] Error en administracion/tarifario GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const grilla: FilaGrilla[] = Array.isArray(body?.grilla) ? body.grilla : []
    const reglas: Array<{ funcion: string; cadaNInvitados: number; minimo: number; activo: boolean }> =
      Array.isArray(body?.reglasPersonal) ? body.reglasPersonal : []
    const recetasPorServicio: Record<string, string[]> =
      body?.recetasPorServicio && typeof body.recetasPorServicio === "object" ? body.recetasPorServicio : {}
    const serviciosIncluidosSalon: string[] = Array.isArray(body?.serviciosIncluidosSalon)
      ? body.serviciosIncluidosSalon.filter((x: unknown) => typeof x === "string")
      : []
    const personalIncluidoSalon: Array<{ personalId: string; dia: string }> = Array.isArray(body?.personalIncluidoSalon)
      ? body.personalIncluidoSalon.filter(
          (p: { personalId?: unknown; dia?: unknown }) =>
            typeof p?.personalId === "string" && (p.dia === "viernes" || p.dia === "sabado"),
        )
      : []
    const barraTemplatePorServicio: Record<string, string> =
      body?.barraTemplatePorServicio && typeof body.barraTemplatePorServicio === "object"
        ? body.barraTemplatePorServicio
        : {}

    // Validación: un rango dado vuelta o un precio negativo es un error de
    // carga que después sale como precio raro en una cotización.
    for (const f of grilla) {
      if (!f.salon) {
        return NextResponse.json({ ok: false, error: "Hay una fila sin salón." }, { status: 400 })
      }
      const min = Number(f.invitadosMin) || 0
      const max = Number(f.invitadosMax) || 0
      if (min < 0 || max < min) {
        return NextResponse.json(
          { ok: false, error: `Rango de invitados inválido en ${f.salon}: ${min}-${max}.` },
          { status: 400 },
        )
      }
      if ((Number(f.precio) || 0) < 0) {
        return NextResponse.json({ ok: false, error: `Precio negativo en ${f.salon}.` }, { status: 400 })
      }
      if (f.dia !== "viernes" && f.dia !== "sabado") {
        return NextResponse.json({ ok: false, error: `Día inválido en ${f.salon}.` }, { status: 400 })
      }
      if (f.modalidad !== "solo_salon" && f.modalidad !== "con_catering") {
        return NextResponse.json({ ok: false, error: `Modalidad inválida en ${f.salon}.` }, { status: 400 })
      }
    }

    // Rangos superpuestos para el mismo salón/día/modalidad: el cotizador
    // tomaría el primero que encuentre y el precio dependería del orden.
    const porClave = new Map<string, FilaGrilla[]>()
    for (const f of grilla) {
      const clave = `${f.salon}|${f.dia}|${f.modalidad}`
      porClave.set(clave, [...(porClave.get(clave) || []), f])
    }
    for (const [clave, filas] of porClave) {
      const ordenadas = [...filas].sort((a, b) => a.invitadosMin - b.invitadosMin)
      for (let i = 1; i < ordenadas.length; i++) {
        if (ordenadas[i].invitadosMin <= ordenadas[i - 1].invitadosMax) {
          const [salon] = clave.split("|")
          return NextResponse.json(
            {
              ok: false,
              error: `En ${salon} se superponen los rangos ${ordenadas[i - 1].invitadosMin}-${ordenadas[i - 1].invitadosMax} y ${ordenadas[i].invitadosMin}-${ordenadas[i].invitadosMax}.`,
            },
            { status: 400 },
          )
        }
      }
    }

    for (const r of reglas) {
      if (!r.funcion) {
        return NextResponse.json({ ok: false, error: "Hay una regla sin función." }, { status: 400 })
      }
      if ((Number(r.cadaNInvitados) || 0) < 0 || (Number(r.minimo) || 0) < 0) {
        return NextResponse.json(
          { ok: false, error: `Valores negativos en la regla de ${r.funcion}.` },
          { status: 400 },
        )
      }
    }

    await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql

      await db`DELETE FROM tarifario_salon`
      for (const f of grilla) {
        await db`
          INSERT INTO tarifario_salon (salon, invitados_min, invitados_max, dia, modalidad, precio)
          VALUES (${f.salon}, ${Number(f.invitadosMin) || 0}, ${Number(f.invitadosMax) || 0},
                  ${f.dia}, ${f.modalidad}, ${Number(f.precio) || 0})
        `
      }

      await db`DELETE FROM tarifario_personal_regla`
      for (const r of reglas) {
        await db`
          INSERT INTO tarifario_personal_regla (funcion, cada_n_invitados, minimo, activo)
          VALUES (${r.funcion}, ${Number(r.cadaNInvitados) || 0}, ${Number(r.minimo) || 0}, ${r.activo !== false})
        `
      }

      await db`DELETE FROM servicio_recetas`
      for (const [servicioId, recetas] of Object.entries(recetasPorServicio)) {
        for (const recetaId of Array.isArray(recetas) ? recetas : []) {
          await db`
            INSERT INTO servicio_recetas (servicio_id, receta_id)
            VALUES (${servicioId}, ${recetaId})
            ON CONFLICT DO NOTHING
          `
        }
      }

      await db`DELETE FROM salon_incluye_servicio`
      for (const servicioId of serviciosIncluidosSalon) {
        await db`INSERT INTO salon_incluye_servicio (servicio_id) VALUES (${servicioId}) ON CONFLICT DO NOTHING`
      }

      await db`DELETE FROM salon_incluye_personal`
      for (const p of personalIncluidoSalon) {
        await db`
          INSERT INTO salon_incluye_personal (personal_id, dia)
          VALUES (${p.personalId}, ${p.dia})
          ON CONFLICT DO NOTHING
        `
      }

      await db`DELETE FROM servicio_barra_template`
      for (const [servicioId, templateId] of Object.entries(barraTemplatePorServicio)) {
        if (!templateId) continue
        await db`
          INSERT INTO servicio_barra_template (servicio_id, barra_template_id)
          VALUES (${servicioId}, ${templateId})
          ON CONFLICT DO NOTHING
        `
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[API] Error en administracion/tarifario POST:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
