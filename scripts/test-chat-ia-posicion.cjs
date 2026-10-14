// Botón flotante de la IA: arranca arriba a la izquierda (al lado del panel
// lateral), se puede arrastrar sin salirse de la pantalla y el chat se abre
// pegado al botón, hacia donde haya lugar.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/chat-ia-posicion.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { posicionInicialBoton, ajustarBoton, posicionPanel, leerPosicionGuardada, TAM_BOTON_IA, MARGEN_IA } = loaded.exports

const compu = { ancho: 1366, alto: 768 }
const celu = { ancho: 390, alto: 844 }
const dentro = (p, pantalla) =>
  p.x >= MARGEN_IA && p.y >= MARGEN_IA && p.x + p.ancho <= pantalla.ancho - MARGEN_IA + 0.001 && p.y + p.alto <= pantalla.alto - MARGEN_IA + 0.001

test('arranca arriba a la izquierda, a la derecha del panel lateral', () => {
  // Panel lateral abierto en la compu: 224 px (w-56).
  assert.deepEqual(posicionInicialBoton(224), { x: 236, y: 12 })
  // Panel cerrado o celular: pegado al borde.
  assert.deepEqual(posicionInicialBoton(0), { x: 12, y: 12 })
})

test('al arrastrar no se sale de la pantalla', () => {
  assert.deepEqual(ajustarBoton({ x: -50, y: -10 }, compu), { x: 12, y: 12 })
  assert.deepEqual(ajustarBoton({ x: 5000, y: 5000 }, compu), { x: 1366 - TAM_BOTON_IA - 12, y: 768 - TAM_BOTON_IA - 12 })
  assert.deepEqual(ajustarBoton({ x: 600, y: 300 }, compu), { x: 600, y: 300 })
  // Guardado en la compu y abierto en el celu: vuelve a entrar.
  assert.deepEqual(ajustarBoton({ x: 1200, y: 700 }, celu), { x: 390 - TAM_BOTON_IA - 12, y: 700 })
})

test('el chat se abre debajo y a la derecha si el botón está arriba a la izquierda', () => {
  const p = posicionPanel({ x: 236, y: 12 }, compu)
  assert.equal(p.x, 236)
  assert.equal(p.y, 12 + TAM_BOTON_IA + 8)
  assert.equal(p.ancho, 384)
  assert.ok(dentro(p, compu))
})

test('el chat se abre arriba y hacia la izquierda si el botón está abajo a la derecha', () => {
  const b = { x: 1300, y: 700 }
  const p = posicionPanel(b, compu)
  assert.equal(p.x + p.ancho, b.x + TAM_BOTON_IA)
  assert.equal(p.y + p.alto, b.y - 8)
  assert.ok(dentro(p, compu))
})

test('en el celular el chat entra entero desde cualquier esquina', () => {
  for (const b of [{ x: 12, y: 12 }, { x: 330, y: 12 }, { x: 12, y: 784 }, { x: 330, y: 784 }, { x: 170, y: 400 }]) {
    const p = posicionPanel(b, celu)
    assert.ok(dentro(p, celu), JSON.stringify({ b, p }))
    assert.equal(p.ancho, 390 - 24)
  }
})

test('posición guardada: se ignora si está rota', () => {
  assert.deepEqual(leerPosicionGuardada('{"x":10,"y":20}'), { x: 10, y: 20 })
  assert.equal(leerPosicionGuardada(null), null)
  assert.equal(leerPosicionGuardada('basura'), null)
  assert.equal(leerPosicionGuardada('{"x":"a","y":2}'), null)
  assert.equal(leerPosicionGuardada('{"x":null,"y":2}'), null)
})
