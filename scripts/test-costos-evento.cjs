// Costos del evento: que los números de la pantalla se correspondan entre sí
// y con lo que salió de Caja Eventos.
// Correr: node --test scripts/test-costos-evento.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (mod, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } })
  mod._compile(result.outputText, filename)
}
const { calcularCostoEventoCajaEventos, porcentajeEntero, resumenCobroCliente } = require("../lib/costo-evento.ts")
const { ultimoEgresoEvento, nombreEventoEnCaja } = require("../lib/egresos-evento.ts")
const { congelarCostosEvento } = require("../lib/store.ts")

// Catálogo inventado
const insumos = [{ id: "lomo", codigo: "L", descripcion: "Lomo", unidad: "KG", stockActual: 0, precioUnitario: 20000 }]
const recetas = [{ id: "r1", codigo: "R1", nombre: "Lomo", descripcion: "", categoria: "Plato Principal", factorRendimiento: 1, insumos: [{ insumoId: "lomo", detalleCorte: "", cantidadBasePorPersona: 250, unidadReceta: "GRS" }] }]
const FOTO = { id: "foto", nombre: "Foto", categoria: "Otros", unidad: "Fijo", activo: true, costoParaCajaEventos: 1000000, porcentajeSeña: 30 }
const DECO = { id: "deco", nombre: "Deco", categoria: "Otros", unidad: "Fijo", activo: true, costoParaCajaEventos: 800000, porcentajeSeña: 50 }
const srv = (cat, patch = {}) => ({ servicioId: cat.id, nombre: cat.nombre, cantidad: 1, unidad: "Fijo", ...patch })
// nombre y nombrePareja distintos: Caja Eventos escribe el de la pareja
const ev = (patch = {}) => ({
  id: "ev1", nombre: "Casamiento", nombrePareja: "Ana y Juan", estado: "pendiente", salon: "Quinta", fecha: "2027-03-20",
  adultos: 100, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0,
  recetasAdultos: ["r1"], recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [],
  multipliersAdultos: {}, multipliersAdolescentes: {}, multipliersNinos: {}, multipliersDietasEspeciales: {},
  barras: [], servicios: [], personalEvento: [], ...patch,
})
const egreso = (id, concepto, monto, fecha = "2026-09-01T15:00:00.000Z") => ({ id, tipo: "egreso", cajaDestino: "caja_eventos", eventoId: "ev1", salon: "Quinta", concepto, monto, fecha })
const datos = (patch = {}) => ({ recetas, insumos, cocteles: [], insumosBarra: [], servicios: [FOTO, DECO], personal: [], movimientosCaja: [], ...patch })
const sumaRubros = (c) => c.costoCocina + c.costoBarra + c.totalServicios + c.totalPersonal

test("saldo pagado desde Caja Eventos (con el nombre de la pareja) se encuentra: no queda en $0", () => {
  const e = ev({ servicios: [srv(FOTO, { estadoPago: "pagado_total", pagado: true, montoSeña: 300000 })] })
  const c = calcularCostoEventoCajaEventos(e, datos({ movimientosCaja: [
    egreso("m1", "Pago seña Foto - Ana y Juan", 300000),
    egreso("m2", "Pago saldo Foto - Ana y Juan", 700000),
  ] }))
  assert.equal(c.serviciosCalc[0].saldo, 700000)
  assert.equal(c.totalServicios, 1000000)
  assert.equal(c.serviciosCalc[0].saldoSinEgreso, false)
  assert.equal(c.serviciosCalc[0].señaSinEgreso, false)
})

test("saldo marcado pagado sin egreso en la caja: cuenta lo que falta para el costo, con aviso", () => {
  const e = ev({ servicios: [srv(DECO, { estadoPago: "pagado_total", pagado: true, montoSeña: 400000 })] })
  const c = calcularCostoEventoCajaEventos(e, datos())
  assert.equal(c.serviciosCalc[0].saldo, 400000) // 800.000 − 400.000, antes daba 0
  assert.equal(c.totalServicios, 800000)
  assert.equal(c.serviciosCalc[0].saldoSinEgreso, true)
  assert.equal(c.serviciosCalc[0].señaSinEgreso, true)
})

