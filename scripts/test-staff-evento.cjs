// Staff externo: horario, servicio resaltado, notas por oficio y cronograma.
// Correr: node --test scripts/test-staff-evento.cjs
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const ts = require("typescript")
require.extensions[".ts"] = (mod, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  mod._compile(out.outputText, filename)
}
const s = require("../lib/staff-evento.ts")

test("horario: inicio y fin, solo uno o ninguno", () => {
  assert.equal(s.textoHorario("21:00", "05:00"), "de 21:00 a 05:00")
  assert.equal(s.textoHorario("21:00", ""), "desde las 21:00")
  assert.equal(s.textoHorario(null, "05:00"), "hasta las 05:00")
  assert.equal(s.textoHorario(undefined, "  "), "")
})

test("horaValida: normaliza y rechaza lo que no es hora", () => {
  assert.equal(s.horaValida("9:30"), "09:30")
  assert.equal(s.horaValida("23:59"), "23:59")
  assert.equal(s.horaValida("24:00"), null)
  assert.equal(s.horaValida("21hs"), null)
  assert.equal(s.horaValida(2100), null)
})

test("servicio resaltado: el DJ ve el suyo (nombre real del catálogo)", () => {
  assert.equal(s.esServicioDestacado("dj", "DJ, SONIDO, LUCES Y HUMO"), true)
  assert.equal(s.esServicioDestacado("dj", "PANTALLA LED"), false)
  assert.equal(s.esServicioDestacado("dj", "DJANGO"), false)
})

test("servicio resaltado: los de siempre siguen igual", () => {
  assert.equal(s.esServicioDestacado("fotografo", "FOTOGRAFIA 2027"), true)
  assert.equal(s.esServicioDestacado("fotografo", "FOTO  + VIDEO"), true)
  assert.equal(s.esServicioDestacado("fotografo", "FOTO-VIDEO 2027"), true)
  assert.equal(s.esServicioDestacado("vestido", "VESTIDO 2028"), true)
  assert.equal(s.esServicioDestacado("pantalla", "PANTALLA LED"), true)
  assert.equal(s.esServicioDestacado("pantalla", "PISTA LED"), false)
  assert.equal(s.esServicioDestacado("barra", "DJ, SONIDO, LUCES Y HUMO"), false)
})

test("servicio resaltado: Coordinación los ve todos", () => {
  assert.equal(s.esServicioDestacado("coordinacion", "MESA DULCE Y TORTA"), true)
})

test("notas por oficio: se guardan solo oficios conocidos y sin vacías", () => {
  assert.deepEqual(s.normalizarNotasStaffPerfil({ dj: "  canción de entrada  ", fotografo: "", cocina: "x", vestido: 3 }), { dj: "canción de entrada" })
  assert.deepEqual(s.normalizarNotasStaffPerfil('{"pantalla":"video"}'), { pantalla: "video" })
  assert.deepEqual(s.normalizarNotasStaffPerfil("no es json"), {})
  assert.deepEqual(s.normalizarNotasStaffPerfil(null), {})
  assert.deepEqual(s.normalizarNotasStaffPerfil(["dj"]), {})
  assert.equal(s.normalizarNotasStaffPerfil({ dj: "x".repeat(5000) }).dj.length, 2000)
})

test("notas por oficio: cada uno ve la general y la suya, no la de otro", () => {
  const notas = { dj: "Entrada con Coldplay", fotografo: "Foto con abuelos" }
  const dj = s.notasParaPerfil("dj", "Llegar 20:00", notas)
  assert.deepEqual(dj.map((n) => n.titulo), ["Para todos", "Para DJ"])
  assert.equal(dj[1].propia, true)
  const vestido = s.notasParaPerfil("vestido", "Llegar 20:00", notas)
  assert.deepEqual(vestido.map((n) => n.titulo), ["Para todos"])
  const barra = s.notasParaPerfil("barra", "", notas)
  assert.deepEqual(barra, [])
})

