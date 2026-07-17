export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"

// GET — devuelve el estado de la sesión actual (cookie httpOnly o header)
export async function GET() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const token = cookieStore.get(SESSION_COOKIE)?.value || headerStore.get(SESSION_HEADER)
  const session = await verifyToken(token)
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, perfilId: session.perfilId })
}
