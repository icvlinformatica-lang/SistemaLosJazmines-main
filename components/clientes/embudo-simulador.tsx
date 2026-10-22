"use client"

// "Dónde se quedan": el embudo del simulador, solo para Soporte (pedido de
// Rodri del 22/10/2026). Muestra cuántas visitas del link llegaron a cada
// etapa y en cuál se fueron los que no pidieron presupuesto. Los números salen
// de GET /api/clientes/embudo (armarEmbudo en lib/clientes-embudo.ts); no hay
// datos personales porque la tabla no los guarda.

import { useEffect, useState, type CSSProperties } from "react"
import { Loader2 } from "lucide-react"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import type { Embudo } from "@/lib/clientes-embudo"

type Respuesta = Embudo & { dias: number; sinTabla?: boolean }

const PERIODOS = [
  { dias: 7, texto: "7 días" },
  { dias: 30, texto: "30 días" },
  { dias: 90, texto: "90 días" },
]

export function EmbudoSimulador({
  abierto,
  onCambiar,
  estilo,
  claseFuente,
  claseTitulo,
  nombreSalon,
}: {
  abierto: boolean
  onCambiar: (abierto: boolean) => void
  /** Las variables --lj-… del estilo del festejo (la hoja va en un portal). */
  estilo: CSSProperties
  claseFuente: string
  claseTitulo: string
  /** El nombre que ven los clientes, a partir de la clave del salón. */
  nombreSalon: (clave: string) => string
}) {
  const [dias, setDias] = useState(30)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    let cancelado = false
    setCargando(true)
    setError(false)
    fetch(`/api/clientes/embudo?dias=${dias}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (cancelado) return
        if (!r.ok || !d?.ok) throw new Error("embudo")
        setDatos(d as Respuesta)
      })
      .catch(() => {
        if (!cancelado) setError(true)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [abierto, dias])

  const etapas = datos?.etapas.filter((e) => e.id !== "lugar" || e.visitas > 0) ?? []

  return (
    <Drawer open={abierto} onOpenChange={onCambiar}>
      <DrawerContent
        style={estilo}
        className={`${claseFuente} border-0 bg-[var(--lj-papel)] text-[var(--lj-tinta)] data-[vaul-drawer-direction=bottom]:max-h-[92svh]`}
      >
        <div className="mx-auto w-full max-w-[520px] overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
          <DrawerTitle className={`${claseTitulo} text-[28px] font-medium leading-tight text-[var(--lj-tinta)]`}>
            Dónde se quedan
          </DrawerTitle>
          <DrawerDescription className="mt-2 text-[14.5px] leading-relaxed text-[var(--lj-tinta)]/75">
            Visitas de quienes entraron con el link. Las tuyas no cuentan.
          </DrawerDescription>

          <div className="mt-4 flex gap-2" role="group" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                type="button"
                onClick={() => setDias(p.dias)}
                aria-pressed={dias === p.dias}
                className={`rounded-[var(--lj-radio-boton)] px-3.5 py-1.5 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lj-tinta)]/40 ${
                  dias === p.dias
                    ? "bg-[var(--lj-tinta)] text-[var(--lj-papel)]"
                    : "border border-[var(--lj-tinta)]/20 text-[var(--lj-tinta)]/80"
                }`}
              >
                {p.texto}
              </button>
            ))}
          </div>

          {cargando && !datos && (
            <p className="mt-6 flex items-center gap-2 text-[14.5px] text-[var(--lj-tinta)]/70">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando…
            </p>
          )}
          {error && <p className="mt-6 text-[14.5px] text-[#9a3428]">No se pudo cargar. Cerrá y probá de nuevo.</p>}

          {datos && !error && (
            <div className={cargando ? "opacity-60" : undefined}>
              {datos.sinTabla ? (
                <p className="mt-6 rounded-[var(--lj-radio-chico)] border border-[var(--lj-tinta)]/15 p-4 text-[14.5px] leading-relaxed">
                  Todavía no se anota nada: falta correr la migración 027 (scripts/027_simulador_recorridos.sql) en
                  el SQL Editor de Supabase. El simulador anda igual.
                </p>
              ) : datos.visitas === 0 ? (
                <p className="mt-6 text-[14.5px] leading-relaxed text-[var(--lj-tinta)]/75">
                  Nadie entró con el link en estos {datos.dias} días. Compartilo con el botón del link y acá vas a ver
                  hasta dónde llega cada visita.
                </p>
              ) : (
                <>
                  <p className="mt-5 text-[15px]">
                    <span className="text-[22px] font-semibold tabular-nums">{datos.visitas}</span>{" "}
                    {datos.visitas === 1 ? "visita" : "visitas"} en {datos.dias} días
                  </p>

                  <ol className="mt-4 space-y-2.5">
                    {etapas.map((e) => (
                      <li key={e.id}>
                        <div className="flex items-baseline justify-between gap-3 text-[14px]">
                          <span>{e.nombre}</span>
                          <span className="shrink-0 tabular-nums text-[var(--lj-tinta)]/75">
                            {e.visitas} ({e.porcentaje}%)
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--lj-tinta)]/10" aria-hidden="true">
                          <div className="h-full rounded-full bg-[var(--lj-tinta)]/70" style={{ width: `${e.porcentaje}%` }} />
                        </div>
                      </li>
                    ))}
                  </ol>

                  {datos.seFueronEn.length > 0 && (
                    <section className="mt-6">
                      <h3 className="text-[15px] font-semibold">Dónde se fueron</h3>
                      <p className="mt-0.5 text-[13px] text-[var(--lj-tinta)]/65">
                        Lo último que vieron los que no pidieron presupuesto.
                      </p>
                      <ul className="mt-2 divide-y divide-[var(--lj-tinta)]/10 text-[14px]">
                        {datos.seFueronEn.map((f) => (
                          <li key={f.id} className="flex justify-between gap-3 py-1.5">
                            <span>{f.nombre}</span>
                            <span className="tabular-nums">{f.visitas}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <Tabla
                    titulo="Por festejo"
                    filas={datos.porFestejo.map((f) => ({ clave: f.nombre, ...f }))}
                  />
                  <Tabla
                    titulo="Por salón"
                    filas={datos.porSalon.map((s) => ({ clave: s.salon, nombre: nombreSalon(s.salon), ...s }))}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function Tabla({
  titulo,
  filas,
}: {
  titulo: string
  filas: Array<{ clave: string; nombre: string; visitas: number; pidieron: number }>
}) {
  if (!filas.length) return null
  return (
    <section className="mt-6">
      <h3 className="text-[15px] font-semibold">{titulo}</h3>
      <table className="mt-2 w-full text-[14px]">
        <thead>
          <tr className="text-left text-[12.5px] text-[var(--lj-tinta)]/65">
            <th className="py-1 font-normal">Eligieron</th>
            <th className="py-1 text-right font-normal">Visitas</th>
            <th className="py-1 text-right font-normal">Pidieron</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--lj-tinta)]/10">
          {filas.map((f) => (
            <tr key={f.clave}>
              <td className="py-1.5">{f.nombre}</td>
              <td className="py-1.5 text-right tabular-nums">{f.visitas}</td>
              <td className="py-1.5 text-right tabular-nums">{f.pidieron}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
