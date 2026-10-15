const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")

// Ejecuta los módulos reales de TypeScript sin agregar dependencias de test.
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, ...args)
}
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    })
    module._compile(outputText, filename)
  }
}


const { diferenciaPagos, unidadesPagadas, leerRef, refFijo, refVariable } = require(path.join(root, "lib/pagos-caja-jazmines.ts"))
const { cambiosPagoDelMes } = require(path.join(root, "lib/pago-gasto-fijo.ts"))

const FECHA = "2026-10-14T15:00:00.000Z"
const sinEgresos = new Set()

function fijo(cambios = {}) {
  return {
    id: "fijo-1",
    concepto: "PRUEBA ALQUILER",
    monto: 650000,
    frecuencia: "Mensual",
    salon: "Casona",
    activo: true,
    esVariable: false,
    pagado: true,
    historialMontos: [{ id: "r-sep", mes: "2026-09", monto: 650000, montoAnterior: 650000, fecha: FECHA, pagado: true }],
    ...cambios,
  }
}
function repartido(cambios = {}) {
  return fijo({
    id: "rep-1",
    salon: null,
    monto: 1000000,
    distribucion: [
      { salon: "Quinta", porcentaje: 50, pagado: true },
      { salon: "Casona", porcentaje: 50, pagado: true },
    ],
    historialMontos: [{ id: "r-sep", mes: "2026-09", monto: 1000000, montoAnterior: 1000000, fecha: FECHA, pagado: true }],
    ...cambios,
  })
}
function variable(cambios = {}) {
  return { id: "var-1", concepto: "PRUEBA LIMPIEZA", monto: 80000, salon: "Quinta", activo: true, esVariable: true, pagado: false, ...cambios }
}
function pagar(gasto, mes, pagado = true, parte) {
  const reg = (gasto.historialMontos || []).find((r) => r.mes === mes)
  return { ...gasto, ...cambiosPagoDelMes(gasto, { mes, montoGeneral: reg?.monto ?? gasto.monto, pagado, parte, fechaISO: FECHA, nuevoId: `r-${mes}` }) }
}

test("pagar un mes de un gasto fijo crea un egreso con su salón y monto", () => {
  const antes = fijo()
  const despues = pagar(antes, "2026-10")
  const { altas, bajas } = diferenciaPagos(antes, despues, ["2026-10"], sinEgresos)
  assert.equal(bajas.length, 0)
  assert.equal(altas.length, 1)
  assert.equal(altas[0].ref, "gf:fijo-1:2026-10:Casona")
  assert.equal(altas[0].monto, 650000)
  assert.equal(altas[0].salon, "Casona")
  assert.match(altas[0].concepto, /PRUEBA ALQUILER \(octubre 2026\)/)
})

test("deshacer el pago borra su egreso y no toca otros meses", () => {
  const pagado = pagar(fijo(), "2026-10")
  const deshecho = pagar(pagado, "2026-10", false)
  const egresos = new Set([refFijo("fijo-1", "2026-10", "Casona"), refFijo("fijo-1", "2026-09", "Casona")])
  const { altas, bajas } = diferenciaPagos(pagado, deshecho, ["2026-10"], egresos)
  assert.equal(altas.length, 0)
  assert.deepEqual(bajas, ["gf:fijo-1:2026-10:Casona"])
})

test("deshacer un pago viejo que nunca descontó no devuelve plata", () => {
  const antes = fijo()
  const deshecho = pagar(antes, "2026-09", false)
  const { altas, bajas } = diferenciaPagos(antes, deshecho, ["2026-09"], sinEgresos)
  assert.equal(altas.length, 0)
  assert.equal(bajas.length, 0)
})

test("un pago que ya tiene egreso no se descuenta dos veces", () => {
  const antes = fijo()
  const despues = pagar(antes, "2026-10")
  const { altas } = diferenciaPagos(antes, despues, ["2026-10"], new Set([refFijo("fijo-1", "2026-10", "Casona")]))
  assert.equal(altas.length, 0)
})

test("repartido pagado desde un salón descuenta solo la parte de ese salón", () => {
  const antes = repartido()
  const despues = pagar(antes, "2026-10", true, { salon: "Quinta", porcentaje: 50 })
  const { altas, bajas } = diferenciaPagos(antes, despues, ["2026-10"], sinEgresos)
  assert.equal(bajas.length, 0)
  assert.equal(altas.length, 1)
  assert.equal(altas[0].salon, "Quinta")
  assert.equal(altas[0].monto, 500000)
  // Septiembre (pagado por los dos salones) no se toca al pasar a octubre.
  const sep = diferenciaPagos(antes, despues, ["2026-09"], new Set([refFijo("rep-1", "2026-09", "Quinta"), refFijo("rep-1", "2026-09", "Casona")]))
  assert.equal(sep.altas.length, 0)
  assert.equal(sep.bajas.length, 0)
})

test("repartido pagado desde Todos los salones descuenta cada parte en su salón", () => {
  const antes = repartido()
  const despues = pagar(antes, "2026-10")
  const { altas } = diferenciaPagos(antes, despues, ["2026-10"], sinEgresos)
  assert.deepEqual(
    altas.map((u) => [u.salon, u.monto]).sort(),
    [["Casona", 500000], ["Quinta", 500000]],
  )
})

