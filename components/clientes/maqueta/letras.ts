// Letras luminosas de la maqueta 3D: letras gigantes de metal con
// lamparitas en el frente, como las que se alquilan para las fiestas
// ("XV", "LOVE"). Cada letra es un dibujo de trazos; sobre cada trazo va el
// cuerpo de la letra y, cada 10 cm, una lamparita.

import * as THREE from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"

type Punto = [number, number]
type Trazo = Punto[]
interface Glifo {
  ancho: number
  trazos: Trazo[]
}

/** Una curva suave que pasa por los puntos, en tramos cortos. */
function curva(puntos: Punto[], tramos = 26, cerrada = false): Trazo {
  const c = new THREE.SplineCurve(puntos.map(([x, y]) => new THREE.Vector2(x, y)))
  const salida = c.getSpacedPoints(tramos).map((p) => [p.x, p.y] as Punto)
  if (cerrada) salida.push(salida[0])
  return salida
}

function elipse(cx: number, cy: number, rx: number, ry: number, tramos = 30): Trazo {
  const salida: Trazo = []
  for (let i = 0; i <= tramos; i++) {
    const a = (i / tramos) * Math.PI * 2 + Math.PI / 2
    salida.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return salida
}

function estrella(cx: number, cy: number, r: number): Trazo {
  const salida: Trazo = []
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i / 10) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * 0.42
    salida.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  return salida
}

// Letras de 1 m de alto (y de 0 a 1), dibujadas con trazos.
const GLIFOS: Record<string, Glifo> = {
  X: { ancho: 0.72, trazos: [[[0, 0], [0.72, 1]], [[0, 1], [0.72, 0]]] },
  V: { ancho: 0.72, trazos: [[[0, 1], [0.36, 0], [0.72, 1]]] },
  L: { ancho: 0.56, trazos: [[[0, 1], [0, 0], [0.56, 0]]] },
  O: { ancho: 0.74, trazos: [elipse(0.37, 0.5, 0.37, 0.5)] },
  E: { ancho: 0.56, trazos: [[[0.56, 1], [0, 1], [0, 0], [0.56, 0]], [[0, 0.5], [0.46, 0.5]]] },
  F: { ancho: 0.56, trazos: [[[0.56, 1], [0, 1], [0, 0]], [[0, 0.52], [0.46, 0.52]]] },
  I: { ancho: 0.12, trazos: [[[0.06, 0], [0.06, 1]]] },
  T: { ancho: 0.68, trazos: [[[0, 1], [0.68, 1]], [[0.34, 1], [0.34, 0]]] },
  A: { ancho: 0.7, trazos: [[[0, 0], [0.35, 1], [0.7, 0]], [[0.14, 0.38], [0.56, 0.38]]] },
  N: { ancho: 0.64, trazos: [[[0, 0], [0, 1], [0.64, 0], [0.64, 1]]] },
  Y: { ancho: 0.7, trazos: [[[0, 1], [0.35, 0.52], [0.7, 1]], [[0.35, 0.52], [0.35, 0]]] },
  S: {
    ancho: 0.64,
    trazos: [
      curva([
        [0.62, 0.86],
        [0.46, 0.99],
        [0.2, 0.98],
        [0.04, 0.82],
        [0.1, 0.62],
        [0.32, 0.52],
        [0.56, 0.42],
        [0.64, 0.2],
        [0.5, 0.03],
        [0.22, 0.01],
        [0.02, 0.14],
      ]),
    ],
  },
  B: {
    ancho: 0.6,
    trazos: [
      [[0, 0], [0, 1]],
      curva([[0, 1], [0.34, 1], [0.5, 0.9], [0.52, 0.76], [0.42, 0.6], [0.28, 0.54], [0, 0.54]], 18),
      curva([[0.28, 0.54], [0.5, 0.48], [0.6, 0.3], [0.56, 0.1], [0.4, 0.01], [0, 0]], 18),
    ],
  },
  "★": { ancho: 0.9, trazos: [estrella(0.45, 0.5, 0.48)] },
}

export const SEPARACION_LETRAS = 0.2

export function anchoLetra(letra: string): number {
  return (GLIFOS[letra] ?? GLIFOS["★"]).ancho
}

interface Forma {
  cuerpo: THREE.BufferGeometry
  focos: THREE.Vector3[]
}
const cache = new Map<string, Forma>()

/**
 * Cuerpo (cajas sobre cada trazo, unidas en una sola geometría) y dónde va cada
 * lamparita, para una letra. La letra queda parada en el piso, con el frente
 * hacia +z y el borde izquierdo en x = 0.
 */
export function formaLetra(letra: string): Forma {
  const clave = GLIFOS[letra] ? letra : "★"
  const guardada = cache.get(clave)
  if (guardada) return guardada
  const glifo = GLIFOS[clave]
  const partes: THREE.BufferGeometry[] = []
  const focos: THREE.Vector3[] = []
  const ANCHO_TRAZO = 0.13
  const PROFUNDIDAD = 0.1
  const PASO_FOCOS = 0.1
  for (const trazo of glifo.trazos) {
    for (let i = 0; i < trazo.length - 1; i++) {
      const [x0, y0] = trazo[i]
      const [x1, y1] = trazo[i + 1]
      const largo = Math.hypot(x1 - x0, y1 - y0)
      if (largo < 1e-4) continue
      // Un poco más largo para tapar las uniones.
      const caja = new THREE.BoxGeometry(largo + ANCHO_TRAZO * 0.9, ANCHO_TRAZO, PROFUNDIDAD)
      caja.rotateZ(Math.atan2(y1 - y0, x1 - x0))
      caja.translate((x0 + x1) / 2, (y0 + y1) / 2 + 0.06, 0)
      partes.push(caja)
    }
    // Lamparitas repartidas a lo largo de todo el trazo.
    let total = 0
    for (let i = 0; i < trazo.length - 1; i++) total += Math.hypot(trazo[i + 1][0] - trazo[i][0], trazo[i + 1][1] - trazo[i][1])
    const n = Math.max(2, Math.round(total / PASO_FOCOS))
    for (let k = 0; k <= n; k++) {
      let objetivo = (k / n) * total
      for (let i = 0; i < trazo.length - 1; i++) {
        const [x0, y0] = trazo[i]
        const [x1, y1] = trazo[i + 1]
        const l = Math.hypot(x1 - x0, y1 - y0)
        if (objetivo <= l || i === trazo.length - 2) {
          const f = l > 0 ? Math.min(1, objetivo / l) : 0
          const p = new THREE.Vector3(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + 0.06, PROFUNDIDAD / 2 + 0.012)
          // Sin dos lamparitas encimadas (en las uniones de los trazos).
          if (!focos.some((q) => q.distanceTo(p) < PASO_FOCOS * 0.55)) focos.push(p)
          break
        }
        objetivo -= l
      }
    }
  }
  const cuerpo = mergeGeometries(partes, false) ?? new THREE.BoxGeometry(0.1, 1, 0.1)
  for (const p of partes) p.dispose()
  const forma = { cuerpo, focos }
  cache.set(clave, forma)
  return forma
}
