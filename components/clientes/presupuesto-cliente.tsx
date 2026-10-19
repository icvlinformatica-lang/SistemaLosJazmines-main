"use client"

import { CalendarCheck, CalendarX, Snowflake, Wallet } from "lucide-react"
import { TEXTO_INCLUIDO_EN_TODOS, yaIncluidoEnTodos } from "@/lib/clientes-maqueta"
import {
  fechaLarga,
  formasDePagoEnFrase,
  formatoPesos,
  nombreEnFrase,
  servicioConCantidad,
  type ResumenSimulacion,
} from "@/lib/clientes-simulador"

/** El presupuesto como una tarjeta de papel, al estilo de una invitación:
 *  arriba para quién y qué se festeja; en el medio, el precio sugerido; abajo,
 *  qué incluye, las formas de pago (el precio final depende de cuál elija) y si
 *  la fecha está libre (se reserva cuando la confirma un vendedor). Con
 *  `validoHasta`, también hasta cuándo vale el precio; la vista de Clientes no
 *  lo pasa desde el 19/10/2026. Con `desglose`, también cada rubro con su
 *  precio (con puntos guía, como en una carta) y el precio por invitado; la
 *  vista de Clientes no lo muestra desde el 19/10/2026 (solo el total). Solo
 *  precios: nunca costos. */
