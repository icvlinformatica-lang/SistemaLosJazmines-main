"use client"

// La guirnalda de luces del simulador (vista de Clientes): es el indicador de
// pasos. Cada lamparita es un paso; se prende cuando se llega a ese paso y,
// cuando la fiesta está lista, se prenden todas, de a una. Es la misma
// guirnalda que cuelga sobre el jardín en las fotos del salón.
//
// Las lamparitas de los pasos ya visitados son botones: tocarlas vuelve a ese
// paso. Con "reducir movimiento" no hay parpadeo.

const ANCHO = 340
const ALTO = 62
// Cable: curva cuadrática que cuelga entre los dos extremos.
const P0 = { x: 6, y: 10 }
const P1 = { x: ANCHO / 2, y: 58 }
const P2 = { x: ANCHO - 6, y: 10 }

function puntoDelCable(t: number) {
  const u = 1 - t
  return {
    x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
    y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
  }
}

export function Guirnalda({
  pasos,
  actual,
  alcanzado,
  completa = false,
  onIr,
}: {
  pasos: Array<{ id: string; nombre: string }>
  /** Índice del paso que se está viendo (con `completa`, ninguno). */
  actual: number
  /** Último paso al que se llegó: hasta ahí se puede volver tocando. */
  alcanzado: number
  completa?: boolean
  onIr?: (indice: number) => void
}) {
  const n = pasos.length
  const lamparas = pasos.map((p, i) => {
    const t = (i + 0.5) / n
    const enCable = puntoDelCable(t)
    return { ...p, i, x: enCable.x, y: enCable.y + 9, cableY: enCable.y }
  })

  return (
    <div className="relative w-full select-none">
      <style>{`
        @keyframes lj-encender { 0% { opacity: .15 } 35% { opacity: 1 } 50% { opacity: .45 } 70% { opacity: 1 } 100% { opacity: 1 } }
        .lj-lampara-fiesta { animation: lj-encender .7s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .lj-lampara-fiesta { animation: none; } }
      `}</style>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-auto overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="lj-vidrio-prendido" cx="50%" cy="40%" r="60%">
            {/* Los colores salen del estilo del festejo (lib/clientes-tema.ts):
                en un atributo de SVG no se pueden usar variables, en style sí. */}
            <stop offset="0%" style={{ stopColor: "#fffaf3" }} />
            <stop offset="45%" style={{ stopColor: "var(--lj-acento)" }} />
            <stop offset="100%" style={{ stopColor: "var(--lj-borde-elegido)" }} />
          </radialGradient>
          <radialGradient id="lj-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: "var(--lj-acento)", stopOpacity: 0.55 }} />
            <stop offset="100%" style={{ stopColor: "var(--lj-acento)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        <path
          d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
          fill="none"
          style={{ stroke: "color-mix(in oklab, var(--lj-texto) 38%, transparent)" }}
          strokeWidth="1.1"
        />
        {lamparas.map((l) => {
          const prendida = completa || l.i <= alcanzado
          const esActual = !completa && l.i === actual
          return (
            <g key={l.id}>
              <line
                x1={l.x}
                y1={l.cableY}
                x2={l.x}
                y2={l.y - 6}
                style={{ stroke: "color-mix(in oklab, var(--lj-texto) 38%, transparent)" }}
                strokeWidth="1"
              />
              <rect
                x={l.x - 2.4}
                y={l.y - 7}
                width="4.8"
                height="3.6"
                rx="0.8"
                style={{ fill: "color-mix(in oklab, var(--lj-texto) 22%, var(--lj-fondo))" }}
              />
              {prendida && (
                <circle
                  cx={l.x}
                  cy={l.y}
                  r={esActual ? 17 : 13}
                  fill="url(#lj-halo)"
                  className={completa ? "lj-lampara-fiesta" : undefined}
                  style={completa ? { animationDelay: `${l.i * 110}ms` } : undefined}
                />
              )}
              <circle
                cx={l.x}
                cy={l.y}
                r={5.2}
                fill={prendida ? "url(#lj-vidrio-prendido)" : undefined}
                strokeWidth={esActual ? 1.6 : 0.8}
                className={completa ? "lj-lampara-fiesta" : undefined}
                style={{
                  ...(prendida ? {} : { fill: "color-mix(in oklab, var(--lj-texto) 8%, transparent)" }),
                  stroke: prendida ? "var(--lj-acento)" : "color-mix(in oklab, var(--lj-texto) 32%, transparent)",
                  ...(completa ? { animationDelay: `${l.i * 110}ms` } : {}),
                }}
              />
            </g>
          )
        })}
      </svg>
      {onIr && (
        // Solo las lamparitas reciben el toque: así, puesta sobre la maqueta
        // 3D, el resto se puede arrastrar para girarla.
        <div className="pointer-events-none absolute inset-0">
          {lamparas.map((l) => {
            const puede = l.i <= alcanzado && (completa || l.i !== actual)
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => puede && onIr(l.i)}
                disabled={!puede}
                aria-label={`Paso ${l.i + 1}: ${l.nombre}${!completa && l.i === actual ? " (estás acá)" : ""}`}
                aria-current={!completa && l.i === actual ? "step" : undefined}
                className="pointer-events-auto absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lj-acento)] disabled:cursor-default"
                style={{ left: `${(l.x / ANCHO) * 100}%`, top: `${(l.y / ALTO) * 100}%` }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
