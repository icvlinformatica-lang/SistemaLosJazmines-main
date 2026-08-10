import { NextResponse, type NextRequest } from "next/server"
import { verifyToken, SESSION_COOKIE, SESSION_HEADER } from "@/lib/auth/server"

// Rutas de API públicas (no requieren sesión)
// /api/cron/* lo invoca el cron de Vercel (sin sesión); cada ruta de cron
// valida CRON_SECRET por su cuenta.
const PUBLIC_API_ROUTES = ["/api/auth/login", "/api/auth/logout", "/api/auth/session", "/api/cron/"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Solo protegemos las rutas de API; las páginas manejan su propio redirect a /login
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // La sesión puede venir por cookie httpOnly o por header (para entornos
  // donde las cookies de terceros están bloqueadas, ej. vista previa en iframe)
  const token = req.cookies.get(SESSION_COOKIE)?.value || req.headers.get(SESSION_HEADER)
  const session = await verifyToken(token)

  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
