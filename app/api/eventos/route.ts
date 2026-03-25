export const dynamic = 'force-dynamic'
import { sql, generateId } from "@/lib/db"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity-logger"

// camelCase → snake_case for DB insert/update
function toRow(ev: Record<string, unknown>) {
  return {
    id: ev.id as string,
    nombre: (ev.nombrePareja as string) || (ev.nombre as string) || "Sin nombre",
    fecha: (ev.fecha as string) || null,
    horario: (ev.horario as string) || null,
    horario_fin: (ev.horarioFin as string) || null,
    salon: (ev.salon as string) || null,
    tipo_evento: (ev.tipoEvento as string) || null,
    nombre_pareja: (ev.nombrePareja as string) || null,
    dni_novio1: (ev.dniNovio1 as string) || null,
    dni_novio2: (ev.dniNovio2 as string) || null,
    adultos: (ev.adultos as number) || 0,
    adolescentes: (ev.adolescentes as number) || 0,
    ninos: (ev.ninos as number) || 0,
    personas_dietas_especiales: (ev.personasDietasEspeciales as number) || 0,
    recetas_adultos: (ev.recetasAdultos as string[]) || [],
    recetas_adolescentes: (ev.recetasAdolescentes as string[]) || [],
    recetas_ninos: (ev.recetasNinos as string[]) || [],
    recetas_dietas_especiales: (ev.recetasDietasEspeciales as string[]) || [],
    multipliers_adultos: JSON.stringify(ev.multipliersAdultos || {}),
    multipliers_adolescentes: JSON.stringify(ev.multipliersAdolescentes || {}),
    multipliers_ninos: JSON.stringify(ev.multipliersNinos || {}),
    multipliers_dietas_especiales: JSON.stringify(ev.multipliersDietasEspeciales || {}),
    descripcion_personalizada: (ev.descripcionPersonalizada as string) || "",
    barras: JSON.stringify(ev.barras || []),
    servicios: JSON.stringify(ev.servicios || []),
    paquetes_seleccionados: (ev.paquetesSeleccionados as string[]) || [],
    condicion_iva: (ev.condicionIva as string) || null,
    contrato: JSON.stringify(ev.contrato || null),
    plan_de_cuotas: JSON.stringify(ev.planDeCuotas || null),
    estado: (ev.estado as string) || "pendiente",
    color_tag: (ev.colorTag as string) || null,
    precio_venta: (ev.precioVenta as number) || null,
    costo_personal: (ev.costoPersonal as number) || null,
    costo_insumos: (ev.costoInsumos as number) || null,
    costo_servicios: (ev.costoServicios as number) || null,
    costo_operativo: (ev.costoOperativo as number) || null,
    notas_internas: (ev.notasInternas as string) || null,
    pagos: JSON.stringify(ev.pagos || []),
    asignaciones: JSON.stringify(ev.asignaciones || []),
    costos_calculados: JSON.stringify(ev.costosCalculados || null),
    stock_descontado: (ev.stockDescontado as boolean) || false,
    fecha_impresion: (ev.fechaImpresion as string) || null,
  }
}

// DB row → camelCase for app
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
  stock_descontado, fecha_impresion, created_at, updated_at
`

// GET — all active eventos (deleted_at IS NULL)
export async function GET() {
  try {
    const rows = await sql`
      SELECT ${sql.unsafe(SELECT_COLS)} FROM eventos
      WHERE deleted_at IS NULL
      ORDER BY fecha DESC NULLS LAST, created_at DESC
    `
    return NextResponse.json(rows.map(fromRow))
  } catch (err) {
    console.error("[API] Error fetching eventos:", err)
    return NextResponse.json([], { status: 200 })
  }
}

// POST — create new evento
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = body.id || generateId()
    const r = toRow({ ...body, id })
    const nombre = r.nombre

    await sql`
      INSERT INTO eventos (
        id, nombre, fecha, horario, horario_fin, salon, tipo_evento, nombre_pareja,
        dni_novio1, dni_novio2, adultos, adolescentes, ninos, personas_dietas_especiales,
        recetas_adultos, recetas_adolescentes, recetas_ninos, recetas_dietas_especiales,
        multipliers_adultos, multipliers_adolescentes, multipliers_ninos, multipliers_dietas_especiales,
        descripcion_personalizada, barras, servicios, paquetes_seleccionados,
        condicion_iva, contrato, plan_de_cuotas, estado, color_tag,
        precio_venta, costo_personal, costo_insumos, costo_servicios, costo_operativo,
        notas_internas, pagos, asignaciones, costos_calculados,
        stock_descontado, fecha_impresion
      ) VALUES (
        ${r.id}, ${r.nombre}, ${r.fecha}, ${r.horario}, ${r.horario_fin}, ${r.salon},
        ${r.tipo_evento}, ${r.nombre_pareja}, ${r.dni_novio1}, ${r.dni_novio2},
        ${r.adultos}, ${r.adolescentes}, ${r.ninos}, ${r.personas_dietas_especiales},
        ${r.recetas_adultos}, ${r.recetas_adolescentes}, ${r.recetas_ninos}, ${r.recetas_dietas_especiales},
        ${r.multipliers_adultos}, ${r.multipliers_adolescentes}, ${r.multipliers_ninos}, ${r.multipliers_dietas_especiales},
        ${r.descripcion_personalizada}, ${r.barras}, ${r.servicios}, ${r.paquetes_seleccionados},
        ${r.condicion_iva}, ${r.contrato}, ${r.plan_de_cuotas}, ${r.estado}, ${r.color_tag},
        ${r.precio_venta}, ${r.costo_personal}, ${r.costo_insumos}, ${r.costo_servicios}, ${r.costo_operativo},
        ${r.notas_internas}, ${r.pagos}, ${r.asignaciones}, ${r.costos_calculados},
        ${r.stock_descontado}, ${r.fecha_impresion}
      )
      ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre, fecha = EXCLUDED.fecha, estado = EXCLUDED.estado,
        updated_at = NOW()
    `

    // Re-fetch con columnas explícitas para evitar columna obsoleta "data"
    const rows2 = await sql`SELECT ${sql.unsafe(SELECT_COLS)} FROM eventos WHERE id = ${r.id}`
    const created = rows2[0]
    await logActivity("evento", "creado", nombre, `Fecha: ${r.fecha || "sin fecha"} | Salon: ${r.salon || "sin salon"}`)
    return NextResponse.json(fromRow(created), { status: 201 })
  } catch (err) {
    console.error("[API] Error creating evento:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
