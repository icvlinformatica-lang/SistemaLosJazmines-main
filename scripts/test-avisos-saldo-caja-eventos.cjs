// Avisos del saldo de Caja Eventos (pedido de Rodrigo, 2/11/2026): cuotas
// anotadas de más, cobros enteros a Caja Eventos y finalizados sin pagar el
// menú o la barra (lib/avisos-saldo-caja-eventos.ts). Solo para mostrar.
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const resolver = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolver.call(this, request.startsWith("@/") ? path.join(__dirname, "..", request.slice(2)) : request, ...args)
}
require.extensions[".ts"] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)

const { avisosSaldoCajaEventos } = require("../lib/avisos-saldo-caja-eventos.ts")

let n = 0
const mov = (eventoId, tipo, caja, concepto, monto, fecha = "2026-08-04", salon = "Quinta") =>
  ({ id: `m${++n}`, eventoId, tipo, cajaDestino: caja, concepto, monto, fecha, salon })

test("una cuota con más filas que pagos se avisa; un cobro en partes no", () => {
  const eventos = [
    { id: "maxi", nombrePareja: "MAXI Y AILEN", fecha: "2027-09-24", salon: "Quinta", pagos: [{ numeroCuota: 1 }] },
    { id: "partes", nombrePareja: "PARTES", fecha: "2027-01-01", salon: "Quinta", pagos: [{ numeroCuota: 2 }, { numeroCuota: 2 }] },
    { id: "rapido", nombrePareja: "RAPIDO", fecha: "2027-02-01", salon: "Quinta", pagos: [] },
  ]
  const r = avisosSaldoCajaEventos(
    [
      mov("maxi", "ingreso", "caja_eventos", "Cuota 1 - MAXI Y AILEN (Caja Eventos)", 287147),
      mov("maxi", "ingreso", "caja_eventos", "Cuota 1 - MAXI Y AILEN (Caja Eventos)", 287147),
      mov("partes", "ingreso", "caja_eventos", "Cuota 2 #a - PARTES (Caja Eventos)", 100),
      mov("partes", "ingreso", "caja_eventos", "Cuota 2 #b - PARTES (Caja Eventos)", 200),
      // Marcada con el botón rápido viejo: una fila, sin pago. No es repetida.
      mov("rapido", "ingreso", "caja_eventos", "Cuota 1 - RAPIDO (Caja Eventos)", 500),
    ],
    eventos,
    "Quinta",
  )
  assert.equal(r.cuotasRepetidas.length, 1)
  assert.deepEqual(r.cuotasRepetidas[0], {
    eventoId: "maxi", nombre: "MAXI Y AILEN", fechaEvento: "2027-09-24", numeroCuota: 1, montos: [287147, 287147], pagos: 1,
  })
})

test("cobros que fueron enteros a Caja Eventos: suma señas y cuotas, ignora los repartidos", () => {
  const eventos = [
    { id: "nayla", nombrePareja: "Nayla", fecha: "2028-05-27", salon: "Quinta" },
    { id: "rep", nombrePareja: "Repartido", fecha: "2027-01-01", salon: "Quinta" },
  ]
  const r = avisosSaldoCajaEventos(
    [
      mov("nayla", "ingreso", "caja_eventos", "Cuota 1 #x - Nayla (Caja Eventos)", 10500000),
      mov("nayla", "ingreso", "caja_eventos", "Seña - Nayla (Caja Eventos)", 1000.4),
      mov("rep", "ingreso", "caja_eventos", "Cuota 1 - Repartido (Caja Eventos)", 300),
      mov("rep", "ingreso", "caja_jazmines", "Cuota 1 - Repartido (Caja Jazmines)", 700),
      // Un ingreso que no es cobro (ajuste) no cuenta.
      mov(null, "ingreso", "caja_eventos", "Ajuste de conciliación", 999),
    ],
    eventos,
    "Quinta",
  )
  assert.deepEqual(r.todoACajaEventos.map((x) => [x.nombre, x.monto]), [["Nayla", 10501000.4]])
  assert.equal(r.totalTodoACajaEventos, 10501000.4)
})

test("el salón filtra: lo de otro salón no aparece", () => {
  const r = avisosSaldoCajaEventos(
    [mov("c", "ingreso", "caja_eventos", "Seña - C (Caja Eventos)", 50, "2026-08-01", "Casona")],
    [{ id: "c", nombrePareja: "C", salon: "Casona" }],
    "Quinta",
  )
  assert.deepEqual(r.todoACajaEventos, [])
  const todos = avisosSaldoCajaEventos(
    [mov("c", "ingreso", "caja_eventos", "Seña - C (Caja Eventos)", 50, "2026-08-01", "Casona")],
    [{ id: "c", nombrePareja: "C", salon: "Casona" }],
    null,
  )
  assert.equal(todos.todoACajaEventos.length, 1)
})

test("finalizados con menú o barra sin pago en Caja Eventos", () => {
  const eventos = [
    { id: "a", nombrePareja: "SIN PAGAR", fecha: "2026-09-25", salon: "Quinta", estado: "completado", recetasAdultos: ["r1"], barras: [{ coctelesIncluidos: ["c1"] }] },
    { id: "b", nombrePareja: "PAGADO", fecha: "2026-10-17", salon: "Quinta", estado: "completado", recetasAdultos: ["r1"], barras: [{ coctelesIncluidos: ["c1"] }] },
    { id: "c", nombrePareja: "PROVEEDOR", fecha: "2026-10-20", salon: "Quinta", estado: "completado", recetasAdultos: ["r1"], barras: [] },
    { id: "d", nombrePareja: "PENDIENTE", fecha: "2026-12-01", salon: "Quinta", estado: "pendiente", recetasAdultos: ["r1"] },
    { id: "e", nombrePareja: "SIN MENU", fecha: "2026-09-01", salon: "Quinta", estado: "completado", barras: [{ coctelesIncluidos: [] }] },
  ]
  const r = avisosSaldoCajaEventos(
    [
      mov("b", "egreso", "caja_eventos", "Pago menú - PAGADO", 678798),
      mov("b", "egreso", "caja_eventos", "Pago barra - PAGADO", 984156),
      mov("c", "egreso", "caja_eventos", "Pago menú (Carnicería) a cuenta - PROVEEDOR", 1000),
    ],
    eventos,
    "Quinta",
  )
  assert.deepEqual(r.finalizadosSinPagar, [
    { eventoId: "a", nombre: "SIN PAGAR", fechaEvento: "2026-09-25", menu: true, barra: true },
  ])
})
