const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, '../lib/chat-ia-errores.ts'), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const loaded = { exports: {} }
new Function('module', 'exports', js)(loaded, loaded.exports)
const { mensajeErrorChatIA } = loaded.exports

const err = (name, message, extra = {}) => Object.assign(new Error(message), { name, ...extra })
// generateText envuelve el último error en un RetryError
const reintento = (ultimo) => err('AI_RetryError', `Failed after 3 attempts. Last error: ${ultimo.message}`, { lastError: ultimo })

test('falta de tarjeta en Vercel', () => {
  const r = mensajeErrorChatIA(err('GatewayInternalServerError', 'AI Gateway requires a valid credit card on file'))
  assert.equal(r.status, 503)
  assert.match(r.mensaje, /tarjeta/)
})

test('sin autenticación: el proyecto no está conectado al AI Gateway', () => {
  const r = mensajeErrorChatIA(err('GatewayAuthenticationError', 'AI Gateway authentication failed: No authentication provided.'))
  assert.equal(r.status, 503)
  assert.match(r.mensaje, /AI_GATEWAY_API_KEY/)
})

test('créditos agotados, aunque venga envuelto en reintentos', () => {
  const r = mensajeErrorChatIA(reintento(err('GatewayInternalServerError', 'Insufficient funds')))
  assert.match(r.mensaje, /créditos/)
})

test('límite de uso y modelo inexistente', () => {
  assert.match(mensajeErrorChatIA(reintento(err('GatewayRateLimitError', 'Too many requests'))).mensaje, /saturada/)
  assert.match(mensajeErrorChatIA(err('GatewayModelNotFoundError', 'Model x not found')).mensaje, /modelo/)
})

test('error desconocido: mensaje genérico con detalle corto', () => {
  const r = mensajeErrorChatIA(err('Error', 'algo raro '.repeat(50)))
  assert.equal(r.status, 500)
  assert.match(r.mensaje, /^No pude generar la respuesta\. Probá de nuevo\. \(Detalle: algo raro/)
  assert.ok(r.mensaje.length < 230)
  assert.equal(mensajeErrorChatIA(undefined).mensaje, 'No pude generar la respuesta. Probá de nuevo.')
})
