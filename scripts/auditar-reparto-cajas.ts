/**
 * Auditoría del reparto de cobros entre Caja Eventos y Caja Jazmines.
 *
 * Usa las MISMAS funciones que la app (calcularProporcionCajaEventos con
 * costos EN VIVO) y las APIs internas (mismo mapeo DB→front que el cliente).
 *
 * Modos:
 *   npx tsx scripts/auditar-reparto-cajas.ts           → solo auditar (en seco)
 *   npx tsx scripts/auditar-reparto-cajas.ts --aplicar → repartir los cobros
 *     que hoy están 100% en Caja Eventos, según la fórmula viva.
 */
import { calcularProporcionCajaEventos, repartirEntreCajas } from "../lib/cobrar-cuota"

const BASE = "http://localhost:3000"
const SUPA = process.env.SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APLICAR = process.argv.includes("--aplicar")

// Cookie de sesión firmada (mismo esquema que lib/auth/server.ts)
import { createHmac } from "crypto"
const exp = Date.now() + 1000 * 60 * 30
const data = `administracion.${exp}`
const sig = createHmac("sha256", process.env.AUTH_SECRET!).update(data).digest("base64url")
const COOKIE = `lj_session=${data}.${sig}`

async function api(path: string) {
  const r = await fetch(BASE + path, { headers: { Cookie: COOKIE } })
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  return r.json()
}

async function rest(path: string, init?: RequestInit) {
  const r = await fetch(SUPA + "/rest/v1" + path, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`REST ${path} → ${r.status}: ${JSON.stringify(body).slice(0, 200)}`)
  return body
}

async function restAll(path: string) {
  let all: any[] = []
  for (let from = 0; ; from += 1000) {
    const rows = await rest(`${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${from}`)
    all = all.concat(rows)
    if (rows.length < 1000) break
  }
  return all
}

const fmt = (n: number) => Math.round(n).toLocaleString("es-AR")