test("saldo pagado sin haber pagado la seña: se avisa que la seña no salió de la caja (los montos no cambian)", () => {
  const e = ev({ servicios: [srv(DECO, { estadoPago: "pagado_total", pagado: true, montoSeña: 400000 })] })
  const c = calcularCostoEventoCajaEventos(e, datos({ movimientosCaja: [egreso("m3", "Pago saldo Deco - Ana y Juan", 400000)] }))
  assert.deepEqual(
    { seña: c.serviciosCalc[0].montoSeña, saldo: c.serviciosCalc[0].saldo, señaSinEgreso: c.serviciosCalc[0].señaSinEgreso, pagado: c.pagadoServicios },
    { seña: 400000, saldo: 400000, señaSinEgreso: true, pagado: 800000 },
  )
})

test("cocina pagada: cuenta lo que salió de la caja; el precio de hoy queda aparte", () => {
  // Hoy: 100 × 0,25 KG × $20.000 = $500.000; se pagó $450.000 con precios viejos
  const e = ev({ cocinaPagada: true })
  const c = calcularCostoEventoCajaEventos(e, datos({ movimientosCaja: [egreso("m4", "Pago menú - Ana y Juan", 450000)] }))
  assert.equal(c.costoCocinaHoy, 500000)
  assert.equal(c.costoCocina, 450000)
  assert.equal(c.pagadoCocina, 450000)
  assert.equal(c.fechaPagoCocina, "2026-09-01T15:00:00.000Z")
  assert.equal(c.costoTotalEvento, sumaRubros(c))
})

test("cocina sin pagar o pagada sin egreso: precio de hoy (como antes)", () => {
  assert.equal(calcularCostoEventoCajaEventos(ev(), datos()).costoCocina, 500000)
  const c = calcularCostoEventoCajaEventos(ev({ cocinaPagada: true }), datos())
  assert.equal(c.costoCocina, 500000)
  assert.equal(c.pagadoCocina, 500000)
})

test("el total del evento es la suma de los cuatro rubros y lo pagado nunca supera el costo", () => {
  const e = ev({
    cocinaPagada: true,
    servicios: [srv(FOTO, { estadoPago: "señado", montoSeña: 300000 }), srv(DECO)],
    personalEvento: [{ id: "pe1", personalId: "p1", nombre: "Laura", funcion: "Moza", monto: 60000, pagado: true }],
  })
  const c = calcularCostoEventoCajaEventos(e, datos({ movimientosCaja: [egreso("m4", "Pago menú - Casamiento", 450000)] }))
  assert.equal(c.costoTotalEvento, sumaRubros(c))
  assert.equal(c.costoTotalEvento, 450000 + 1000000 + 800000 + 60000)
  assert.equal(c.totalCubierto, 450000 + 300000 + 60000)
  assert.ok(c.totalCubierto <= c.costoTotalEvento)
})

test("archivar guarda lo pagado de cocina y el saldo sin egreso; el archivado lo respeta", () => {
  const e = ev({ cocinaPagada: true, servicios: [srv(DECO, { estadoPago: "pagado_total", pagado: true, montoSeña: 400000 })] })
  const d = datos({ movimientosCaja: [egreso("m4", "Pago menú - Ana y Juan", 450000)] })
  const foto = congelarCostosEvento(e, d)
  assert.equal(foto.montoPagadoCocina, 450000)
  assert.equal(foto.montoPagadoBarra, undefined)
  assert.equal(foto.serviciosCalc[0].saldo, 400000)
  const archivado = { ...e, estado: "completado", costosCalculados: { archivoCongelado: foto } }
  // Aunque después suban los precios, el archivado no se mueve
  const c = calcularCostoEventoCajaEventos(archivado, { ...d, insumos: [{ ...insumos[0], precioUnitario: 99999 }] })
  assert.equal(c.costoCocina, 450000)
  assert.equal(c.totalServicios, 800000)
})

test("archivado viejo (sin montoPagadoCocina): queda como antes", () => {
  const e = ev({ cocinaPagada: true })
  const foto = congelarCostosEvento(e, datos())
  delete foto.montoPagadoCocina
  const c = calcularCostoEventoCajaEventos({ ...e, estado: "completado", costosCalculados: { archivoCongelado: foto } }, datos())
  assert.equal(c.costoCocina, 500000)
})

