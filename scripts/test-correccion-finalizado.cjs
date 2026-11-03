// Corregir costos de un evento finalizado (pedido de Rodrigo, 3/11/2026;
// lib/correccion-finalizado.ts).
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const { fotoConCostoCorregido, fotoConPersonalPagado, accionCajaAlCorregir } = require("../lib/correccion-finalizado.ts")

const costos = () => ({
  observacionCostos: "nota",
  archivoCongelado: {
    fechaArchivado: "2026-10-20",
    comprasCocina: [{ insumoId: "x" }],
    personal: [{ id: "p1", nombre: "Juan", monto: 60000, pagado: false }, { id: "p2", nombre: "Ana", monto: 40000 }],
    serviciosCalc: [{ servicioId: "dj", montoSeña: 240000, saldo: 560000 }],
    totalServicios: 800000,
    totalPersonal: 100000,
  },
})

test("corrige el saldo de un servicio y recalcula el total de servicios", () => {
  const c = costos()
  const r = fotoConCostoCorregido(c, { rubro: "saldo", servicioId: "dj" }, 500000.004)
  assert.deepEqual(r.archivoCongelado.serviciosCalc, [{ servicioId: "dj", montoSeña: 240000, saldo: 500000 }])
  assert.equal(r.archivoCongelado.totalServicios, 740000)
  assert.equal(r.observacionCostos, "nota")
  assert.equal(c.archivoCongelado.serviciosCalc[0].saldo, 560000) // no toca el original
})

test("corrige un sueldo, el menú y la barra", () => {
  const r = fotoConCostoCorregido(costos(), { rubro: "sueldo", personalId: "p1" }, 75000)
  assert.equal(r.archivoCongelado.personal[0].monto, 75000)
  assert.equal(r.archivoCongelado.totalPersonal, 115000)
  assert.equal(fotoConCostoCorregido(costos(), { rubro: "cocina" }, 2500000).archivoCongelado.montoPagadoCocina, 2500000)
  assert.equal(fotoConCostoCorregido(costos(), { rubro: "barra" }, 984156).archivoCongelado.montoPagadoBarra, 984156)
})

test("sin foto, línea inexistente o monto inválido no corrige", () => {
  assert.equal(fotoConCostoCorregido({ observacionCostos: "x" }, { rubro: "cocina" }, 1), null)
  assert.equal(fotoConCostoCorregido(costos(), { rubro: "saldo", servicioId: "otro" }, 1), null)
  assert.equal(fotoConCostoCorregido(costos(), { rubro: "sueldo", personalId: "otro" }, 1), null)
  assert.equal(fotoConCostoCorregido(costos(), { rubro: "barra" }, -5), null)
  assert.equal(fotoConCostoCorregido(costos(), { rubro: "barra" }, NaN), null)
})

test("marca pagado el sueldo en la foto", () => {
  const r = fotoConPersonalPagado(costos(), "p2", true)
  assert.equal(r.archivoCongelado.personal[1].pagado, true)
  assert.equal(r.archivoCongelado.personal[0].pagado, false)
  assert.equal(fotoConPersonalPagado(costos(), "nadie", true), null)
})

test("qué pasa en la caja al corregir", () => {
  // Sin pagar: la caja no cambia.
  assert.deepEqual(accionCajaAlCorregir({ pagado: false, montoNuevo: 900000 }), { accion: "ninguna", diferencia: 0 })
  // Pagado $1.200.000 y era $1.000.000: el egreso baja y la caja recupera $200.000.
  assert.deepEqual(accionCajaAlCorregir({ pagado: true, egresoMonto: 1200000, montoNuevo: 1000000 }), { accion: "reemplazar", montoEgreso: 1000000, diferencia: -200000 })
  // Pagado de menos: sale la diferencia.
  assert.deepEqual(accionCajaAlCorregir({ pagado: true, egresoMonto: 500000, montoNuevo: 650000.5 }), { accion: "reemplazar", montoEgreso: 650000.5, diferencia: 150000.5 })
  // Igual: nada.
  assert.equal(accionCajaAlCorregir({ pagado: true, egresoMonto: 500000, montoNuevo: 500000.001 }).accion, "ninguna")
  // Marcado pagado sin egreso (datos viejos): la caja no cambia.
  assert.equal(accionCajaAlCorregir({ pagado: true, montoNuevo: 300000 }).accion, "sinEgreso")
})