test("gasto variable: pagar descuenta, despagar devuelve", () => {
  const antes = variable()
  const pagado = variable({ pagado: true })
  const alta = diferenciaPagos(antes, pagado, [], sinEgresos)
  assert.equal(alta.altas.length, 1)
  assert.equal(alta.altas[0].ref, "gv:var-1:Quinta")
  assert.equal(alta.altas[0].monto, 80000)
  const baja = diferenciaPagos(pagado, antes, [], new Set(["gv:var-1:Quinta"]))
  assert.deepEqual(baja.bajas, ["gv:var-1:Quinta"])
  assert.equal(baja.altas.length, 0)
})

test("gasto variable repartido descuenta una parte por salón", () => {
  const g = variable({ pagado: true, salon: null, monto: 180000, distribucion: [{ salon: "Casona", porcentaje: 50 }, { salon: "Quinta", porcentaje: 50 }] })
  const u = unidadesPagadas(g)
  assert.deepEqual(u.map((x) => [x.ref, x.monto]), [["gv:var-1:Casona", 90000], ["gv:var-1:Quinta", 90000]])
})

test("eliminar un gasto variable pagado borra su egreso", () => {
  const pagado = variable({ pagado: true })
  const { bajas } = diferenciaPagos(pagado, undefined, [], new Set(["gv:var-1:Quinta"]))
  assert.deepEqual(bajas, ["gv:var-1:Quinta"])
})

test("cambiar el monto de un variable pagado reemplaza el egreso solo si ya existía", () => {
  const antes = variable({ pagado: true })
  const despues = variable({ pagado: true, monto: 95000 })
  const con = diferenciaPagos(antes, despues, [], new Set(["gv:var-1:Quinta"]))
  assert.deepEqual(con.bajas, ["gv:var-1:Quinta"])
  assert.equal(con.altas[0].monto, 95000)
  const sin = diferenciaPagos(antes, despues, [], sinEgresos)
  assert.equal(sin.altas.length + sin.bajas.length, 0)
})

test("un gasto fijo sin meses tocados no genera nada", () => {
  const { altas, bajas } = diferenciaPagos(fijo(), fijo({ monto: 700000 }), [], sinEgresos)
  assert.equal(altas.length + bajas.length, 0)
})

test("leerRef devuelve el gasto y el mes", () => {
  assert.deepEqual(leerRef("gf:abc:2026-10:Quinta"), { gastoId: "abc", mes: "2026-10" })
  assert.deepEqual(leerRef(refVariable("xyz", "")), { gastoId: "xyz" })
  assert.equal(leerRef(null), null)
  assert.equal(leerRef("otra-cosa"), null)
})

test("un alta sin marcar no es un pago; un registro viejo sin el dato sí", () => {
  const { registroMarcadoPagado, pagoDelMesActual } = require(path.join(root, "lib/pago-gasto-fijo.ts"))
  assert.equal(registroMarcadoPagado({ nota: "Alta del gasto" }), false)
  assert.equal(registroMarcadoPagado({ nota: "Alta del gasto", pagado: true }), true)
  assert.equal(registroMarcadoPagado({ nota: "Carga histórica" }), true)
  assert.equal(registroMarcadoPagado({}), true)
  assert.equal(registroMarcadoPagado({ pagado: false }), false)
  // Caso real: "alquiler salon" dado de alta en septiembre, nunca pagado.
  const alquiler = fijo({
    id: "alq-1",
    salon: null,
    monto: 2603333,
    pagado: false,
    historialMontos: [{ id: "r-alta", mes: "2026-09", monto: 2603333, montoAnterior: 2603333, fecha: FECHA, nota: "Alta del gasto" }],
  })
  assert.equal(pagoDelMesActual(alquiler, undefined, "2026-09").pagado, false)
  assert.equal(unidadesPagadas(alquiler, ["2026-09"]).length, 0)
  // Pagarlo después sí descuenta (no estaba contado como pagado).
  const pagado = pagar(alquiler, "2026-09")
  const { altas } = diferenciaPagos(alquiler, pagado, ["2026-09"], sinEgresos)
  assert.equal(altas.length, 1)
  assert.equal(altas[0].monto, 2603333)
})

test("pagar o deshacer un mes ya conciliado (hasta agosto 2026) no toca la caja", () => {
  const { mesYaConciliado } = require(path.join(root, "lib/pagos-caja-jazmines.ts"))
  assert.equal(mesYaConciliado("2026-08"), true)
  assert.equal(mesYaConciliado("2026-01"), true)
  assert.equal(mesYaConciliado("2026-09"), false)
  const antes = fijo({ historialMontos: [] })
  const pagadoJulio = pagar(antes, "2026-07")
  const alta = diferenciaPagos(antes, pagadoJulio, ["2026-07"], sinEgresos)
  assert.equal(alta.altas.length + alta.bajas.length, 0)
  // Aunque tuviera un egreso viejo, deshacer julio no lo borra.
  const deshecho = pagar(pagadoJulio, "2026-07", false)
  const baja = diferenciaPagos(pagadoJulio, deshecho, ["2026-07"], new Set([refFijo("fijo-1", "2026-07", "Casona")]))
  assert.equal(baja.altas.length + baja.bajas.length, 0)
  // Septiembre sí descuenta.
  const sep = diferenciaPagos(antes, pagar(antes, "2026-09"), ["2026-09"], sinEgresos)
  assert.equal(sep.altas.length, 1)
})
