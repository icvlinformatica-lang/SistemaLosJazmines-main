import { type NextRequest, NextResponse } from "next/server"
import { validarAnioEvento, mensajeAnioEventoInvalido } from "@/lib/validacion-anio-evento"

/**
 * Proxy autenticado hacia la API REST de Supabase (PostgREST).
 *
 * Contexto de seguridad: el acceso directo del navegador a Supabase con la
 * anon key fue bloqueado (REVOKE + RLS). Este proxy es el único camino para
 * el data-service del cliente: el middleware de sesión protege /api/*, y acá
 * usamos la service role key SOLO del lado del servidor (nunca viaja al
 * navegador). Así el blindaje de la base se mantiene sin romper la app.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// Headers del request original que sí se reenvían a PostgREST.
const FORWARD_REQUEST_HEADERS = ["content-type", "prefer", "range", "accept", "accept-profile", "content-profile"]
// Headers de la respuesta de PostgREST que se devuelven al cliente.
const FORWARD_RESPONSE_HEADERS = ["content-type", "content-range", "preference-applied"]

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 })
  }

  const { path } = await params
  // El cliente supabase-js llama a `${base}/rest/v1/...`; solo permitimos esa ruta.
  if (path[0] !== "rest" || path[1] !== "v1") {
    return NextResponse.json({ error: "Ruta no permitida" }, { status: 404 })
  }

  if (path.length === 3 && path[2] === "eventos" && ["POST", "PATCH", "PUT"].includes(req.method)) {
    let payload: unknown
    try {
      payload = await req.clone().json()
    } catch {
      return NextResponse.json({ error: "El cuerpo debe ser JSON válido" }, { status: 400 })
    }
    const eventos = Array.isArray(payload) ? payload : [payload]
    for (const evento of eventos) {
      if (!evento || typeof evento !== "object" || Array.isArray(evento)) {
        return NextResponse.json({ error: "Datos de evento inválidos" }, { status: 400 })
      }
      if ("fecha" in evento) {
        const { valido, anio } = validarAnioEvento(evento.fecha)
        if (!valido) {
          return NextResponse.json({ error: mensajeAnioEventoInvalido(anio) }, { status: 400 })
        }
      }
    }
  }

  const target = new URL(`${SUPABASE_URL}/${path.join("/")}`)
  target.search = req.nextUrl.search

  const headers = new Headers()
  headers.set("apikey", SERVICE_KEY)
  headers.set("authorization", `Bearer ${SERVICE_KEY}`)
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(h)
    if (v) headers.set(h, v)
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  const res = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: "no-store",
  })

  const responseHeaders = new Headers()
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = res.headers.get(h)
    if (v) responseHeaders.set(h, v)
  }

  return new NextResponse(res.status === 204 ? null : await res.arrayBuffer(), {
    status: res.status,
    headers: responseHeaders,
  })
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
  proxy as HEAD,
}