test("menú con pagos a proveedores a cuenta", () => {
  // $1.000.000 a proveedores + $1.500.000 entero; el costo real era $2.200.000.
  assert.deepEqual(accionCajaAlCorregir({ pagado: true, egresoMonto: 1500000, pagadoAparte: 1000000, montoNuevo: 2200000 }), { accion: "reemplazar", montoEgreso: 1200000, diferencia: -300000 })
  // Solo proveedores ($1.000.000) y el costo era $1.300.000: se agrega un egreso de $300.000.
  assert.deepEqual(accionCajaAlCorregir({ pagado: true, pagadoAparte: 1000000, montoNuevo: 1300000 }), { accion: "agregar", montoEgreso: 300000, diferencia: 300000 })
  // Menos que lo dado a proveedores: no se puede desde acá.
  assert.deepEqual(accionCajaAlCorregir({ pagado: true, egresoMonto: 200000, pagadoAparte: 1000000, montoNuevo: 800000 }), { accion: "imposible", minimo: 1000000, diferencia: 0 })
})

const { fotoConInsumoCorregido } = require("../lib/correccion-finalizado.ts")

const conCompras = (extra = {}) => ({
  archivoCongelado: {
    comprasCocina: [
      { insumoId: "lima", insumo: { descripcion: "LIMA", unidad: "KG" }, cantidadNecesaria: 30, costoMateriaPrima: 18000000 },
      { insumoId: "bife", insumo: { descripcion: "BIFE", unidad: "KG" }, cantidadNecesaria: 200, costoMateriaPrima: 3000000 },
    ],
    comprasBarra: [{ insumoBarraId: "ron", cantidadNecesaria: 40, costoMateriaPrima: 1200000 }],
    personal: [],
    serviciosCalc: [],
    ...extra,
  },
})

test("corrige un insumo de la cocina: solo esa fila, y el total es la suma", () => {
  const c = conCompras()
  const r = fotoConInsumoCorregido(c, "cocina", "lima", 0.9, 600)
  assert.equal(r.costoLinea, 540)
  assert.equal(r.totalAntes, 21000000)
  assert.equal(r.totalNuevo, 3000540)
  const lista = r.costosCalculados.archivoCongelado.comprasCocina
  assert.equal(lista[0].cantidadNecesaria, 0.9)
  assert.equal(lista[0].insumo.descripcion, "LIMA")
  assert.equal(lista[1].costoMateriaPrima, 3000000)
  assert.equal(r.costosCalculados.archivoCongelado.montoPagadoCocina, 3000540)
  assert.equal(c.archivoCongelado.comprasCocina[0].cantidadNecesaria, 30) // no toca el original
})

test("con el rubro ya pagado, el total de antes es lo pagado", () => {
  const r = fotoConInsumoCorregido(conCompras({ montoPagadoBarra: 900000 }), "barra", "ron", 30, 25000)
  assert.equal(r.totalAntes, 900000)
  assert.equal(r.totalNuevo, 750000)
  assert.equal(r.costosCalculados.archivoCongelado.montoPagadoBarra, 750000)
})

test("insumo inexistente, sin foto o números inválidos no corrige", () => {
  assert.equal(fotoConInsumoCorregido(conCompras(), "cocina", "nada", 1, 1), null)
  assert.equal(fotoConInsumoCorregido(conCompras(), "barra", "lima", 1, 1), null)
  assert.equal(fotoConInsumoCorregido({}, "cocina", "lima", 1, 1), null)
  assert.equal(fotoConInsumoCorregido(conCompras(), "cocina", "lima", -1, 1), null)
  assert.equal(fotoConInsumoCorregido(conCompras(), "cocina", "lima", 1, NaN), null)
})
