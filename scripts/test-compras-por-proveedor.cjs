// Filtro Menú → Proveedor de "Por pagar" en Caja Eventos (lib/compras-por-proveedor.ts).
// Correr: node --test scripts/test-compras-por-proveedor.cjs
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
const { claveProveedor, proveedoresDeCompras, etiquetasProveedores, comprasDeProveedor, SIN_PROVEEDOR } = require("../lib/compras-por-proveedor.ts")
const { calcularComprasSegmentadas } = require("../lib/store.ts")
const { calcularCajaEventos } = require("../lib/hooks/use-caja-eventos.ts")
const { filtrarEgresos, FILTRO_EGRESOS_INICIAL } = require("../components/filtros-egresos.tsx")

// Almacén: carne de "Grido" escrito de dos formas, papa de JOSE, sal sin proveedor.
const VACIO = { id: "vacio", codigo: "I1", descripcion: "VACIO", unidad: "KG", stockActual: 0, precioUnitario: 10000, proveedor: "Grido" }
const ENTRANA = { id: "entrana", codigo: "I2", descripcion: "ENTRAÑA", unidad: "KG", stockActual: 50, precioUnitario: 15000, proveedor: "  GRIDO " }
const PAPA = { id: "papa", codigo: "I3", descripcion: "PAPA", unidad: "KG", stockActual: 0, precioUnitario: 1000, proveedor: "José" }
const SAL = { id: "sal", codigo: "I4", descripcion: "SAL", unidad: "KG", stockActual: 0, precioUnitario: 500, proveedor: "" }
const insumos = [VACIO, ENTRANA, PAPA, SAL]
const ing = (insumoId, cantidad) => ({ insumoId, detalleCorte: "", cantidadBasePorPersona: cantidad, unidadReceta: "KG" })
const ASADO = { id: "asado", nombre: "Asado", categoria: "Plato Principal", insumos: [ing("vacio", 0.3), ing("papa", 0.2), ing("sal", 0.01)] }
const ENTRADA = { id: "entrada", nombre: "Entraña", categoria: "Entrada", insumos: [ing("entrana", 0.1)] }
const recetas = [ASADO, ENTRADA]
const ev = (id, adultos, recetasAdultos, patch = {}) => ({ id, nombre: `Evento ${id}`, salon: "Quinta", fecha: "2026-11-20", estado: "pendiente", adultos, adolescentes: 0, ninos: 0, personasDietasEspeciales: 0, recetasAdultos, recetasAdolescentes: [], recetasNinos: [], recetasDietasEspeciales: [], barras: [], servicios: [], personalEvento: [], ...patch })
const A = ev("a", 100, ["asado", "entrada"])
const B = ev("b", 50, ["asado"])
const C = ev("c", 80, ["entrada"], { salon: "Casona" })
const menu = (e) => ({ eventoId: e.id, eventoNombre: e.nombre, eventoFecha: e.fecha, compras: calcularComprasSegmentadas(e, recetas, insumos) })

test("la clave no mira mayúsculas, tildes ni espacios; vacío es sin proveedor", () => {
  assert.equal(claveProveedor("Grido"), "GRIDO")
  assert.equal(claveProveedor("  GRido "), "GRIDO")
  assert.equal(claveProveedor("José"), "JOSE")
  assert.equal(claveProveedor("SERGIO   VDC"), "SERGIO VDC")
  assert.equal(claveProveedor(""), SIN_PROVEEDOR)
  assert.equal(claveProveedor(undefined), SIN_PROVEEDOR)
})

test("el nombre a mostrar es la forma más repetida", () => {
  const et = etiquetasProveedores([{ proveedor: "grido" }, { proveedor: "Grido" }, { proveedor: "Grido" }, { proveedor: "" }])
  assert.equal(et.get("GRIDO"), "Grido")
  assert.equal(et.get(SIN_PROVEEDOR), "Sin proveedor")
  // A igualdad, la que tiene mayúsculas.
  assert.equal(etiquetasProveedores([{ proveedor: "grido" }, { proveedor: "Grido" }]).get("GRIDO"), "Grido")
})

