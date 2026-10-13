"use client"

// Botón flotante del chat con IA, abajo a la derecha en todas las pantallas.
// Solo Administración y Soporte (lo decide app-shell; el servidor lo vuelve
// a chequear). Al abrirlo carga el historial guardado: es una sola
// conversación compartida entre los dos perfiles y no se borra.
// La IA responde cómo usar el sistema y consulta eventos, cuotas y cajas en
// solo lectura (/api/chat); puede devolver botones a pantallas.
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Sparkles, Send, Loader2, ArrowRight, X } from "lucide-react"

interface AccionChat {
  etiqueta: string
  href: string
}

interface MensajeChat {
  id: string
  rol: "user" | "assistant"
  contenido: string
  perfil?: string
  acciones?: AccionChat[]
  fecha?: string
  /** Error que se muestra solo en esta pantalla (no se guarda). */
  error?: boolean
}

/** Perfiles con el botón (el mismo corte que PERFILES_CHAT_IA en lib/chat-ia-historial.ts, del servidor). */
export const PERFILES_CON_CHAT_IA = ["administracion", "soporte"]

const NOMBRE_PERFIL: Record<string, string> = { administracion: "Administración", soporte: "Soporte" }

// Solo direcciones internas del sistema ("/eventos/..."), nunca externas.
function accionesValidas(valor: unknown): AccionChat[] {
  if (!Array.isArray(valor)) return []
  return valor.filter(
    (a): a is AccionChat =>
      !!a && typeof a.etiqueta === "string" && typeof a.href === "string" && a.href.startsWith("/") && !a.href.startsWith("//"),
  )
}

