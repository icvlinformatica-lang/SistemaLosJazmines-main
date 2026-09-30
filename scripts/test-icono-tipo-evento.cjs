const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/icono-tipo-evento.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { iconoTipoEvento, emojiTipoEvento, referenciaTiposEvento } = loaded.exports

test('los tipos como los declara el código, con eñe', () => {
  assert.equal(emojiTipoEvento('Cumpleaños de 15'), '👑')
  assert.equal(emojiTipoEvento('Casamiento'), '💍')
  assert.equal(emojiTipoEvento('Empresarial'), '💼')
  assert.equal(emojiTipoEvento('Bautismo'), '🕊️')
  assert.equal(emojiTipoEvento('Cumpleaños'), '🎂')
})

test('los tipos como están REALMENTE guardados en la base, sin eñe', () => {
  // 113 de los 144 eventos tienen este valor exacto: si esto falla, el
  // calendario muestra el emoji genérico en casi todas las fiestas.
  assert.equal(emojiTipoEvento('Cumpleanos de 15'), '👑')
  assert.equal(emojiTipoEvento('Cumpleanos'), '🎂')
  assert.equal(emojiTipoEvento('Otro'), '🎉')
})

test('los 15 no se confunden con un cumpleaños común', () => {
  assert.equal(iconoTipoEvento('Cumpleanos de 15').etiqueta, 'Cumpleaños de 15')
  assert.equal(iconoTipoEvento('Cumpleaños de 15').etiqueta, 'Cumpleaños de 15')
  assert.notEqual(emojiTipoEvento('Cumpleanos de 15'), emojiTipoEvento('Cumpleanos'))
})

test('no importan mayúsculas, espacios de más ni acentos sueltos', () => {
  for (const v of ['CASAMIENTO', '  casamiento  ', 'Casamiento', 'cAsAmIeNtO']) {
    assert.equal(emojiTipoEvento(v), '💍', v)
  }
  assert.equal(emojiTipoEvento('cumpleanos  de  15'), '👑')
})

test('un evento sin tipo cargado igual muestra algo', () => {
  for (const v of [null, undefined, '', '   ']) {
    assert.equal(emojiTipoEvento(v), '🎉', String(v))
    assert.equal(iconoTipoEvento(v).etiqueta, 'Otro', String(v))
  }
})

test('un tipo que nadie previó cae en el genérico, no rompe', () => {
  assert.deepEqual(iconoTipoEvento('Fiesta de la cerveza'), { emoji: '🎉', etiqueta: 'Otro' })
})

test('cada tipo tiene su propio símbolo, no se repiten', () => {
  const emojis = referenciaTiposEvento().map((t) => t.emoji)
  assert.equal(new Set(emojis).size, emojis.length, 'dos tipos comparten emoji')
  assert.equal(emojis.length, 6, 'los 5 tipos conocidos más "Otro"')
})

test('la referencia sirve para dibujar la leyenda del calendario', () => {
  const ref = referenciaTiposEvento()
  assert.ok(ref.every((t) => t.emoji && t.etiqueta))
  assert.equal(ref[ref.length - 1].etiqueta, 'Otro', '"Otro" va al final')
})
