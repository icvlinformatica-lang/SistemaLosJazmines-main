export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, SESSION_COOKIE } from "@/lib/auth/server"

// GET — devuelve el estado de la sesión actual (basado en la cookie httpOnly)
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, perfilId: session.perfilId })
}
