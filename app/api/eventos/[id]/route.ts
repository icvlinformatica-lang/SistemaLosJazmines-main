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

// GET single evento
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [row] = await sql`SELECT * FROM eventos WHERE id = ${id} AND deleted_at IS NULL`
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(fromRow(row))
  } catch (err) {
    console.error("[API] Error fetching evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH — partial update (preferred) 
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const updates = await req.json()

    // Build dynamic SET clause from camelCase → snake_case mapping
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

    // Apply only the fields present in updates
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (!(camel in updates)) continue
      const val = updates[camel]
      const jsonFields = ["barras","servicios","contrato","planDeCuotas","pagos","asignaciones","costosCalculados","multipliersAdultos","multipliersAdolescentes","multipliersNinos","multipliersDietasEspeciales"]
      const serialized = jsonFields.includes(camel) ? JSON.stringify(val) : val
      await sql`UPDATE eventos SET ${sql(snake)} = ${serialized}, updated_at = NOW() WHERE id = ${id}`
    }

    const [updated] = await sql`SELECT * FROM eventos WHERE id = ${id}`
    return NextResponse.json(fromRow(updated))
  } catch (err) {
    console.error("[API] Error patching evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT — full replace (for backwards compatibility)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const ev = { ...body, id }
    const nombre = ev.nombrePareja || ev.nombre || "Sin nombre"

    await sql`
      UPDATE eventos SET
        nombre = ${nombre},
        fecha = ${ev.fecha || null},
        horario = ${ev.horario || null},
        horario_fin = ${ev.horarioFin || null},
        salon = ${ev.salon || null},
        tipo_evento = ${ev.tipoEvento || null},
        nombre_pareja = ${ev.nombrePareja || null},
        dni_novio1 = ${ev.dniNovio1 || null},
        dni_novio2 = ${ev.dniNovio2 || null},
        adultos = ${ev.adultos || 0},
        adolescentes = ${ev.adolescentes || 0},
        ninos = ${ev.ninos || 0},
        personas_dietas_especiales = ${ev.personasDietasEspeciales || 0},
        recetas_adultos = ${ev.recetasAdultos || []},
        recetas_adolescentes = ${ev.recetasAdolescentes || []},
        recetas_ninos = ${ev.recetasNinos || []},
        recetas_dietas_especiales = ${ev.recetasDietasEspeciales || []},
        multipliers_adultos = ${JSON.stringify(ev.multipliersAdultos || {})},
        multipliers_adolescentes = ${JSON.stringify(ev.multipliersAdolescentes || {})},
        multipliers_ninos = ${JSON.stringify(ev.multipliersNinos || {})},
        multipliers_dietas_especiales = ${JSON.stringify(ev.multipliersDietasEspeciales || {})},
        descripcion_personalizada = ${ev.descripcionPersonalizada || ""},
        barras = ${JSON.stringify(ev.barras || [])},
        servicios = ${JSON.stringify(ev.servicios || [])},
        paquetes_seleccionados = ${ev.paquetesSeleccionados || []},
        condicion_iva = ${ev.condicionIva || null},
        contrato = ${JSON.stringify(ev.contrato || null)},
        plan_de_cuotas = ${JSON.stringify(ev.planDeCuotas || null)},
        estado = ${ev.estado || "pendiente"},
        color_tag = ${ev.colorTag || null},
        precio_venta = ${ev.precioVenta || null},
        costo_personal = ${ev.costoPersonal || null},
        costo_insumos = ${ev.costoInsumos || null},
        costo_servicios = ${ev.costoServicios || null},
        costo_operativo = ${ev.costoOperativo || null},
        notas_internas = ${ev.notasInternas || null},
        pagos = ${JSON.stringify(ev.pagos || [])},
        asignaciones = ${JSON.stringify(ev.asignaciones || [])},
        costos_calculados = ${JSON.stringify(ev.costosCalculados || null)},
        stock_descontado = ${ev.stockDescontado || false},
        fecha_impresion = ${ev.fechaImpresion || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    const [updated] = await sql`SELECT * FROM eventos WHERE id = ${id}`
    await logActivity("evento", "modificado", nombre, `Estado: ${ev.estado}`)
    return NextResponse.json(fromRow(updated))
  } catch (err) {
    console.error("[API] Error updating evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE — soft delete (sets deleted_at)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [row] = await sql`SELECT * FROM eventos WHERE id = ${id}`
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Save to papelera
    await sql`
      INSERT INTO eventos_eliminados (id, nombre, fecha, estado, data)
      VALUES (
        ${row.id}, ${row.nombre}, ${row.fecha}, ${row.estado},
        ${JSON.stringify(fromRow(row))}
      )
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data,
        eliminado_at = NOW()
    `

    await sql`UPDATE eventos SET deleted_at = NOW() WHERE id = ${id}`
    await logActivity("evento", "eliminado", row.nombre || "Sin nombre")

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[API] Error deleting evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
