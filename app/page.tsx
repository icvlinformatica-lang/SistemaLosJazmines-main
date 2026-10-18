"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import Link from "next/link"
import { Bell, HelpCircle, FileBarChart, PartyPopper, HandCoins, Receipt, FileText } from "lucide-react"
import { NovedadesModal } from "@/components/novedades-modal"
import { ResumenDiarioModal } from "@/components/resumen-diario-modal"
import { FindeModal } from "@/components/finde-modal"
import { VienenAPagarModal, CLAVE_VIENEN_A_PAGAR, cargarResumenVienenAPagar } from "@/components/vienen-a-pagar-modal"
import { contarCuotasAtrasadas } from "@/lib/vienen-a-pagar"
import { ChatAyuda } from "@/components/chat-ayuda"
import { GastoRapidoModal } from "@/components/gasto-rapido-modal"
import { GuiaAyudaModal } from "@/components/guia-ayuda-modal"
import { AtajosRapidos } from "@/components/atajos-rapidos"
import { AvisoSemanalModal, useAvisoSemanal } from "@/components/aviso-semanal"
import { useUI } from "@/lib/ui-context"
import { useProfile } from "@/lib/profile-context"

/**
 * Abre una ventana de Inicio al llegar con ?ver=resumen, ?ver=vienen-a-pagar o
 * ?ver=finde (los botones del asistente con IA llevan a de dónde sale lo que
 * respondió). Después saca el parámetro, para que el mismo botón vuelva a
 * abrirla. Va aparte y dentro de Suspense porque lee la dirección.
 */
