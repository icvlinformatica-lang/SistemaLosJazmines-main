"use client"

// Tarjetas del insumo de cocina y de la receta nuevos que propuso el chat con
// IA: muestran los datos (de dónde sale el precio, cuánto trae cada unidad,
// los ingredientes y el costo por porción) y piden la confirmación. La IA no
// carga nada; lo carga la persona con "Sí, cargar" (POST /api/chat/catalogo,
// que lee la propuesta guardada y la vuelve a validar, no la de pantalla).
import { useState, type ReactNode } from "react"
import Link from "next/link"
import { BookOpen, CheckCircle2, Loader2, Package, XCircle } from "lucide-react"
import { porUnidad, type PropuestaInsumoChat, type PropuestaRecetaChat } from "@/lib/chat-ia-catalogo"
import { pesos } from "@/components/chat-ia-tarjeta-evento"

/** Pesos con centavos cuando los tiene ($2.450,50): los precios por gramo o por cc son chicos. */
const pesosFinos = (n: number) =>
  Number.isInteger(n) ? pesos(n) : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 })

const UNIDAD_CORTA: Record<string, string> = { KG: "kg", GR: "g", GRS: "g", LT: "litros", L: "litros", CC: "cc", UN: "unidades" }

type Tipo = "insumo" | "receta"

