export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

/**
 * Paquetes por salón para el perfil Vendedor (Etapa 4). Reusa la misma
 * tabla "paquetes_salones" que ya usa Administración en /admin/servicios
 * (fila { id, data jsonb }) — nunca se duplica el catálogo.
 *
 * Saneado: nunca se devuelve precioInterno (por servicio), costoTotal,
 * ganancia ni margenPorcentaje — eso es exactamente lo que Administración
 * ve de más en /admin/servicios y que acá tiene que quedar afuera.
 */

interface ServicioIncluidoRaw {
  servicioId: string
  nombre: string
  categoria: string
  unidad: string
  cantidad?: number
  precioOficial?: number
}

interface PaqueteRaw {
  salon: string
  nombre: string
  descripcion?: string
  capacidadMinima?: number
  capacidadMaxima?: number
  serviciosIncluidos?: ServicioIncluidoRaw[]
  precioOficial?: number
  activo?: boolean
}

function sanear(id: string, data: PaqueteRaw) {
  return {
    id,
    salon: data.salon,
    nombre: data.nombre,
    descripcion: data.descripcion || "",
    capacidadMinima: data.capacidadMinima || 0,
    capacidadMaxima: data.capacidadMaxima || 0,
    precioVenta: Number(data.precioOficial) || 0,
    servicios: (data.serviciosIncluidos || []).map((si) => ({
      servicioId: si.servicioId,
      nombre: si.nombre,
      categoria: si.categoria,
      unidad: si.unidad,
      cantidad: si.cantidad || 1,
      precioVenta: Number(si.precioOficial) || 0,
    })),
  }
}

export async function GET() {
  try {
    const filas = (await sql`SELECT id, data FROM paquetes_salones`) as unknown as Array<{
      id: string
      data: PaqueteRaw | string
    }>
    // La columna es jsonb, pero el driver a veces la devuelve como string sin parsear.
    const parseData = (raw: PaqueteRaw | string): PaqueteRaw => (typeof raw === "string" ? JSON.parse(raw) : raw)
    const paquetes = filas
      .map((f) => ({ id: f.id, data: parseData(f.data) }))
      .filter((f) => f.data?.activo !== false)
      .map((f) => sanear(f.id, f.data))
    return NextResponse.json({ ok: true, paquetes })
  } catch (err) {
    console.error("[API] Error en vendedor/paquetes GET:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}

interface ServicioCatalogo {
  id: string
  nombre: string
  categoria: string
  unidad: string
  precio_venta: number
  costo_para_caja_eventos: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { nombre, salon, descripcion, capacidadMinima, capacidadMaxima, servicios } = body || {}

    if (typeof nombre !== "string" || !nombre.trim()) {
      return NextResponse.json({ ok: false, error: "Falta el nombre del paquete" }, { status: 400 })
    }
    if (typeof salon !== "string" || !salon.trim()) {
      return NextResponse.json({ ok: false, error: "Falta el salón" }, { status: 400 })
    }
    const seleccion: Array<{ servicioId: string; cantidad?: number }> = Array.isArray(servicios) ? servicios : []
    if (seleccion.length === 0) {
      return NextResponse.json({ ok: false, error: "El paquete necesita al menos un servicio" }, { status: 400 })
    }

    const catalogo = (await sql`
      SELECT id, nombre, categoria, unidad, precio_venta, costo_para_caja_eventos FROM servicios
    `) as unknown as ServicioCatalogo[]

    let costoTotal = 0
    let precioOficialTotal = 0
    const serviciosIncluidos = seleccion
      .map((item) => {
        const s = catalogo.find((c) => c.id === item.servicioId)
        if (!s) return null
        const cantidad = Math.max(1, Number(item.cantidad) || 1)
        const precioInterno = Number(s.costo_para_caja_eventos) || 0
        const precioOficial = Number(s.precio_venta) || 0
        costoTotal += precioInterno * cantidad
        precioOficialTotal += precioOficial * cantidad
        return {
          servicioId: s.id,
          nombre: s.nombre,
          categoria: s.categoria,
          unidad: s.unidad,
          cantidad,
          precioInterno,
          precioOficial,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (serviciosIncluidos.length === 0) {
      return NextResponse.json({ ok: false, error: "Ninguno de los servicios elegidos existe en el catálogo" }, { status: 400 })
    }

    const ganancia = precioOficialTotal - costoTotal
    const margenPorcentaje = costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0
    const id = crypto.randomUUID()

    const data = {
      id,
      salon,
      nombre: nombre.trim(),
      descripcion: typeof descripcion === "string" ? descripcion : "",
      serviciosIncluidos,
      costoTotal,
      precioOficial: precioOficialTotal,
      ganancia,
      margenPorcentaje,
      capacidadMinima: Number(capacidadMinima) || 0,
      capacidadMaxima: Number(capacidadMaxima) || 0,
      activo: true,
    }

    await sql`INSERT INTO paquetes_salones (id, data) VALUES (${id}, ${JSON.stringify(data)}::jsonb)`

    return NextResponse.json({ ok: true, paquete: sanear(id, data) })
  } catch (err) {
    console.error("[API] Error en vendedor/paquetes POST:", err)
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
  }
}
