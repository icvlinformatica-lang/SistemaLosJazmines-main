"use client"

// Chat de ayuda con IA sobre el fondo de Inicio — solo perfil Soporte.
// Pregunta cómo usar el sistema o datos de eventos, cuotas y cajas; el
// endpoint /api/chat responde y puede devolver botones a pantallas.
import { useRef, useState } from "react"
import Link from "next/link"
import { Sparkles, Send, Loader2, ArrowRight } from "lucide-react"

interface AccionChat {
  etiqueta: string
  href: string
}

interface Mensaje {
  role: "user" | "assistant"
  content: string
  acciones?: AccionChat[]
}

// Solo direcciones internas del sistema ("/eventos/..."), nunca externas.
function accionesValidas(valor: unknown): AccionChat[] {
  if (!Array.isArray(valor)) return []
  return valor.filter(
    (a): a is AccionChat =>
      !!a &&
      typeof a.etiqueta === "string" &&
      typeof a.href === "string" &&
      a.href.startsWith("/") &&
      !a.href.startsWith("//"),
  )
}

export function ChatAyuda() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState("")
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)

  const enviar = async () => {
    const pregunta = input.trim()
    if (!pregunta || cargando) return
    const nuevos: Mensaje[] = [...mensajes, { role: "user", content: pregunta }]
    setMensajes(nuevos)
    setInput("")
    setCargando(true)
    setAbierto(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Los botones no viajan: el servidor solo usa el texto de la charla.
        body: JSON.stringify({ messages: nuevos.map(({ role, content }) => ({ role, content })) }),
      })
      const data = await res.json()
      const texto = res.ok ? data.text : data.error || "No pude responder. Probá de nuevo."
      const acciones = res.ok ? accionesValidas(data.acciones) : []
      setMensajes((prev) => [...prev, { role: "assistant", content: texto, acciones }])
    } catch {
      setMensajes((prev) => [...prev, { role: "assistant", content: "Error de conexión. Probá de nuevo." }])
    } finally {
      setCargando(false)
      setTimeout(() => listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" }), 50)
    }
  }

  return (
    <div className="w-full max-w-xl">
      {abierto && mensajes.length > 0 && (
        <div
          ref={listaRef}
          className="mb-2 max-h-[50vh] overflow-y-auto rounded-xl border border-[#f5f0e8]/20 bg-black/50 p-3 backdrop-blur-sm"
        >
          <div className="flex flex-col gap-2">
            {mensajes.map((m, i) => (
              <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-[85%]"}>
                <div
                  className={
                    m.role === "user"
                      ? "rounded-lg bg-[#2d5a3d] px-3 py-1.5 text-sm text-[#f5f0e8]"
                      : "whitespace-pre-line break-words rounded-lg bg-[#f5f0e8]/10 px-3 py-1.5 text-sm leading-relaxed text-[#f5f0e8]"
                  }
                >
                  {m.content}
                </div>
                {m.acciones && m.acciones.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.acciones.map((a) => (
                      <Link
                        key={a.href}
                        href={a.href}
                        prefetch={false}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#c9a227]/50 bg-[#c9a227]/15 px-2.5 py-1 text-xs font-medium text-[#f5f0e8] transition-colors hover:bg-[#c9a227]/30"
                      >
                        <span className="truncate">{a.etiqueta}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {cargando && (
              <div className="self-start flex items-center gap-2 px-3 py-1.5 text-sm text-[#f5f0e8]/70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Pensando...
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-[#f5f0e8]/25 bg-black/50 px-3 py-2 backdrop-blur-sm focus-within:border-[#f5f0e8]/50 transition-colors">
        <Sparkles className="h-4 w-4 shrink-0 text-[#c9a227]" />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) enviar()
          }}
          placeholder="Preguntale a la IA... ej: ¿cuánto debe el evento del 6/10?"
          className="flex-1 bg-transparent text-sm text-[#f5f0e8] placeholder:text-[#f5f0e8]/40 outline-none"
          aria-label="Pregunta para el asistente de ayuda"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={cargando || !input.trim()}
          className="shrink-0 rounded-lg bg-[#2d5a3d] p-1.5 text-[#f5f0e8] transition-colors hover:bg-[#3a6f4e] disabled:opacity-40"
          aria-label="Enviar pregunta"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
