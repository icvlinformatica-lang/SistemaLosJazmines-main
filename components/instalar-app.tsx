"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { Download } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  PASOS_INSTALACION,
  plataformaInstalacion,
  yaInstalada,
  type PlataformaInstalacion,
} from "@/lib/instalar-app"

// Chrome en Android avisa una sola vez, apenas carga la página, que la app se
// puede instalar (evento beforeinstallprompt). Si la persona entra por otra
// pantalla y después va a Inicio, el aviso ya pasó: por eso se escucha acá, al
// cargar el módulo (lo importa app-shell), y se guarda para cuando toque el botón.
interface EventoInstalar extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let eventoGuardado: EventoInstalar | null = null
let instaladaRecien = false
const avisos = new Set<() => void>()
const avisar = () => avisos.forEach((f) => f())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Sin esto Chrome muestra su propia barrita; preferimos nuestro botón.
    e.preventDefault()
    eventoGuardado = e as EventoInstalar
    avisar()
  })
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null
    instaladaRecien = true
    avisar()
  })
}

function suscribir(f: () => void) {
  avisos.add(f)
  return () => {
    avisos.delete(f)
  }
}

/**
 * Botón de la pantalla de elegir perfil (/login), abajo. No aparece si la app
 * ya está abierta instalada. className va en el contenedor, para ubicarlo.
 */
export function InstalarAppBoton({ className }: { className?: string }) {
  const evento = useSyncExternalStore(suscribir, () => eventoGuardado, () => null)
  const recien = useSyncExternalStore(suscribir, () => instaladaRecien, () => false)
  const [plataforma, setPlataforma] = useState<PlataformaInstalacion | null>(null)
  const [instalada, setInstalada] = useState(true)
  const [pasosOpen, setPasosOpen] = useState(false)

  // El aparato se mira recién en el navegador, para que el HTML del servidor
  // (que no sabe qué celular es) no muestre el botón y después lo esconda.
  useEffect(() => {
    setPlataforma(plataformaInstalacion(navigator.userAgent, navigator.maxTouchPoints))
    setInstalada(
      yaInstalada(
        window.matchMedia("(display-mode: standalone)").matches,
        (navigator as Navigator & { standalone?: boolean }).standalone,
      ),
    )
  }, [])

  if (!plataforma || instalada || recien) return null

  const instalar = async () => {
    if (evento && plataforma !== "ios") {
      await evento.prompt()
      const { outcome } = await evento.userChoice
      // El aviso de Chrome sirve una sola vez: si dijo que no, quedan los pasos a mano.
      eventoGuardado = null
      if (outcome === "accepted") instaladaRecien = true
      avisar()
      return
    }
    setPasosOpen(true)
  }

  // stopPropagation: en /login tocar el fondo hace otra cosa, y los clics de
  // la ventanita de pasos también suben por acá (portal de React).
  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={instalar}
        className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#f5f0e8] px-4 py-2.5 text-sm font-medium text-[#2d5a3d] shadow-lg transition-colors hover:bg-[#e8e0d0]"
      >
        <Download className="h-4 w-4" />
        <span>Instalar app</span>
      </button>

      <Dialog open={pasosOpen} onOpenChange={setPasosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar la app</DialogTitle>
            <DialogDescription>
              {plataforma === "ios"
                ? "En iPhone se instala desde Safari, en tres pasos:"
                : plataforma === "android"
                  ? "En Android se instala desde Chrome, en tres pasos:"
                  : "En la compu se instala desde el navegador, en tres pasos:"}
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {PASOS_INSTALACION[plataforma].map((paso, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2d5a3d] text-xs font-semibold text-[#f5f0e8]">
                  {i + 1}
                </span>
                <span className="pt-0.5">{paso}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Queda el ícono en la pantalla de inicio y se abre a pantalla completa. Si ya la tenías, borrala y
            volvé a agregarla para ver el ícono nuevo.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
