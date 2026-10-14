// Anotación del perfil de la sesión en un evento (tabla anotaciones_evento,
// migración 024). Cada perfil lee y escribe SOLO la suya: el perfil sale de
// la sesión firmada, nunca del cuerpo del pedido.
// GET → { disponible, texto, actualizado }
// PUT { texto } → guarda (upsert: repetir el mismo pedido da lo mismo).
// No pasa por /api/eventos ni toca la fila del evento: no manda mail ni deja
// activity_log en cada tecla.
import { sql } from "@/lib/db"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { faltaTablaAnotaciones, idEventoValido, textoAnotacionValido } from "@/lib/anotaciones-evento"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await perfilDesdeRequest(req)
  if (!perfil) return Response.json({ error: "Sesión inválida" }, { status: 401 })
  const { id } = await params
  if (!idEventoValido(id)) return Response.json({ error: "Evento inválido" }, { status: 400 })
  try {
    const filas = (await sql`
      SELECT texto, updated_at FROM anotaciones_evento WHERE evento_id = ${id} AND perfil = ${perfil} LIMIT 1
    `) as unknown as Array<{ texto: string; updated_at: string | Date }>
    const fila = filas[0]
    return Response.json({
      disponible: true,
      texto: fila?.texto ?? "",
      actualizado: fila ? new Date(fila.updated_at).toISOString() : null,
    })
  } catch (error) {
    if (faltaTablaAnotaciones(error)) return Response.json({ disponible: false, texto: "", actualizado: null })
    console.error("[anotacion] GET", error)
    return Response.json({ error: "No se pudo leer la anotación" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const perfil = await perfilDesdeRequest(req)
  if (!perfil) return Response.json({ error: "Sesión inválida" }, { status: 401 })
  const { id } = await params
  if (!idEventoValido(id)) return Response.json({ error: "Evento inválido" }, { status: 400 })
  const body = (await req.json().catch(() => null)) as { texto?: unknown } | null
  const valido = textoAnotacionValido(body?.texto)
  if (!valido.ok) return Response.json({ error: valido.error }, { status: 400 })
  try {
    // Solo eventos que existen (no los de la papelera): evita filas sueltas.
    const existe = (await sql`SELECT 1 FROM eventos WHERE id = ${id} LIMIT 1`) as unknown as unknown[]
    if (existe.length === 0) return Response.json({ error: "El evento no existe" }, { status: 404 })
    const filas = (await sql`
      INSERT INTO anotaciones_evento (evento_id, perfil, texto, updated_at)
      VALUES (${id}, ${perfil}, ${valido.texto}, now())
      ON CONFLICT (evento_id, perfil) DO UPDATE SET texto = EXCLUDED.texto, updated_at = now()
      RETURNING updated_at
    `) as unknown as Array<{ updated_at: string | Date }>
    return Response.json({ ok: true, actualizado: new Date(filas[0].updated_at).toISOString() })
  } catch (error) {
    if (faltaTablaAnotaciones(error)) {
      return Response.json({ error: "Las anotaciones todavía no están habilitadas", disponible: false }, { status: 503 })
    }
    console.error("[anotacion] PUT", error)
    return Response.json({ error: "No se pudo guardar la anotación" }, { status: 500 })
  }
}
