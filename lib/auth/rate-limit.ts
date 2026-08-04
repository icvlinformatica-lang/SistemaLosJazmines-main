// Limitador de intentos en memoria para frenar fuerza bruta sobre los PINs.
// Nota: es por-instancia (no compartido entre instancias serverless), pero
// eleva de forma significativa el costo de un ataque de fuerza bruta sin
// depender de infraestructura externa.

type Registro = { intentos: number; primerIntento: number; bloqueadoHasta: number }

const registros = new Map<string, Registro>()

const MAX_INTENTOS = 5 // intentos fallidos permitidos por ventana
const VENTANA_MS = 15 * 60 * 1000 // ventana de 15 minutos
const BLOQUEO_MS = 15 * 60 * 1000 // bloqueo de 15 minutos al superar el máximo

// Limpieza perezosa de registros vencidos para no acumular memoria.
function limpiar(ahora: number) {
  if (registros.size < 500) return
  for (const [clave, reg] of registros) {
    if (reg.bloqueadoHasta < ahora && ahora - reg.primerIntento > VENTANA_MS) {
      registros.delete(clave)
    }
  }
}

export function obtenerIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "desconocida"
}

// Devuelve { permitido, esperaSegundos } SIN contar el intento.
export function chequearLimite(clave: string): { permitido: boolean; esperaSegundos: number } {
  const ahora = Date.now()
  const reg = registros.get(clave)
  if (reg && reg.bloqueadoHasta > ahora) {
    return { permitido: false, esperaSegundos: Math.ceil((reg.bloqueadoHasta - ahora) / 1000) }
  }
  return { permitido: true, esperaSegundos: 0 }
}

// Registra un intento fallido y aplica bloqueo si corresponde.
export function registrarFallo(clave: string) {
  const ahora = Date.now()
  limpiar(ahora)
  let reg = registros.get(clave)
  if (!reg || ahora - reg.primerIntento > VENTANA_MS) {
    reg = { intentos: 0, primerIntento: ahora, bloqueadoHasta: 0 }
  }
  reg.intentos += 1
  if (reg.intentos >= MAX_INTENTOS) {
    reg.bloqueadoHasta = ahora + BLOQUEO_MS
  }
  registros.set(clave, reg)
}

// Limpia el registro tras un login exitoso.
export function registrarExito(clave: string) {
  registros.delete(clave)
}
