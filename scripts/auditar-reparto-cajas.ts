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
    // Reduzco TODOS los movimientos del grupo proporcionalmente (cada seña
    // puede estar partida en varios movimientos por método de pago) y creo
    // una única contraparte en Caja Jazmines por el total.
    const nombreEvento = x.e.nombrePareja || x.e.nombre || "Evento"
    const etiqueta = x.k.split("|")[1]

    // factor que queda en Eventos
    const factor = x.montoEventos / x.tE
    let acumEventos = 0
    const nuevos: { id: string; monto: number }[] = []
    for (let i = 0; i < x.ms.length; i++) {
      const m = x.ms[i]
      let nuevo: number
      if (i === x.ms.length - 1) {
        // el último absorbe el redondeo para que la suma cierre exacta
        nuevo = Math.round((x.montoEventos - acumEventos) * 100) / 100
      } else {
        nuevo = Math.round(Number(m.monto) * factor * 100) / 100
      }
      acumEventos += nuevo
      nuevos.push({ id: m.id, monto: nuevo })
    }
    if (nuevos.some((n) => n.monto < 0)) {
      console.log(`  SKIP ${x.k} (montos negativos tras el reparto)`)
      continue
    }
    for (const n of nuevos) {
      await rest(`/movimientos_caja?id=eq.${n.id}`, {
        method: "PATCH",
        body: JSON.stringify({ monto: n.monto }),
      })
    }
    await rest(`/movimientos_caja`, {
      method: "POST",
      body: JSON.stringify({
        fecha: x.ms[0].fecha,
        tipo: "ingreso",
        concepto: `${etiqueta} (Caja Jazmines)`,
        monto: x.montoJazmines,
        salon: x.e.salon,
        evento_id: x.e.id,
        caja_destino: "caja_jazmines",
        saldo_resultante: null,
      }),
    })
    console.log(`  OK ${nombreEvento} · ${etiqueta}: Eventos ${fmt(acumEventos)} (${x.ms.length} mov.) + Jazmines ${fmt(x.montoJazmines)}`)
  }
  console.log("Listo.")
}

main().catch((e) => {
  console.error("ERROR:", e.message)
  process.exit(1)
})
