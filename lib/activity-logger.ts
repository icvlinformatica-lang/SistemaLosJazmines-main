import { sql } from "@/lib/db"

export type ActivityTipo = "insumo" | "insumo_barra" | "receta" | "coctel" | "evento"
export type ActivityAccion = "creado" | "eliminado" | "modificado" | "planificado"

export async function logActivity(
  tipo: ActivityTipo,
  accion: ActivityAccion,
  nombre: string,
  detalle?: string
) {
  try {
    await sql`
      INSERT INTO activity_log (tipo, accion, nombre, detalle)
      VALUES (${tipo}, ${accion}, ${nombre}, ${detalle || null})
    `
  } catch {
    // Never throw — logging is fire-and-forget
  }
}