test("ultimoEgresoEvento: el más reciente por fecha, de ese evento, sin confundir nombres parecidos", () => {
  const movs = [
    egreso("nuevo", "Pago saldo Torta - X", 2, "2026-09-02T10:00:00Z"),
    egreso("viejo", "Pago saldo Torta - X", 1, "2026-08-01T10:00:00Z"),
    egreso("otro", "Pago saldo Torta grande - X", 3, "2026-10-01T10:00:00Z"),
    { ...egreso("otroEvento", "Pago saldo Torta - X", 4, "2026-10-02T10:00:00Z"), eventoId: "ev2" },
    { ...egreso("ingreso", "Pago saldo Torta - X", 5, "2026-10-03T10:00:00Z"), tipo: "ingreso" },
  ]
  assert.equal(ultimoEgresoEvento(movs, "ev1", "Pago saldo Torta - ").id, "nuevo")
  assert.equal(ultimoEgresoEvento(movs, "ev1", "Pago saldo Flores - "), undefined)
  assert.equal(nombreEventoEnCaja({ nombre: "Casamiento", nombrePareja: "Ana y Juan" }), "Ana y Juan")
  assert.equal(nombreEventoEnCaja({ nombre: "Casamiento" }), "Casamiento")
})

test("porcentajeEntero: 100% solo si no falta nada", () => {
  assert.equal(porcentajeEntero(995, 1000), 99) // antes se redondeaba a 100
  assert.equal(porcentajeEntero(1000, 1000), 100)
  assert.equal(porcentajeEntero(999.999, 1000), 100) // centavos
  assert.equal(porcentajeEntero(2, 1000), 1) // algo pagado no es 0%
  assert.equal(porcentajeEntero(0, 1000), 0)
  assert.equal(porcentajeEntero(5, 0), 0)
})

test("resumenCobroCliente: seña + cuotas (con pagos parciales) y el recargo contra el precio", () => {
  const plan = { montoTotal: 20000000, modalidadPago: "sena", montoSena: 6000000 }
  const cuotas = [2500000, 2500000, 2500000, 2500000, 2500000, 2500000].map((monto, i) => ({
    monto,
    montoAcumulado: i < 2 ? monto : i === 2 ? 1000000 : 0,
  }))
  assert.deepEqual(resumenCobroCliente(plan, cuotas), {
    precioContrato: 20000000,
    seña: 6000000,
    totalACobrar: 21000000,
    ajuste: 1000000,
    cobrado: 12000000, // antes la cuota parcial no sumaba: 11.000.000
    faltaCobrar: 9000000,
    progreso: 57,
  })
  // Sin seña (pago en cuotas) y sin recargo
  const r = resumenCobroCliente({ montoTotal: 3000000, modalidadPago: "cuotas" }, [{ monto: 1500000, montoAcumulado: 1500000 }, { monto: 1500000, montoAcumulado: 0 }])
  assert.equal(r.seña, 0)
  assert.equal(r.ajuste, 0)
  assert.equal(r.progreso, 50)
})

test("saldoEsperaSeña: el saldo de un proveedor espera a que se pague la seña", () => {
  const { saldoEsperaSeña } = require("../lib/servicio-sueldo.ts")
  const cat = { servicios: [FOTO, DECO, { ...FOTO, id: "sinsena", porcentajeSeña: 0 }, { ...FOTO, id: "dj", sePagaComoSueldo: true }] }
  assert.equal(saldoEsperaSeña(srv(FOTO), cat), true) // sin seña pagada
  assert.equal(saldoEsperaSeña(srv(FOTO, { estadoPago: "señado", montoSeña: 300000 }), cat), false)
  assert.equal(saldoEsperaSeña(srv(FOTO, { estadoPago: "pagado_total", pagado: true }), cat), false)
  assert.equal(saldoEsperaSeña(srv({ id: "sinsena", nombre: "Sin seña" }), cat), false) // 0 % de seña
  assert.equal(saldoEsperaSeña(srv({ id: "dj", nombre: "DJ" }), cat), false) // se paga como sueldo
  assert.equal(saldoEsperaSeña(srv(FOTO, { pagado: true }), cat), false) // viejo, sin estadoPago
})