async function main() {
  // Datos con el mapeo real de la app
  const [eventosResp, recetas, insumos, insumosBarra, cocteles] = await Promise.all([
    api("/api/eventos"),
    api("/api/recetas"),
    api("/api/insumos"),
    api("/api/insumos-barra"),
    api("/api/cocteles"),
  ])
  const eventos: any[] = eventosResp.eventos ?? eventosResp
  // Servicios: mapeo igual a fetchServicios de data-service
  const serviciosRows = await restAll("/servicios?select=*")
  const servicios = serviciosRows.map((s: any) => ({
    id: s.id,
    codigo: s.codigo || "",
    nombre: s.nombre,
    descripcion: s.descripcion || "",
    categoria: s.categoria,
    unidad: s.unidad || "Fijo",
    activo: s.activo ?? true,
    margenGanancia: Number(s.margen_ganancia) || 0,
    precioVenta: Number(s.precio_venta) || 0,
    costoParaCajaEventos: Number(s.costo_para_caja_eventos) || 0,
    porcentajeSeña: Number(s.porcentaje_sena) || 30,
    diasAnticipacionSeña: Number(s.dias_anticipacion_sena) || 30,
    diasAnticipacionSaldo: Number(s.dias_anticipacion_saldo) || 7,
  }))
  const datos = { insumos, insumosBarra, recetas, cocteles, servicios }
  const evMap = new Map(eventos.map((e: any) => [e.id, e]))

  const movs = await restAll(
    "/movimientos_caja?tipo=eq.ingreso&select=id,fecha,concepto,monto,salon,caja_destino,evento_id,saldo_resultante&order=fecha",
  )

  // Agrupar cobros por evento + etiqueta
  const grupos = new Map<string, any[]>()
  for (const m of movs) {
    if (!m.evento_id || !m.concepto) continue
    const match = /^((Cuota \d+|Seña|Pago)[^(]*)/.exec(m.concepto)
    if (!match) continue
    const k = `${m.evento_id}|${match[1].trim()}`
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k)!.push(m)
  }

  console.log("=== 1) AUDITORÍA: repartos existentes vs fórmula viva ===")
  let ok = 0
  const desvios: string[] = []
  for (const [k, ms] of grupos) {
    const ev = ms.filter((m) => m.caja_destino === "caja_eventos")
    const jz = ms.filter((m) => m.caja_destino === "caja_jazmines")
    if (!ev.length || !jz.length) continue
    const e = evMap.get(k.split("|")[0])
    if (!e) continue
    const tE = ev.reduce((s, m) => s + Number(m.monto), 0)
    const tJ = jz.reduce((s, m) => s + Number(m.monto), 0)
    const real = tE / (tE + tJ)
    const teorica = calcularProporcionCajaEventos(e, datos)
    if (Math.abs(real - teorica) < 0.02) ok++
    else
      desvios.push(
        `${e.nombrePareja || e.nombre} · ${k.split("|")[1]}: real ${(real * 100).toFixed(1)}% vs fórmula viva ${(teorica * 100).toFixed(1)}% (dif ${fmt(Math.abs(real - teorica) * (tE + tJ))})`,
      )
  }
  console.log(`Coinciden con la fórmula viva (±2%): ${ok} | Con desvío: ${desvios.length}`)
  desvios.forEach((d) => console.log("  DESVÍO:", d))

  console.log("\n=== 2) Cobros 100% en Caja Eventos (sin parte Jazmines) ===")
  const propuesta: any[] = []
  for (const [k, ms] of grupos) {
    if (ms.some((m) => m.caja_destino === "caja_jazmines")) continue
    const e = evMap.get(k.split("|")[0])
    if (!e) continue
    const p = calcularProporcionCajaEventos(e, datos)
    const tE = ms.reduce((s, m) => s + Number(m.monto), 0)
    const { montoEventos, montoJazmines } = repartirEntreCajas(tE, p)
    if (montoJazmines <= 0) continue
    propuesta.push({ k, ms, e, p, tE, montoEventos, montoJazmines })
  }
  propuesta.sort((a, b) => a.ms[0].fecha.localeCompare(b.ms[0].fecha))
  let totalJaz = 0
  for (const x of propuesta) {
    totalJaz += x.montoJazmines
    console.log(
      `${x.ms[0].fecha.slice(0, 10)} | ${x.e.nombrePareja || x.e.nombre} | ${x.k.split("|")[1]} | salón ${x.e.salon} | ${fmt(x.tE)} → Eventos ${fmt(x.montoEventos)} (${(x.p * 100).toFixed(1)}%) + Jazmines ${fmt(x.montoJazmines)}`,
    )
  }
  console.log(`\nTOTAL: ${propuesta.length} cobros | pasaría a Jazmines: ${fmt(totalJaz)}`)

  if (!APLICAR) {
    console.log("\n(en seco: no se modificó nada; correr con --aplicar para repartir)")
    return
  }

  console.log("\n=== 3) APLICANDO reparto ===")
  for (const x of propuesta) {
    // Reduzco el movimiento más grande del grupo y creo la contraparte Jazmines
    const principal = x.ms.reduce((a: any, b: any) => (Number(a.monto) >= Number(b.monto) ? a : b))
    const nuevoMontoPrincipal = Math.round((Number(principal.monto) - x.montoJazmines) * 100) / 100
    if (nuevoMontoPrincipal <= 0) {
      console.log(`  SKIP ${x.k} (el principal no cubre la parte de Jazmines)`)
      continue
    }
    await rest(`/movimientos_caja?id=eq.${principal.id}`, {
      method: "PATCH",
      body: JSON.stringify({ monto: nuevoMontoPrincipal }),
    })
    const nombreEvento = x.e.nombrePareja || x.e.nombre || "Evento"
    const etiqueta = x.k.split("|")[1]
    await rest(`/movimientos_caja`, {
      method: "POST",
      body: JSON.stringify({
        fecha: principal.fecha,
        tipo: "ingreso",
        concepto: `${etiqueta} (Caja Jazmines)`,
        monto: x.montoJazmines,
        salon: x.e.salon,
        evento_id: x.e.id,
        caja_destino: "caja_jazmines",
        saldo_resultante: null,
      }),
    })
    console.log(`  OK ${nombreEvento} · ${etiqueta}: Eventos ${fmt(nuevoMontoPrincipal)} + Jazmines ${fmt(x.montoJazmines)}`)
  }
  console.log("Listo.")
}

main().catch((e) => {
  console.error("ERROR:", e.message)
  process.exit(1)
})