function nuevoId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function horaCorta(fecha?: string): string {
  if (!fecha) return ""
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ChatIAFlotante({ perfilId }: { perfilId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [cargado, setCargado] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [hayMas, setHayMas] = useState(false)
  const [historialDisponible, setHistorialDisponible] = useState(true)
  const [input, setInput] = useState("")
  const [enviando, setEnviando] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)
  const cargadoRef = useRef(false)

  const bajarAlFinal = () =>
    setTimeout(() => listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" }), 50)

  const cargarHistorial = useCallback(async (antes?: string) => {
    setCargandoHistorial(true)
    try {
      const res = await fetch(`/api/chat/historial${antes ? `?antes=${encodeURIComponent(antes)}` : ""}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const traidos: MensajeChat[] = (Array.isArray(data.mensajes) ? data.mensajes : []).map(
        (m: Record<string, unknown>) => ({
          id: String(m.id),
          rol: m.rol === "assistant" ? "assistant" : "user",
          contenido: String(m.contenido ?? ""),
          perfil: typeof m.perfil === "string" ? m.perfil : undefined,
          acciones: accionesValidas(m.acciones),
          fecha: typeof m.fecha === "string" ? m.fecha : undefined,
        }),
      )
      setHistorialDisponible(data.disponible !== false)
      // "Ver anteriores" depende de la primera carga o de la última página pedida.
      setHayMas((prev) => (antes || !cargadoRef.current ? data.hayMas === true : prev))
      setMensajes((prev) => {
        // Los anteriores van arriba; sin repetir los que ya están.
        const ids = new Set(prev.map((m) => m.id))
        const nuevos = traidos.filter((m) => !ids.has(m.id))
        // Al reabrir, los que escribió el otro perfil mientras tanto van al final.
        return antes ? [...nuevos, ...prev] : [...prev, ...nuevos]
      })
      if (!antes) bajarAlFinal()
    } catch {
      setHistorialDisponible(false)
    } finally {
      setCargandoHistorial(false)
      cargadoRef.current = true
      setCargado(true)
    }
  }, [])

  // Cada vez que se abre, trae lo último (puede haber escrito el otro perfil).
  useEffect(() => {
    if (abierto) cargarHistorial()
  }, [abierto, cargarHistorial])

  const enviar = async () => {
    const pregunta = input.trim()
    if (!pregunta || enviando) return
    const id = nuevoId()
    const pendiente: MensajeChat = { id, rol: "user", contenido: pregunta, perfil: perfilId, fecha: new Date().toISOString() }
    // La IA recibe los últimos mensajes de la charla (sin los errores locales).
    const contexto = [...mensajes.filter((m) => !m.error), pendiente]
      .slice(-10)
      .map((m) => ({ role: m.rol, content: m.contenido }))
    setMensajes((prev) => [...prev, pendiente])
    setInput("")
    setEnviando(true)
    bajarAlFinal()
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, messages: contexto }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMensajes((prev) => [
          ...prev,
          { id: `${id}-error`, rol: "assistant", contenido: data.error || "No pude responder. Probá de nuevo.", error: true },
        ])
      } else {
        if (data.guardado === false) setHistorialDisponible(false)
        setMensajes((prev) => [
          ...prev,
          {
            id: `${id}-r`,
            rol: "assistant",
            contenido: String(data.text ?? ""),
            acciones: accionesValidas(data.acciones),
            perfil: perfilId,
            fecha: new Date().toISOString(),
          },
        ])
      }
    } catch {
      setMensajes((prev) => [
        ...prev,
        { id: `${id}-error`, rol: "assistant", contenido: "Error de conexión. Probá de nuevo.", error: true },
      ])
    } finally {
      setEnviando(false)
      bajarAlFinal()
    }
  }

  const masViejo = mensajes.find((m) => m.fecha && !m.error)?.fecha

  return (
    <div className="no-print">
      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente con IA"
          className="fixed bottom-20 right-4 z-50 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#2d5a3d]/30 bg-[#f5f0e8] shadow-2xl"
        >
          <div className="flex items-center gap-2 bg-[#2d5a3d] px-4 py-2.5 text-[#f5f0e8]">
            <Sparkles className="h-4 w-4 text-[#d4a533]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Asistente IA</p>
              <p className="text-[11px] leading-tight text-[#f5f0e8]/70">Historial compartido de Administración y Soporte</p>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md p-1 transition-colors hover:bg-white/10"
              aria-label="Cerrar el asistente"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listaRef} className="flex-1 overflow-y-auto px-3 py-3">
            {hayMas && (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => masViejo && cargarHistorial(masViejo)}
                  disabled={cargandoHistorial}
                  className="rounded-full border border-[#2d5a3d]/30 px-3 py-1 text-xs text-[#2d5a3d] transition-colors hover:bg-[#2d5a3d]/10 disabled:opacity-50"
                >
                  Ver mensajes anteriores
                </button>
              </div>
            )}
            {!historialDisponible && (
              <p className="mb-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
                El historial todavía no se está guardando: falta crear su tabla en la base. El chat responde igual.
              </p>
            )}
            {cargandoHistorial && mensajes.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversación...
              </div>
            )}
            {cargado && mensajes.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500">
                Preguntale cómo usar el sistema o por un evento, por ejemplo: "¿cuánto debe el evento del 6/10?"
              </p>
            )}
            <div className="flex flex-col gap-2">
              {mensajes.map((m) => (
                <div key={m.id} className={m.rol === "user" ? "self-end max-w-[85%]" : "self-start max-w-[90%]"}>
                  {m.rol === "user" && (m.perfil || m.fecha) && (
                    <p className="mb-0.5 text-right text-[10px] text-gray-500">
                      {[NOMBRE_PERFIL[m.perfil ?? ""] ?? m.perfil, horaCorta(m.fecha)].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div
                    className={
                      m.rol === "user"
                        ? "whitespace-pre-line break-words rounded-lg bg-[#2d5a3d] px-3 py-1.5 text-sm text-[#f5f0e8]"
                        : m.error
                          ? "whitespace-pre-line break-words rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-800"
                          : "whitespace-pre-line break-words rounded-lg bg-white px-3 py-1.5 text-sm leading-relaxed text-gray-900 shadow-sm"
                    }
                  >
                    {m.contenido}
                  </div>
                  {m.acciones && m.acciones.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.acciones.map((a) => (
                        <Link
                          key={a.href}
                          href={a.href}
                          prefetch={false}
                          // En el celular el chat tapa la pantalla: se cierra al ir.
                          onClick={() => {
                            if (window.innerWidth < 640) setAbierto(false)
                          }}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#d4a533]/60 bg-[#d4a533]/15 px-2.5 py-1 text-xs font-medium text-[#2d5a3d] transition-colors hover:bg-[#d4a533]/30"
                        >
                          <span className="truncate">{a.etiqueta}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {enviando && (
                <div className="self-start flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Pensando...
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-[#2d5a3d]/15 bg-white px-3 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) enviar()
              }}
              placeholder="Escribí tu pregunta..."
              maxLength={1000}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              aria-label="Pregunta para el asistente"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || !input.trim()}
              className="shrink-0 rounded-lg bg-[#2d5a3d] p-1.5 text-[#f5f0e8] transition-colors hover:bg-[#3a6f4e] disabled:opacity-40"
              aria-label="Enviar pregunta"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#2d5a3d] text-[#d4a533] shadow-lg ring-2 ring-[#d4a533]/40 transition-colors hover:bg-[#3a6f4e]"
        aria-label={abierto ? "Cerrar el asistente con IA" : "Abrir el asistente con IA"}
        aria-expanded={abierto}
        title="Asistente IA"
      >
        {abierto ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>
    </div>
  )
}