function useResolver<T>(tipo: Tipo, mensajeId: string, onResuelto: (v: T) => void) {
  const [enviando, setEnviando] = useState<"confirmar" | "cancelar" | null>(null)
  const [error, setError] = useState("")
  const resolver = async (accion: "confirmar" | "cancelar") => {
    if (enviando) return
    setEnviando(accion)
    setError("")
    try {
      const res = await fetch("/api/chat/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajeId, tipo, accion }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data[tipo]) throw new Error(data.error || "No se pudo. Probá de nuevo.")
      onResuelto(data[tipo] as T)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo. Probá de nuevo.")
    } finally {
      setEnviando(null)
    }
  }
  return { enviando, error, resolver }
}

function Pie({
  estado,
  propio,
  enviando,
  error,
  resolver,
  resueltoPor,
  codigo,
  href,
  pantalla,
  onIr,
}: {
  estado: PropuestaInsumoChat["estado"]
  propio: boolean
  enviando: "confirmar" | "cancelar" | null
  error: string
  resolver: (accion: "confirmar" | "cancelar") => void
  resueltoPor?: string
  codigo?: string
  href: string
  pantalla: string
  onIr?: () => void
}) {
  return (
    <>
      {estado === "pendiente" && propio && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => resolver("confirmar")}
            disabled={!!enviando}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2d5a3d] px-3 py-1.5 text-xs font-semibold text-[#f5f0e8] transition-colors hover:bg-[#3a6f4e] disabled:opacity-50"
          >
            {enviando === "confirmar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Sí, cargar
          </button>
          <button
            type="button"
            onClick={() => resolver("cancelar")}
            disabled={!!enviando}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {enviando === "cancelar" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Cancelar
          </button>
        </div>
      )}
      {estado === "pendiente" && !propio && <p className="mt-2 text-xs text-gray-500">Sin confirmar.</p>}
      {estado === "cargado" && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cargado{codigo ? ` (${codigo})` : ""}{resueltoPor ? ` por ${resueltoPor}` : ""}.
          <Link href={href} prefetch={false} onClick={onIr} className="underline">
            Ver en {pantalla}
          </Link>
        </p>
      )}
      {estado === "cancelado" && (
        <p className="mt-2 flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">
          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Cancelado: no se cargó nada.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </>
  )
}

function Marco({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#d4a533]/60 bg-white px-3 py-2.5 text-gray-900 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-bold text-[#2d5a3d]">
        {icono}
        {titulo}
      </p>
      {children}
    </div>
  )
}

function Filas({ filas }: { filas: [string, string][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500">{k}</dt>
          <dd className="break-words text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function TarjetaInsumoChatIA({
  insumo,
  mensajeId,
  propio,
  onResuelto,
  onIr,
}: {
  insumo: PropuestaInsumoChat
  mensajeId: string
  /** false cuando Soporte mira el chat de otra persona: no puede confirmar. */
  propio: boolean
  onResuelto: (insumo: PropuestaInsumoChat) => void
  onIr?: () => void
}) {
  const { enviando, error, resolver } = useResolver("insumo", mensajeId, onResuelto)
  const filas: [string, string][] = [
    ["Insumo", insumo.descripcion],
    ["Se mide en", insumo.unidad],
    ["Compra", `${num(insumo.compra.cantidad)} ${UNIDAD_CORTA[insumo.unidad] ?? insumo.unidad} a ${pesosFinos(insumo.compra.monto)}`],
  ]
  if (insumo.unidad === "UN") {
    filas.push([
      "Cada unidad trae",
      insumo.contenidoCantidad ? `${num(insumo.contenidoCantidad)} ${insumo.contenidoUnidad === "CC" ? "cc" : "gramos"}` : "Se usa por unidad",
    ])
  }
  filas.push(["Proveedor", insumo.proveedor || "Sin proveedor fijo"])
  return (
    <Marco icono={<Package className="h-4 w-4 shrink-0" aria-hidden="true" />} titulo="Insumo nuevo para Almacén">
      <Filas filas={filas} />
      <div className="mt-2 flex items-baseline justify-between gap-2 rounded-md bg-[#2d5a3d]/5 px-2 py-1.5">
        <span className="text-xs font-semibold text-[#2d5a3d]">Precio</span>
        <span className="text-base font-bold text-[#2d5a3d]">
          {pesosFinos(insumo.precioUnitario)} <span className="text-xs font-semibold">{porUnidad(insumo.unidad)}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500">Entra con stock en cero. Las recetas que lo usen toman este precio.</p>
      <Pie
        estado={insumo.estado}
        propio={propio}
        enviando={enviando}
        error={error}
        resolver={resolver}
        resueltoPor={insumo.resueltoPor}
        codigo={insumo.codigo}
        href="/admin/almacen"
        pantalla="Almacén"
        onIr={onIr}
      />
    </Marco>
  )
}

export function TarjetaRecetaChatIA({
  receta,
  mensajeId,
  propio,
  onResuelto,
  onIr,
}: {
  receta: PropuestaRecetaChat
  mensajeId: string
  propio: boolean
  onResuelto: (receta: PropuestaRecetaChat) => void
  onIr?: () => void
}) {
  const { enviando, error, resolver } = useResolver("receta", mensajeId, onResuelto)
  const filas: [string, string][] = [
    ["Receta", receta.nombre],
    ["Categoría", receta.categoria],
    ["Cantidades para", receta.rindePara === 1 ? "1 porción" : `${receta.rindePara} porciones`],
  ]
  return (
    <Marco icono={<BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />} titulo="Receta nueva para el Recetario">
      <Filas filas={filas} />
      <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-100 text-xs">
        {receta.ingredientes.map((i) => (
          <li key={i.insumoId} className="flex items-baseline justify-between gap-2 px-2 py-1">
            <span className="min-w-0 break-words">
              {i.descripcion}
              {i.detalleCorte ? <span className="text-gray-500"> ({i.detalleCorte})</span> : null}
            </span>
            <span className="shrink-0 text-right text-gray-600">
              {num(i.cantidad)} {UNIDAD_CORTA[i.unidadReceta] ?? i.unidadReceta}
              <span className="ml-1.5 text-gray-400">{pesosFinos(i.costoPorPorcion)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between gap-2 rounded-md bg-[#2d5a3d]/5 px-2 py-1.5">
        <span className="text-xs font-semibold text-[#2d5a3d]">Costo por porción</span>
        <span className="text-base font-bold text-[#2d5a3d]">{pesosFinos(receta.costoPorPorcion)}</span>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500">Con los precios de hoy del Almacén; si cambian, el costo se actualiza solo.</p>
      <Pie
        estado={receta.estado}
        propio={propio}
        enviando={enviando}
        error={error}
        resolver={resolver}
        resueltoPor={receta.resueltoPor}
        codigo={receta.codigo}
        href="/admin/recetario"
        pantalla="Recetario"
        onIr={onIr}
      />
    </Marco>
  )
}
