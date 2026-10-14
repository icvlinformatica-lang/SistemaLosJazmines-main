"use client"

// Cuadro "Anotaciones" de la ventana de un evento: cada perfil escribe la
// suya y se guarda sola (ver app/api/eventos/[id]/anotacion). Va en las
// ventanas de Próximos eventos del staff, Guías de producción y el
// Calendario.
//
// Guardado automático: espera ESPERA_GUARDADO_MS desde la última tecla y
// manda UN pedido a la vez; si mientras tanto se siguió escribiendo, al
// terminar manda lo último. Así un pedido viejo nunca pisa uno nuevo. Al
// cerrar la ventana con algo sin guardar, lo manda igual (keepalive).

import { useCallback, useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Check, Loader2, AlertCircle, NotebookPen } from "lucide-react"
import { ESPERA_GUARDADO_MS, LARGO_MAX_ANOTACION } from "@/lib/anotaciones-evento"

type Estado = "cargando" | "listo" | "guardando" | "guardado" | "error" | "no-disponible"

export function AnotacionEvento({ eventoId }: { eventoId: string }) {
  const [texto, setTexto] = useState("")
  const [estado, setEstado] = useState<Estado>("cargando")
  const url = `/api/eventos/${encodeURIComponent(eventoId)}/anotacion`

  // Lo último escrito, lo último guardado y si hay un pedido en vuelo.
  const ultimoRef = useRef("")
  const guardadoRef = useRef("")
  const enVueloRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let vivo = true
    setEstado("cargando")
    fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!vivo) return
        if (!res.ok || !data) return setEstado("error")
        if (data.disponible === false) return setEstado("no-disponible")
        const t = typeof data.texto === "string" ? data.texto : ""
        ultimoRef.current = t
        guardadoRef.current = t
        setTexto(t)
        setEstado("listo")
      })
      .catch(() => vivo && setEstado("error"))
    return () => {
      vivo = false
    }
  }, [url])

  const guardar = useCallback(async () => {
    if (enVueloRef.current) return
    const aGuardar = ultimoRef.current
    if (aGuardar === guardadoRef.current) return
    enVueloRef.current = true
    setEstado("guardando")
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: aGuardar }),
      })
      if (res.status === 503) {
        setEstado("no-disponible")
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      guardadoRef.current = aGuardar
      setEstado("guardado")
    } catch {
      setEstado("error")
    } finally {
      enVueloRef.current = false
    }
    // Se siguió escribiendo mientras se guardaba: mandar lo último.
    if (ultimoRef.current !== guardadoRef.current) void guardar()
  }, [url])

  // Al cerrar la ventana: si quedó algo sin guardar, mandarlo igual.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (ultimoRef.current !== guardadoRef.current) {
        fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto: ultimoRef.current }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [url])

  const onChange = (valor: string) => {
    const t = valor.slice(0, LARGO_MAX_ANOTACION)
    setTexto(t)
    ultimoRef.current = t
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void guardar(), ESPERA_GUARDADO_MS)
  }

  const deshabilitado = estado === "cargando" || estado === "no-disponible"

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          Anotaciones
        </h4>
        <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
          {estado === "cargando" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
            </>
          )}
          {estado === "guardando" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
            </>
          )}
          {estado === "guardado" && (
            <>
              <Check className="h-3 w-3 text-emerald-600" /> Guardado
            </>
          )}
          {estado === "error" && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3 w-3" /> No se guardó, seguí escribiendo para reintentar
            </span>
          )}
        </span>
      </div>
      {estado === "no-disponible" ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          Las anotaciones todavía no están habilitadas.
        </p>
      ) : (
        <Textarea
          value={texto}
          onChange={(e) => onChange(e.target.value)}
          disabled={deshabilitado}
          placeholder="Escribí acá lo que necesites recordar de este evento. Se guarda solo."
          className="min-h-40 text-sm"
          maxLength={LARGO_MAX_ANOTACION}
        />
      )}
    </div>
  )
}