test("proveedores de un menú", () => {
  assert.deepEqual([...proveedoresDeCompras(menu(A).compras)].sort(), ["GRIDO", "JOSE", SIN_PROVEEDOR])
  assert.deepEqual([...proveedoresDeCompras(menu(C).compras)], ["GRIDO"])
})

test("suma la carne de Grido de todos los eventos, en pesos, sin descontar stock", () => {
  const r = comprasDeProveedor([menu(A), menu(B), menu(C)], "GRIDO")
  // Vacío: (100 + 50) × 0,3 kg = 45 kg × $10.000 = $450.000
  // Entraña: (100 + 80) × 0,1 kg = 18 kg × $15.000 = $270.000 (hay 50 kg de stock, igual cuenta: es lo que pide el menú)
  assert.deepEqual(
    r.insumos.map((i) => [i.descripcion, i.cantidad, i.unidad, i.costo, i.eventos]),
    [["VACIO", 45, "KG", 450000, 2], ["ENTRAÑA", 18, "KG", 270000, 2]],
  )
  assert.equal(r.total, 720000)
  assert.deepEqual(r.porEvento.map((e) => [e.eventoId, e.costo]), [["a", 450000], ["b", 150000], ["c", 120000]])
})

test("un evento sin nada del proveedor no aparece", () => {
  const r = comprasDeProveedor([menu(A), menu(C)], "JOSE")
  assert.deepEqual(r.porEvento.map((e) => e.eventoId), ["a"])
  assert.equal(r.total, 20000) // 100 × 0,2 kg × $1.000
})

test("lo del proveedor más lo de los demás da el monto del menú en Caja Eventos", () => {
  const state = { eventos: [A], movimientosCaja: [], pagosPersonal: [], personal: [], servicios: [], recetas, insumos, insumosBarra: [], cocteles: [] }
  const egMenu = calcularCajaEventos(state, undefined, new Date("2026-10-01T12:00:00")).egresosPendientes.find((e) => e.tipo === "menu")
  const m = [menu(A)]
  const suma = ["GRIDO", "JOSE", SIN_PROVEEDOR].reduce((s, p) => s + comprasDeProveedor(m, p).total, 0)
  assert.ok(Math.abs(suma - egMenu.monto) < 0.01, `${suma} vs ${egMenu.monto}`)
})

test("filtrarEgresos: Menú + proveedor deja solo los menús que llevan algo de él", () => {
  const egresos = [A, B, C].map((e) => ({ id: `${e.id}-menu`, eventoId: e.id, eventoNombre: e.nombre, salon: e.salon, servicioNombre: "Menú del evento", tipo: "menu", monto: 1, fechaVencimiento: "2026-11-06", diasRestantes: 30, estadoPago: "saldo_pendiente" }))
  const provs = new Map([A, B, C].map((e) => [e.id, proveedoresDeCompras(menu(e).compras)]))
  const ids = (f) => filtrarEgresos(egresos, { ...FILTRO_EGRESOS_INICIAL, ...f }, provs).map((e) => e.eventoId)
  assert.deepEqual(ids({ tipo: "menu", sub: "JOSE" }), ["a", "b"])
  assert.deepEqual(ids({ tipo: "menu", sub: "GRIDO", salon: "Quinta" }), ["a", "b"])
  assert.deepEqual(ids({ tipo: "menu", sub: "GRIDO" }), ["a", "b", "c"])
  assert.deepEqual(ids({ tipo: "menu", sub: null }), ["a", "b", "c"])
  // Sin el mapa (llamadas viejas), un proveedor elegido no deja pasar nada en vez de mostrar todo.
  assert.deepEqual(filtrarEgresos(egresos, { ...FILTRO_EGRESOS_INICIAL, tipo: "menu", sub: "JOSE" }).length, 0)
})