function AbrirVentanaDeLaUrl({ abrir }: { abrir: (ver: string) => void }) {
  const ver = useSearchParams().get("ver")
  const router = useRouter()
  useEffect(() => {
    if (!ver) return
    abrir(ver)
    router.replace("/", { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver])
  return null
}

// El chat de Inicio quedó reemplazado por el botón flotante con historial.
const MOSTRAR_CHAT_INICIO = false

export default function HomePage() {
  const [novedadesOpen, setNovedadesOpen] = useState(false)
  const [resumenOpen, setResumenOpen] = useState(false)
  const [findeOpen, setFindeOpen] = useState(false)
  const [pagarOpen, setPagarOpen] = useState(false)
  const [gastoOpen, setGastoOpen] = useState(false)
  const [guiaOpen, setGuiaOpen] = useState(false)
  const { toggleSidebar } = useUI()
  const { perfilActivo } = useProfile()
  const puedeCargarGastos = perfilActivo?.id === "administracion" || perfilActivo?.id === "cobro"

  // Cotizaciones esperando aprobación. El botón aparece SOLO si hay alguna:
  // si no hay nada que revisar, no ensucia la pantalla. Mismo endpoint que
  // usa el puntito rojo del menú (components/sidebar.tsx).
  const puedeAprobarCotizaciones = perfilActivo?.id === "administracion" || perfilActivo?.id === "soporte"
  const [cotizacionesPendientes, setCotizacionesPendientes] = useState(0)

  useEffect(() => {
    if (!puedeAprobarCotizaciones) return
    let cancelado = false
    const traer = () => {
      fetch("/api/administracion/cotizaciones/pendientes")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelado && data?.ok) setCotizacionesPendientes(data.count || 0)
        })
        .catch(() => {})
    }
    traer()
    // Se refresca al volver a la pestaña: si aprobaste una en otra pantalla,
    // el botón tiene que acompañar.
    const alVolver = () => document.visibilityState === "visible" && traer()
    document.addEventListener("visibilitychange", alVolver)
    return () => {
      cancelado = true
      document.removeEventListener("visibilitychange", alVolver)
    }
  }, [puedeAprobarCotizaciones])

  // Cuotas atrasadas para el botón "Vienen a pagar". Misma clave y misma
  // carga que el modal (SWR comparte los datos), así el número coincide con
  // el recuadro "Atrasado" del modal. Solo para quienes cobran o administran:
  // al staff de eventos no le sirve y así no se pide el resumen de más.
  const veAtrasadas = perfilActivo?.id === "administracion" || perfilActivo?.id === "soporte" || perfilActivo?.id === "cobro"
  const { data: resumenPagar } = useSWR(veAtrasadas ? CLAVE_VIENEN_A_PAGAR : null, cargarResumenVienenAPagar)
  const cuotasAtrasadas = contarCuotasAtrasadas(resumenPagar?.vienenAPagar ?? [])

  // Aviso de los lunes (Administración y Soporte): se abre solo una vez por
  // semana y después queda en Novedades, con punto rojo mientras falte
  // finalizar eventos del finde pasado.
  const aviso = useAvisoSemanal(perfilActivo?.id)

  const handleBackgroundClick = () => {
    toggleSidebar()
  }

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden">
      {/* Full-bleed hero background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("/background.jpg")',
        }}
      />
      {/* Mobile background — portrait image for narrow screens */}
      <div
        className="absolute inset-0 bg-cover bg-top bg-no-repeat md:hidden"
        style={{
          backgroundImage: 'url("/background-mobile.jpg")',
        }}
      />
      {/* Dark overlay for depth - also handles click to toggle sidebar */}
      <div
        onClick={handleBackgroundClick}
        className="absolute inset-0 bg-black/30 cursor-pointer"
      />

      {/* Atajos rápidos a las pantallas que más usa el perfil: a la izquierda,
          debajo del botón de la IA (en el celular, abajo). Se pliegan. */}
      {perfilActivo && <AtajosRapidos perfil={perfilActivo} />}

      <Suspense fallback={null}>
        <AbrirVentanaDeLaUrl
          abrir={(ver) => {
            if (ver === "resumen") setResumenOpen(true)
            else if (ver === "vienen-a-pagar") setPagarOpen(true)
            else if (ver === "finde") setFindeOpen(true)
          }}
        />
      </Suspense>

      {/* Novedades + Resumen diario + Este finde - top right */}
      <div className="absolute top-5 right-5 z-10 flex flex-col items-end gap-2">
        {puedeAprobarCotizaciones && cotizacionesPendientes > 0 && (
          <Link
            href="/eventos/cotizaciones"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#c9a227] hover:bg-[#b8931f] text-[#1a1a1a] text-sm font-semibold transition-colors shadow-lg"
          >
            <FileText className="h-4 w-4" />
            <span>
              {cotizacionesPendientes} {cotizacionesPendientes === 1 ? "cotización" : "cotizaciones"} para revisar
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setNovedadesOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2d5a3d] hover:bg-[#3a6f4e] text-[#f5f0e8] text-sm font-medium transition-colors shadow-lg"
        >
          <Bell className="h-4 w-4" />
          <span>Novedades</span>
          {aviso.aplica && aviso.cantidadPendientes > 0 && (
            <span className="h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-[#f5f0e8]" aria-label="Hay eventos del finde pasado sin finalizar" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setResumenOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2d5a3d] hover:bg-[#3a6f4e] text-[#f5f0e8] text-sm font-medium transition-colors shadow-lg"
        >
          <FileBarChart className="h-4 w-4" />
          <span>Resumen</span>
        </button>
        <button
          type="button"
          onClick={() => setFindeOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2d5a3d] hover:bg-[#3a6f4e] text-[#f5f0e8] text-sm font-medium transition-colors shadow-lg"
        >
          <PartyPopper className="h-4 w-4" />
          <span>Este finde</span>
        </button>
        <button
          type="button"
          onClick={() => setPagarOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2d5a3d] hover:bg-[#3a6f4e] text-[#f5f0e8] text-sm font-medium transition-colors shadow-lg"
        >
          <HandCoins className="h-4 w-4" />
          <span>Vienen a pagar</span>
          {veAtrasadas && cuotasAtrasadas > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
              {cuotasAtrasadas} {cuotasAtrasadas === 1 ? "atrasada" : "atrasadas"}
            </span>
          )}
        </button>
        {puedeCargarGastos && (
          <button
            type="button"
            onClick={() => setGastoOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2d5a3d] hover:bg-[#3a6f4e] text-[#f5f0e8] text-sm font-medium transition-colors shadow-lg"
          >
            <Receipt className="h-4 w-4" />
            <span>Cargar gastos</span>
          </button>
        )}
      </div>

      {/* Chat de ayuda con IA de Inicio: reemplazado por el botón flotante de
          components/chat-ia-flotante.tsx (todas las pantallas, con historial). */}
      {MOSTRAR_CHAT_INICIO && perfilActivo?.id === "soporte" && (
        <div className="absolute bottom-8 left-1/2 z-10 w-[calc(100%-2.5rem)] max-w-xl -translate-x-1/2 flex justify-center">
          <ChatAyuda />
        </div>
      )}

      {/* Botón de ayuda, abajo a la derecha: abre la guía de uso */}
      {/* Con el botón flotante de la IA (abajo a la derecha), este va a su izquierda. */}
      <div className="absolute bottom-6 right-5 z-10">
        <button
          type="button"
          onClick={() => setGuiaOpen(true)}
          title="Guía de uso"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#f5f0e8] hover:bg-[#e8e0d0] text-[#2d5a3d] shadow-lg transition-colors"
          aria-label="Ayuda"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      <NovedadesModal
        open={novedadesOpen}
        onOpenChange={setNovedadesOpen}
        avisoSemanal={aviso.aplica ? { pendientes: aviso.cantidadPendientes } : null}
      />
      <AvisoSemanalModal open={aviso.abierto} onClose={aviso.cerrar} />
      <ResumenDiarioModal open={resumenOpen} onOpenChange={setResumenOpen} soloDiario={perfilActivo?.id === "cobro"} />
      <FindeModal open={findeOpen} onOpenChange={setFindeOpen} />
      <VienenAPagarModal open={pagarOpen} onOpenChange={setPagarOpen} />
      <GastoRapidoModal open={gastoOpen} onOpenChange={setGastoOpen} />
      <GuiaAyudaModal open={guiaOpen} onOpenChange={setGuiaOpen} />
    </div>
  )
}
