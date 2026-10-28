import { type NextRequest, NextResponse } from "next/server"
import { validarAnioEvento, mensajeAnioEventoInvalido } from "@/lib/validacion-anio-evento"
import { perfilDesdeRequest } from "@/lib/stock-salones-server"
import { revisarPedidoProxy, revisarFilaExistente, tieneAccesoTotal, type FilaAVerificar } from "@/lib/permisos-escritura"
import { avisarEscrituraRechazada } from "@/lib/permisos-escritura-server"

/**
 * Proxy autenticado hacia la API REST de Supabase (PostgREST).
 *
 * Contexto de seguridad: el acceso directo del navegador a Supabase con la
 * anon key fue bloqueado (REVOKE + RLS). Este proxy es el único camino para
 * el data-service del cliente: el middleware de sesión protege /api/*, y acá
 * usamos la service role key SOLO del lado del servidor (nunca viaja al
 * navegador). Así el blindaje de la base se mantiene sin romper la app.
 *
 * Permisos por perfil (PR #359, lib/permisos-escritura.ts): las lecturas
 * pasan como siempre; las escrituras, solo Administración y Soporte, más lo
 * que necesita Cobrar cuota. El resto de los perfiles recibe 403.
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

  const prohibido = await permisoDeEscritura(req, path)
  if (prohibido) return prohibido

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

  const headers = cabecerasServiceRole()
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

function cabecerasServiceRole(): Headers {
  const headers = new Headers()
  headers.set("apikey", SERVICE_KEY)
  headers.set("authorization", `Bearer ${SERVICE_KEY}`)
  return headers
}

/**
 * null si el perfil de la sesión puede hacer este pedido (toda lectura, o una
 * escritura permitida); si no, la respuesta 403 para devolver. El error va en
 * el formato de PostgREST para que el data-service lo muestre en la consola.
 */
async function permisoDeEscritura(req: NextRequest, path: string[]): Promise<NextResponse | null> {
  if (req.method === "GET" || req.method === "HEAD") return null
  const perfil = await perfilDesdeRequest(req)
  // El cuerpo solo se lee para los perfiles con reglas por fila (Cobrar cuota).
  let cuerpo: unknown
  if (!tieneAccesoTotal(perfil)) {
    try {
      cuerpo = await req.clone().json()
    } catch {
      cuerpo = undefined
    }
  }
  let decision = revisarPedidoProxy(perfil, {
    metodo: req.method,
    ruta: path,
    query: req.nextUrl.searchParams,
    prefer: req.headers.get("prefer") || "",
    esquema: req.headers.get("content-profile"),
    cuerpo,
  })
  if (decision.ok && decision.verificar) {
    const fila = await leerFila(decision.verificar)
    if (fila === undefined) {
      return NextResponse.json(
        { code: "LJ503", message: "No se pudo verificar el permiso. Probá de nuevo.", details: null, hint: null },
        { status: 503 },
      )
    }
    decision = revisarFilaExistente(decision.verificar, fila)
  }
  if (decision.ok) return null
  avisarEscrituraRechazada({ perfil, metodo: req.method, ruta: "/api/db", tabla: path.slice(2).join("/") })
  return NextResponse.json({ code: "LJ403", message: decision.motivo, details: null, hint: null }, { status: 403 })
}

/** La fila con ese id (null si no existe), o undefined si no se pudo leer. */
async function leerFila(v: FilaAVerificar): Promise<Record<string, unknown> | null | undefined> {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${v.tabla}`)
    url.searchParams.set("id", `eq.${v.id}`)
    url.searchParams.set("select", v.columnas)
    const res = await fetch(url, { headers: cabecerasServiceRole(), cache: "no-store" })
    if (!res.ok) return undefined
    const filas = await res.json()
    if (!Array.isArray(filas)) return undefined
    return filas[0] ?? null
  } catch {
    return undefined
  }
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
  proxy as HEAD,
}