test("notas por oficio: Coordinación ve todas", () => {
  const notas = { dj: "a", fotografo: "b", coordinacion: "c" }
  const c = s.notasParaPerfil("coordinacion", "general", notas)
  assert.deepEqual(c.map((n) => n.titulo), ["Para todos", "Para Coordinación", "Para DJ", "Para Fotógrafo"])
  assert.deepEqual(c.filter((n) => n.propia).map((n) => n.titulo), ["Para Coordinación"])
})

test("cronograma: orden de la noche, las 02:00 van después de las 23:00", () => {
  const items = [{ hora: "02:00" }, { hora: "21:00" }, { hora: "23:30" }, { hora: "20:00" }]
  assert.deepEqual(s.ordenarCronograma(items, "21:00").map((i) => i.hora), ["20:00", "21:00", "23:30", "02:00"])
  // Sin hora de inicio: orden del reloj
  assert.deepEqual(s.ordenarCronograma(items, null).map((i) => i.hora), ["02:00", "20:00", "21:00", "23:30"])
  // Evento de día: nada pasa de medianoche
  assert.deepEqual(s.ordenarCronograma([{ hora: "15:00" }, { hora: "12:00" }], "12:00").map((i) => i.hora), ["12:00", "15:00"])
})

test("cronograma: normalizar descarta líneas sin hora o sin texto y oficios inventados", () => {
  const r = s.normalizarCronograma(
    [
      { id: "a", hora: "22:30", momento: " Entrada ", perfiles: ["dj", "cocina", "fotografo"] },
      { id: "b", hora: "25:00", momento: "mal" },
      { id: "c", hora: "23:00", momento: "  " },
      { id: "a", hora: "21:00", momento: "Recepción", nota: "  en el jardín " },
      "basura",
    ],
    "21:00",
  )
  assert.equal(r.length, 2)
  assert.equal(r[0].momento, "Recepción")
  assert.equal(r[0].nota, "en el jardín")
  assert.notEqual(r[0].id, "a") // id repetido: se le da otro
  assert.deepEqual(r[1], { id: "a", hora: "22:30", momento: "Entrada", perfiles: ["dj", "fotografo"] })
  assert.deepEqual(s.normalizarCronograma("no es json"), [])
  assert.deepEqual(s.normalizarCronograma(null), [])
})

test("cronograma: máximo 40 líneas", () => {
  const muchas = Array.from({ length: 60 }, (_, i) => ({ id: `x${i}`, hora: "22:00", momento: `m${i}` }))
  assert.equal(s.normalizarCronograma(muchas).length, 40)
})

test("cronograma sugerido: casamiento desde la hora de inicio, pasando medianoche", () => {
  let n = 0
  const c = s.cronogramaSugerido("Casamiento", "21:30", () => `id${++n}`)
  assert.equal(c[0].hora, "21:30")
  assert.equal(c[0].momento, "Recepción de invitados")
  assert.ok(c.some((m) => m.momento === "Entrada de los novios" && m.hora === "22:30"))
  assert.equal(c[c.length - 1].hora, "02:30")
  assert.equal(new Set(c.map((m) => m.id)).size, c.length)
})

test("cronograma sugerido: 15 tal como está en la base (sin eñe) y uno genérico", () => {
  const quince = s.cronogramaSugerido("Cumpleanos de 15", "21:00")
  assert.ok(quince.some((m) => m.momento === "Entrada de la quinceañera"))
  const otro = s.cronogramaSugerido("Empresarial", null)
  assert.equal(otro[0].hora, "21:00")
  assert.ok(otro.some((m) => m.momento === "Bienvenida"))
})

test("cronograma: línea del perfil", () => {
  const m = { id: "1", hora: "22:00", momento: "Vals", perfiles: ["dj"] }
  assert.equal(s.esMomentoDelPerfil(m, "dj"), true)
  assert.equal(s.esMomentoDelPerfil(m, "fotografo"), false)
  assert.equal(s.esMomentoDelPerfil(m, "administracion"), false)
})
