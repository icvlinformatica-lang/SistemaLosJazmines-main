import { NextResponse, type NextRequest } from "next/server"
import { verifyToken, SESSION_COOKIE } from "@/lib/auth/server"

// Rutas de API públicas (no requieren sesión)
const PUBLIC_API_ROUTES = ["/api/auth/login", "/api/auth/logout", "/api/auth/session"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Solo protegemos las rutas de API; las páginas manejan su propio redirect a /login
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = await verifyToken(token)

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
