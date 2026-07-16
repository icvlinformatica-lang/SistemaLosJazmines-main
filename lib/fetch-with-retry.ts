// Helper de red con reintento automático para las operaciones de guardado.
//
// Muchas escrituras a la base (insumos, recetas, eventos, caja, etc.) fallaban
// de forma definitiva ante un corte breve de conexión: se mostraba el toast
// "No se pudo sincronizar" y el cambio se perdía. Este helper reintenta de
// forma transparente los fallos transitorios (errores de red y respuestas 5xx)
// con backoff exponencial, de modo que un hipo momentáneo de internet no haga
// perder el guardado.
//
// NO se reintentan los errores 4xx (petición inválida, no encontrado, etc.),
// porque esos no se arreglan reintentando.

export interface FetchRetryOptions extends RequestInit {
  /** Cantidad total de intentos (incluye el primero). Default: 3. */
  retries?: number
  /** Espera base en ms antes de reintentar. Se duplica en cada intento. Default: 500. */
  backoffMs?: number
  /** Timeout por intento en ms. Default: 12000. */
  timeoutMs?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * fetch con reintento automático ante fallos transitorios.
 * Devuelve la Response (aunque sea 4xx). Solo lanza si se agotan los intentos
 * por error de red / timeout / 5xx.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const { retries = 3, backoffMs = 500, timeoutMs = 12000, ...init } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      clearTimeout(timeoutId)

      // 5xx = error del servidor, probablemente transitorio → reintentar.
      if (res.status >= 500 && attempt < retries) {
        lastError = new Error(`Server error ${res.status}`)
        await sleep(backoffMs * 2 ** (attempt - 1))
        continue
      }

      // 2xx, 3xx y 4xx se devuelven tal cual (el llamador decide con res.ok).
      return res
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error

      // Error de red o timeout. Si quedan intentos, esperamos y reintentamos.
      if (attempt < retries) {
        console.log(
          `[v0] fetchWithRetry: intento ${attempt}/${retries} falló, reintentando...`,
        )
        await sleep(backoffMs * 2 ** (attempt - 1))
        continue
      }
    }
  }

  // Se agotaron los intentos.
  throw lastError instanceof Error
    ? lastError
    : new Error("fetchWithRetry: fallaron todos los intentos")
}
