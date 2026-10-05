// Un solo evento por día y por salón (scripts/019): la base lo frena con el
// índice único eventos_un_evento_por_dia_y_salon. Esto traduce ese error a
// un 409 con un mensaje claro, para que la pantalla lo muestre tal cual.
import { NextResponse } from "next/server"

export function respuestaSalonOcupado(err: unknown): NextResponse | null {
  const e = err as { code?: string; constraint_name?: string; constraint?: string; message?: string }
  const indice = e?.constraint_name ?? e?.constraint ?? e?.message ?? ""
  if (e?.code !== "23505" || !String(indice).includes("eventos_un_evento_por_dia_y_salon")) return null
  return NextResponse.json(
    { error: "Ese salón ya tiene un evento ese día. Elegí otra fecha u otro salón." },
    { status: 409 },
  )
}
