"use client"

import { CalendarCheck, CalendarX, Snowflake } from "lucide-react"
import {
  fechaLarga,
  formatoPesos,
  nombreEnFrase,
  servicioConCantidad,
  type ResumenSimulacion,
} from "@/lib/clientes-simulador"

/** El presupuesto como una tarjeta de papel, al estilo de una invitación:
 *  arriba para quién y qué se festeja; en el medio, cada rubro con su precio
 *  (con puntos guía, como en una carta); abajo, qué incluye, hasta cuándo vale
 *  el precio y si la fecha está libre. Solo precios: nunca costos. */
export function PresupuestoCliente({
  nombre,
  tipoEvento,
  fecha,
  salonNombre,
  adultos,
  ninos,
  resumen,
  platos,
  barras,
  validoHasta,
  disponible,
}: {
  nombre: string
  tipoEvento: string | null
  fecha: string | null
  salonNombre: string
  adultos: number
  ninos: number
  resumen: ResumenSimulacion
  platos: string[]
  barras: string[]
  validoHasta: string
  /** null = no se sabe (no se pudo consultar). */
  disponible: boolean | null
}) {
  const rubros = resumen.rubros.filter((r) => r.clave === "salon" || r.precio > 0)
  const extras = resumen.servicios.filter((s) => !s.incluido)
  const incluidos = resumen.servicios.filter((s) => s.incluido)
  const invitados = `${adultos} ${adultos === 1 ? "adulto" : "adultos"}${ninos > 0 ? ` y ${ninos} ${ninos === 1 ? "chico" : "chicos"}` : ""}`

  return (
    <article className="lj-imprimir relative overflow-hidden rounded-[22px] bg-[#f8f2e4] px-6 pb-7 pt-8 text-[#1a3a2a] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)] print:rounded-none print:shadow-none sm:px-9">
      <header className="text-center">
        <p className="text-[13px] text-[#1a3a2a]/60">Presupuesto para</p>
        <h2 className="mt-1 font-[family-name:var(--font-fiesta)] text-[32px] font-medium leading-[1.05] tracking-[-0.01em]">
          {nombre}
        </h2>
        <div className="mx-auto mt-4 h-px w-16 bg-[#b08d2a]" />
        <p className="mt-4 font-[family-name:var(--font-fiesta)] text-[19px] leading-snug">
          {tipoEvento ?? "Tu fiesta"}
        </p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-[#1a3a2a]/75">
          {fecha ? <span className="first-letter:uppercase inline-block">{fechaLarga(fecha)}</span> : "Sin fecha elegida"}
          <br />
          {salonNombre}, {invitados}
        </p>
      </header>

      <dl className="mt-7 space-y-2.5">
        {rubros.map((r) => (
          <div key={r.clave} className="flex items-baseline gap-2 text-[15px]">
            <dt className="shrink-0">{r.nombre}</dt>
            <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-[#1a3a2a]/35" />
            <dd className="shrink-0 tabular-nums">{formatoPesos(r.precio)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-[#b08d2a]/60 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium">Total</span>
          <span className="font-[family-name:var(--font-fiesta)] text-[32px] font-semibold leading-none tabular-nums">
            {formatoPesos(resumen.total)}
          </span>
        </div>
        {resumen.porInvitado > 0 && (
          <p className="mt-1.5 text-right text-[13px] text-[#1a3a2a]/60">
            {formatoPesos(resumen.porInvitado)} por invitado
          </p>
        )}
      </div>

      <section className="mt-7 space-y-3 text-[14px] leading-relaxed">
        <h3 className="font-[family-name:var(--font-fiesta)] text-[18px]">Qué incluye</h3>
        {platos.length > 0 ? (
          <p>
            <span className="font-medium">Menú:</span> {platos.map(nombreEnFrase).join("; ")}.
          </p>
        ) : (
          <p>
            <span className="font-medium">Sin catering.</span>
          </p>
        )}
        {barras.length > 0 && (
          <p>
            <span className="font-medium">Barra:</span> {barras.map(nombreEnFrase).join("; ")}.
          </p>
        )}
        {/* Con punto y coma: hay nombres que ya traen comas ("DJ, sonido, luces y humo"). */}
        {extras.length > 0 && (
          <p>
            <span className="font-medium">Extras:</span> {extras.map((s) => servicioConCantidad(s, true)).join("; ")}.
          </p>
        )}
        {incluidos.length > 0 && (
          <p>
            <span className="font-medium">Ya viene con el salón:</span> {incluidos.map((s) => nombreEnFrase(s.nombre)).join("; ")}.
          </p>
        )}
        {resumen.personal.length > 0 && (
          <p>
            <span className="font-medium">Personal:</span>{" "}
            {resumen.personal.map((p) => `${nombreEnFrase(p.funcion)} × ${p.cantidad}`).join("; ")}.
          </p>
        )}
      </section>

      <div className="mt-7 space-y-2.5">
        <p className="flex items-start gap-2.5 rounded-xl bg-[#1a3a2a] px-4 py-3 text-[14px] leading-snug text-[#f5f0e8]">
          <Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-[#f3cf7a]" aria-hidden="true" />
          <span>
            Precio congelado hasta el <span className="font-medium">{fechaLarga(validoHasta, false)}</span>.
          </span>
        </p>
        {disponible !== null && fecha && (
          <p
            className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-[14px] leading-snug ${
              disponible ? "bg-[#e7efe3] text-[#1f4a2c]" : "bg-[#f6e1dd] text-[#7a2e24]"
            }`}
          >
            {disponible ? (
              <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CalendarX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {disponible
                ? `La fecha está libre en ${salonNombre}.`
                : `Esa fecha se reservó recién en ${salonNombre}. Escribinos y te ayudamos a elegir otra.`}
            </span>
          </p>
        )}
      </div>
    </article>
  )
}
