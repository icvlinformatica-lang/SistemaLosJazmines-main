import { sql } from "@/lib/db"
import { cookies } from "next/headers"

export type ActivityTipo = "insumo" | "insumo_barra" | "receta" | "coctel" | "evento"
export type ActivityAccion = "creado" | "eliminado" | "modificado" | "planificado"

export async function logActivity(
  tipo: ActivityTipo,
  accion: ActivityAccion,
  nombre: string,
  detalle?: string
) {
  try {
    // Atribuir el registro a quien ingresó con Administración (Diego o Leila),
    // leyendo la cookie seteada en el login.
    let usuario: string | null = null
    try {
      const cookieStore = await cookies()
      const valor = cookieStore.get("lj_usuario")?.value
      usuario = valor ? decodeURIComponent(valor).trim() || null : null
    } catch {
      // Fuera de un contexto de request no hay cookies: seguir sin usuario
    }

    const detalleFinal = usuario
      ? detalle
        ? `${detalle} · Por ${usuario}`
        : `Por ${usuario}`
      : detalle || null

    await sql`
      INSERT INTO activity_log (tipo, accion, nombre, detalle)
      VALUES (${tipo}, ${accion}, ${nombre}, ${detalleFinal})
    `
  } catch {
    // Never throw — logging is fire-and-forget
  }
}