export function PresupuestoCliente({
  nombre,
  tipoEvento,
  fecha,
  salonNombre,
  lugar,
  adultos,
  ninos,
  resumen,
  platos,
  barras,
  validoHasta,
  disponible,
  ilustracion,
  desglose = false,
}: {
  nombre: string
  tipoEvento: string | null
  fecha: string | null
  salonNombre: string
  /** "al aire libre" / "adentro", si el salón tiene las dos. */
  lugar?: string | null
  adultos: number
  ninos: number
  resumen: ResumenSimulacion
  platos: string[]
  barras: string[]
  /** Hasta cuándo vale el precio; sin esto no se muestra. */
  validoHasta?: string | null
  /** null = no se sabe (no se pudo consultar). */
  disponible: boolean | null
  /** Foto de la maqueta 3D con lo que eligió (si el navegador la pudo dibujar). */
  ilustracion?: string | null
  /** El precio de cada rubro y por invitado, además del total. */
  desglose?: boolean
}) {
  const rubros = resumen.rubros.filter((r) => r.clave === "salon" || r.precio > 0)
  const extras = resumen.servicios.filter((s) => !s.incluido)
  const incluidos = resumen.servicios.filter((s) => s.incluido && !yaIncluidoEnTodos(s.nombre))
  const invitados = `${adultos} ${adultos === 1 ? "adulto" : "adultos"}${ninos > 0 ? ` y ${ninos} ${ninos === 1 ? "chico" : "chicos"}` : ""}`

  return (
    <article className="lj-imprimir relative overflow-hidden rounded-[var(--lj-radio)] bg-[var(--lj-papel)] px-6 pb-7 pt-8 text-[var(--lj-tinta)] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)] print:rounded-none print:shadow-none sm:px-9">
      <header className="text-center">
        <p className="text-[13px] text-[var(--lj-tinta)]/70">Presupuesto para</p>
        <h2 className="mt-1 font-[family-name:var(--lj-letra-titulo)] [font-style:var(--lj-estilo-titulo)] text-[32px] font-medium leading-[1.05] tracking-[-0.01em]">
          {nombre}
        </h2>
        <div className="mx-auto mt-4 h-px w-16 bg-[var(--lj-oro)]" />
        <p className="mt-4 font-[family-name:var(--lj-letra-titulo)] [font-style:var(--lj-estilo-titulo)] text-[19px] leading-snug">
          {tipoEvento ?? "Tu fiesta"}
        </p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--lj-tinta)]/75">
          {fecha ? <span className="first-letter:uppercase inline-block">{fechaLarga(fecha)}</span> : "Sin fecha elegida"}
          <br />
          {salonNombre}
          {lugar ? ` ${lugar}` : ""},{" "}
          {/* Los invitados van juntos: con "Jazmines Casona al aire libre" la
              línea ya es larga y, si no, se cortaba en "y 6 / chicos". */}
          <span className="inline-block">{invitados}</span>
        </p>
      </header>

      {ilustracion && (
        // En pantalla va acá arriba; al imprimir va chica al costado de "Qué
        // incluye", para que el presupuesto entre en una hoja.
        <figure className="mt-6 print:hidden">
          <img
            src={ilustracion}
            alt="Ilustración de tu fiesta con lo que elegiste"
            className="block aspect-[4/3] w-full rounded-[var(--lj-radio-chico)] bg-[var(--lj-fondo)] object-cover"
          />
          <figcaption className="mt-2 text-center text-[12.5px] text-[var(--lj-tinta)]/70">
            Una ilustración de lo que elegiste.
          </figcaption>
        </figure>
      )}

      {desglose && (
        <dl className="mt-7 space-y-2.5">
          {rubros.map((r) => (
            <div key={r.clave} className="flex items-baseline gap-2 text-[15px]">
              <dt className="shrink-0">{r.nombre}</dt>
              <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-[var(--lj-tinta)]/35" />
              <dd className="shrink-0 tabular-nums">{formatoPesos(r.precio)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className={`${desglose ? "mt-5" : "mt-7"} border-t border-[var(--lj-oro)]/60 pt-4`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium">Precio sugerido</span>
          <span className="font-[family-name:var(--lj-letra-titulo)] [font-style:var(--lj-estilo-titulo)] text-[32px] font-semibold leading-none tabular-nums">
            {formatoPesos(resumen.total)}
          </span>
        </div>
        {desglose && resumen.porInvitado > 0 && (
          <p className="mt-1.5 text-right text-[13px] text-[var(--lj-tinta)]/70">
            {formatoPesos(resumen.porInvitado)} por invitado
          </p>
        )}
      </div>

      <section className="mt-7 space-y-3 text-[14px] leading-relaxed print:mt-5">
        {ilustracion && (
          <img
            src={ilustracion}
            alt=""
            aria-hidden="true"
            className="hidden aspect-[4/3] object-cover print:float-right print:mb-2 print:ml-5 print:block print:w-[36%] print:rounded-lg"
          />
        )}
        <h3 className="font-[family-name:var(--lj-letra-titulo)] [font-style:var(--lj-estilo-titulo)] text-[18px]">Qué incluye</h3>
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
        <p>
          <span className="font-medium">Ya viene con el salón:</span> {TEXTO_INCLUIDO_EN_TODOS}
          {incluidos.length > 0 ? `; además, ${incluidos.map((s) => nombreEnFrase(s.nombre)).join("; ")}` : ""}.
        </p>
        {resumen.personal.length > 0 && (
          <p>
            <span className="font-medium">Personal:</span>{" "}
            {resumen.personal.map((p) => `${nombreEnFrase(p.funcion)} × ${p.cantidad}`).join("; ")}.
          </p>
        )}
      </section>

      <div className="mt-7 space-y-2.5">
        <p className="flex items-start gap-2.5 rounded-[var(--lj-radio-chico)] bg-[var(--lj-tinta)] px-4 py-3 text-[14px] leading-snug text-[var(--lj-papel)]">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lj-acento)]" aria-hidden="true" />
          <span>
            <span className="font-medium">Es un precio sugerido.</span> El final lo definís con un vendedor según cómo
            quieras pagarlo: {formasDePagoEnFrase()}.
          </span>
        </p>
        {validoHasta && (
          <p className="flex items-start gap-2.5 rounded-[var(--lj-radio-chico)] bg-[var(--lj-tinta)] px-4 py-3 text-[14px] leading-snug text-[var(--lj-papel)]">
            <Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lj-acento)]" aria-hidden="true" />
            <span>
              Precio congelado hasta el <span className="font-medium">{fechaLarga(validoHasta, false)}</span>.
            </span>
          </p>
        )}
        {disponible !== null && fecha && (
          <p
            className={`flex items-start gap-2.5 rounded-[var(--lj-radio-chico)] px-4 py-3 text-[14px] leading-snug ${
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
                ? `La fecha está libre en ${salonNombre}. Queda reservada cuando la confirma un vendedor.`
                : `Esa fecha se reservó recién en ${salonNombre}. Escribinos y te ayudamos a elegir otra.`}
            </span>
          </p>
        )}
      </div>
    </article>
  )
}
