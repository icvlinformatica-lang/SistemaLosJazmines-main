export const dynamic = 'force-dynamic'
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: Record<string, any>) {
  return {
    id: r.id,
    nombre: r.nombre,
    fecha: r.fecha,
    horario: r.horario,
    horarioFin: r.horario_fin,
    salon: r.salon,
    tipoEvento: r.tipo_evento,
    nombrePareja: r.nombre_pareja,
    dniNovio1: r.dni_novio1,
    dniNovio2: r.dni_novio2,
    adultos: r.adultos ?? 0,
    adolescentes: r.adolescentes ?? 0,
    ninos: r.ninos ?? 0,
    personasDietasEspeciales: r.personas_dietas_especiales ?? 0,
    recetasAdultos: r.recetas_adultos ?? [],
    recetasAdolescentes: r.recetas_adolescentes ?? [],
    recetasNinos: r.recetas_ninos ?? [],
    recetasDietasEspeciales: r.recetas_dietas_especiales ?? [],
    multipliersAdultos: r.multipliers_adultos ?? {},
    multipliersAdolescentes: r.multipliers_adolescentes ?? {},
    multipliersNinos: r.multipliers_ninos ?? {},
    multipliersDietasEspeciales: r.multipliers_dietas_especiales ?? {},
    descripcionPersonalizada: r.descripcion_personalizada ?? "",
    barras: r.barras ?? [],
    servicios: r.servicios ?? [],
    paquetesSeleccionados: r.paquetes_seleccionados ?? [],
    condicionIva: r.condicion_iva,
    contrato: r.contrato,
    planDeCuotas: r.plan_de_cuotas,
    estado: r.estado ?? "pendiente",
    colorTag: r.color_tag,
    precioVenta: r.precio_venta != null ? Number(r.precio_venta) : undefined,
    costoPersonal: r.costo_personal != null ? Number(r.costo_personal) : undefined,
    costoInsumos: r.costo_insumos != null ? Number(r.costo_insumos) : undefined,
    costoServicios: r.costo_servicios != null ? Number(r.costo_servicios) : undefined,
    costoOperativo: r.costo_operativo != null ? Number(r.costo_operativo) : undefined,
    notasInternas: r.notas_internas,
    pagos: r.pagos ?? [],
    asignaciones: r.asignaciones ?? [],
    costosCalculados: r.costos_calculados,
    stockDescontado: r.stock_descontado ?? false,
    fechaImpresion: r.fecha_impresion,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const SELECT_COLS = `
  id, nombre, fecha, horario, horario_fin, salon, tipo_evento, nombre_pareja,
  dni_novio1, dni_novio2, adultos, adolescentes, ninos, personas_dietas_especiales,
  recetas_adultos, recetas_adolescentes, recetas_ninos, recetas_dietas_especiales,
  multipliers_adultos, multipliers_adolescentes, multipliers_ninos, multipliers_dietas_especiales,
  descripcion_personalizada, barras, servicios, paquetes_seleccionados,
  condicion_iva, contrato, plan_de_cuotas, estado, color_tag,
  precio_venta, costo_personal, costo_insumos, costo_servicios, costo_operativo,
  notas_internas, pagos, asignaciones, costos_calculados,
  stock_descontado, fecha_impresion, created_at, updated_at, deleted_at
`

async function fetchEvento(id: string) {
  const rows = await sql`
    SELECT ${sql.unsafe(SELECT_COLS)} FROM eventos WHERE id = ${id} AND deleted_at IS NULL
  `
  return rows[0] ?? null
}

// GET single evento
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const row = await fetchEvento(id)
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(fromRow(row))
  } catch (err) {
    console.error("[API] Error fetching evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH — partial update
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const updates = await req.json()

    const fieldMap: Record<string, string> = {
      nombre: "nombre", fecha: "fecha", horario: "horario", horarioFin: "horario_fin",
      salon: "salon", tipoEvento: "tipo_evento", nombrePareja: "nombre_pareja",
      dniNovio1: "dni_novio1", dniNovio2: "dni_novio2",
      adultos: "adultos", adolescentes: "adolescentes", ninos: "ninos",
      personasDietasEspeciales: "personas_dietas_especiales",
      recetasAdultos: "recetas_adultos", recetasAdolescentes: "recetas_adolescentes",
      recetasNinos: "recetas_ninos", recetasDietasEspeciales: "recetas_dietas_especiales",
      multipliersAdultos: "multipliers_adultos", multipliersAdolescentes: "multipliers_adolescentes",
      multipliersNinos: "multipliers_ninos", multipliersDietasEspeciales: "multipliers_dietas_especiales",
      descripcionPersonalizada: "descripcion_personalizada",
      barras: "barras", servicios: "servicios", paquetesSeleccionados: "paquetes_seleccionados",
      condicionIva: "condicion_iva", contrato: "contrato", planDeCuotas: "plan_de_cuotas",
      estado: "estado", colorTag: "color_tag",
      precioVenta: "precio_venta", costoPersonal: "costo_personal",
      costoInsumos: "costo_insumos", costoServicios: "costo_servicios", costoOperativo: "costo_operativo",
      notasInternas: "notas_internas", pagos: "pagos", asignaciones: "asignaciones",
      costosCalculados: "costos_calculados",
      stockDescontado: "stock_descontado", fechaImpresion: "fecha_impresion",
    }

    const jsonFields = new Set([
      "barras","servicios","contrato","planDeCuotas","pagos","asignaciones",
      "costosCalculados","multipliersAdultos","multipliersAdolescentes",
      "multipliersNinos","multipliersDietasEspeciales",
    ])

    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (!(camel in updates)) continue
      const val = updates[camel]
      setClauses.push(`${snake} = $${idx}`)
      values.push(jsonFields.has(camel) ? JSON.stringify(val) : val)
      idx++
    }

    if (setClauses.length === 0) {
      const row = await fetchEvento(id)
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json(fromRow(row))
    }

    setClauses.push(`updated_at = NOW()`)
    values.push(id)
    const setClausesStr = setClauses.join(", ")
    await sql.unsafe(
      `UPDATE eventos SET ${setClausesStr} WHERE id = $${idx}`,
      values as string[]
    )

    const updated = await fetchEvento(id)
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(fromRow(updated))
  } catch (err) {
    console.error("[API] Error patching evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT — full replace
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ev = await req.json()
    const nombre = ev.nombrePareja || ev.nombre || "Sin nombre"

    await sql.unsafe(
      `UPDATE eventos SET
        nombre=$1, fecha=$2, horario=$3, horario_fin=$4, salon=$5,
        tipo_evento=$6, nombre_pareja=$7, dni_novio1=$8, dni_novio2=$9,
        adultos=$10, adolescentes=$11, ninos=$12, personas_dietas_especiales=$13,
        recetas_adultos=$14, recetas_adolescentes=$15, recetas_ninos=$16, recetas_dietas_especiales=$17,
        multipliers_adultos=$18, multipliers_adolescentes=$19, multipliers_ninos=$20, multipliers_dietas_especiales=$21,
        descripcion_personalizada=$22, barras=$23, servicios=$24, paquetes_seleccionados=$25,
        condicion_iva=$26, contrato=$27, plan_de_cuotas=$28, estado=$29, color_tag=$30,
        precio_venta=$31, costo_personal=$32, costo_insumos=$33, costo_servicios=$34, costo_operativo=$35,
        notas_internas=$36, pagos=$37, asignaciones=$38, costos_calculados=$39,
        stock_descontado=$40, fecha_impresion=$41, updated_at=NOW()
      WHERE id=$42`,
      [
        nombre, ev.fecha||null, ev.horario||null, ev.horarioFin||null, ev.salon||null,
        ev.tipoEvento||null, ev.nombrePareja||null, ev.dniNovio1||null, ev.dniNovio2||null,
        ev.adultos||0, ev.adolescentes||0, ev.ninos||0, ev.personasDietasEspeciales||0,
        ev.recetasAdultos||[], ev.recetasAdolescentes||[], ev.recetasNinos||[], ev.recetasDietasEspeciales||[],
        JSON.stringify(ev.multipliersAdultos||{}), JSON.stringify(ev.multipliersAdolescentes||{}),
        JSON.stringify(ev.multipliersNinos||{}), JSON.stringify(ev.multipliersDietasEspeciales||{}),
        ev.descripcionPersonalizada||"", JSON.stringify(ev.barras||[]), JSON.stringify(ev.servicios||[]),
        ev.paquetesSeleccionados||[],
        ev.condicionIva||null, JSON.stringify(ev.contrato||null), JSON.stringify(ev.planDeCuotas||null),
        ev.estado||"pendiente", ev.colorTag||null,
        ev.precioVenta||null, ev.costoPersonal||null, ev.costoInsumos||null,
        ev.costoServicios||null, ev.costoOperativo||null,
        ev.notasInternas||null, JSON.stringify(ev.pagos||[]),
        JSON.stringify(ev.asignaciones||[]), JSON.stringify(ev.costosCalculados||null),
        ev.stockDescontado||false, ev.fechaImpresion||null,
        id,
      ]
    )

    const updated = await fetchEvento(id)
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await logActivity("evento", "modificado", nombre, `Estado: ${ev.estado}`)
    return NextResponse.json(fromRow(updated))
  } catch (err) {
    console.error("[API] Error updating evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE — soft delete
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await sql`SELECT ${sql.unsafe(SELECT_COLS)} FROM eventos WHERE id = ${id}`
    const row = rows[0]
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const eventoData = fromRow(row)

    try {
      await sql`
        INSERT INTO eventos_eliminados (id, nombre, fecha, estado, evento_json)
        VALUES (${row.id}, ${row.nombre}, ${row.fecha}, ${row.estado}, ${JSON.stringify(eventoData)})
        ON CONFLICT (id) DO UPDATE SET evento_json=EXCLUDED.evento_json, eliminado_at=NOW()
      `
    } catch {
      try {
        await sql`
          INSERT INTO eventos_eliminados (id, nombre, fecha, estado, data)
          VALUES (${row.id}, ${row.nombre}, ${row.fecha}, ${row.estado}, ${JSON.stringify(eventoData)})
          ON CONFLICT (id) DO UPDATE SET data=EXCLUDED.data, eliminado_at=NOW()
        `
      } catch (e2) {
        console.error("[API] No se pudo guardar en papelera:", e2)
      }
    }

    await sql`UPDATE eventos SET deleted_at=NOW() WHERE id=${id}`
    await logActivity("evento", "eliminado", row.nombre || "Sin nombre")
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
