"use client"

// Botón flotante del chat con IA, en todas las pantallas. Arranca arriba a
// la izquierda, al lado del panel lateral, y se puede arrastrar a cualquier
// lado (la posición queda guardada en ese navegador). El chat se abre pegado
// al botón (lib/chat-ia-posicion.ts). Solo Administración y Soporte (lo decide app-shell; el servidor lo vuelve
// a chequear). Al abrirlo carga el historial guardado de quien entró: cada
// persona (Diego, Leila, Ricky, Soporte) tiene su chat, que no se borra.
// Soporte puede elegir y leer el chat de los demás, sin escribir en él.
// La IA responde cómo usar el sistema y consulta eventos, cuotas y cajas en
// solo lectura (/api/chat); puede devolver botones a pantallas.
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Sparkles, Send, Loader2, ArrowRight, X } from "lucide-react"
import {
  UMBRAL_ARRASTRE_IA,
  ajustarBoton,
  leerPosicionGuardada,
  posicionInicialBoton,
  posicionPanel,
  type Pantalla,
  type Punto,
} from "@/lib/chat-ia-posicion"
import { tarjetasValidas, type TarjetaEventoChat } from "@/lib/chat-ia-tarjetas"
import { TarjetaEventoChatIA } from "@/components/chat-ia-tarjeta-evento"
import { propuestaGastoValida, type PropuestaGastoChat } from "@/lib/chat-ia-gasto"
import { TarjetaGastoChatIA } from "@/components/chat-ia-tarjeta-gasto"
import { propuestaCobroValida, type PropuestaCobroChat } from "@/lib/chat-ia-cobro"
import { TarjetaCobroChatIA } from "@/components/chat-ia-tarjeta-cobro"
import {
  propuestaInsumoValida,
  propuestaRecetaValida,
  type PropuestaInsumoChat,
  type PropuestaRecetaChat,
} from "@/lib/chat-ia-catalogo"
import { TarjetaInsumoChatIA, TarjetaRecetaChatIA } from "@/components/chat-ia-tarjeta-catalogo"
import { tablasValidas, type TablaEventosChat } from "@/lib/chat-ia-tabla"
import { TablaEventosChatIA } from "@/components/chat-ia-tabla-eventos"

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
  /** Tarjetas de eventos con su plata (armadas en el servidor). */
  tarjetas?: TarjetaEventoChat[]
  /** Tablas de cantidad de eventos por salón y mes (armadas en el servidor). */
  tablas?: TablaEventosChat[]
  /** Gasto propuesto por la IA, a confirmar con el botón. */
  gasto?: PropuestaGastoChat | null
  /** Cobro de cuota propuesto por la IA, a confirmar con el botón. */
  cobro?: PropuestaCobroChat | null
  /** Insumo y receta nuevos propuestos por la IA, a confirmar con el botón. */
  insumo?: PropuestaInsumoChat | null
  receta?: PropuestaRecetaChat | null
  fecha?: string
  /** Error que se muestra solo en esta pantalla (no se guarda). */
  error?: boolean
}

/** Perfiles con el botón (el mismo corte que PERFILES_CHAT_IA en lib/chat-ia-historial.ts, del servidor). */
export const PERFILES_CON_CHAT_IA = ["administracion", "soporte"]


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

/** Dónde guarda el navegador la posición del botón (solo comodidad de cada compu). */
const CLAVE_POSICION = "lj_chat_ia_posicion"
/** El contenedor del contenido (app-shell); el botón arranca a su izquierda arriba. */
export const ID_CONTENIDO_PRINCIPAL = "contenido-principal"

export function ChatIAFlotante({ perfilId }: { perfilId: string }) {
  const [abierto, setAbierto] = useState(false)
  // Posición: hasta que se mueve, sigue al borde del panel lateral.
  const [listo, setListo] = useState(false)
  const [pantalla, setPantalla] = useState<Pantalla>({ ancho: 1024, alto: 768 })
  const [bordeContenido, setBordeContenido] = useState(0)
  const [movido, setMovido] = useState<Punto | null>(null)
  const arrastreRef = useRef<{ x: number; y: number; origen: Punto; movio: boolean } | null>(null)
  const recienArrastradoRef = useRef(false)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [cargado, setCargado] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [hayMas, setHayMas] = useState(false)
  const [historialDisponible, setHistorialDisponible] = useState(true)
  const [input, setInput] = useState("")
  const [enviando, setEnviando] = useState(false)
  // De quién es el chat que se ve, si es el propio y (solo Soporte) cuáles hay.
  const [usuario, setUsuario] = useState("")
  const [propio, setPropio] = useState(true)
  const [chats, setChats] = useState<string[]>([])
  const listaRef = useRef<HTMLDivElement>(null)
  const cargadoRef = useRef(false)
  // Chat elegido en el selector de Soporte ("" = el propio).
  const verDeRef = useRef("")
  // De quién son los mensajes que hay en pantalla.
  const usuarioRef = useRef("")

  const bajarAlFinal = () =>
    setTimeout(() => listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" }), 50)

  const cargarHistorial = useCallback(async (antes?: string) => {
    setCargandoHistorial(true)
    const de = verDeRef.current
    try {
      const params = new URLSearchParams()
      if (antes) params.set("antes", antes)
      if (de) params.set("de", de)
      const res = await fetch(`/api/chat/historial${params.size > 0 ? `?${params}` : ""}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      // Si mientras tanto se eligió otro chat, esta respuesta ya no sirve.
      if (verDeRef.current !== de) return
      const deQuien = typeof data.usuario === "string" ? data.usuario : ""
      // Si cambió la persona (otro entró en este navegador), no se mezclan los chats.
      const otraPersona = usuarioRef.current !== "" && deQuien !== usuarioRef.current
      usuarioRef.current = deQuien
      setUsuario(deQuien)
      setPropio(data.propio !== false)
      if (Array.isArray(data.chats)) setChats(data.chats.filter((c: unknown): c is string => typeof c === "string"))
      const traidos: MensajeChat[] = (Array.isArray(data.mensajes) ? data.mensajes : []).map(
        (m: Record<string, unknown>) => ({
          id: String(m.id),
          rol: m.rol === "assistant" ? "assistant" : "user",
          contenido: String(m.contenido ?? ""),
          perfil: typeof m.perfil === "string" ? m.perfil : undefined,
          acciones: accionesValidas(m.acciones),
          tarjetas: tarjetasValidas(m.tarjetas),
          tablas: tablasValidas(m.tablas),
          gasto: propuestaGastoValida(m.gasto),
          cobro: propuestaCobroValida(m.cobro),
          insumo: propuestaInsumoValida(m.insumo),
          receta: propuestaRecetaValida(m.receta),
          fecha: typeof m.fecha === "string" ? m.fecha : undefined,
        }),
      )
      setHistorialDisponible(data.disponible !== false)
      // "Ver anteriores" depende de la primera carga o de la última página pedida.
      setHayMas((prev) => (antes || !cargadoRef.current || otraPersona ? data.hayMas === true : prev))
      setMensajes((prev) => {
        if (otraPersona) return traidos
        // Un gasto confirmado o cancelado en otra pestaña: se toma el estado guardado.
        const gastoGuardado = new Map(traidos.filter((m) => m.gasto).map((m) => [m.id, m.gasto]))
        prev = prev.map((m) => (gastoGuardado.has(m.id) ? { ...m, gasto: gastoGuardado.get(m.id) } : m))
        // Lo mismo con un cobro.
        const cobroGuardado = new Map(traidos.filter((m) => m.cobro).map((m) => [m.id, m.cobro]))
        prev = prev.map((m) => (cobroGuardado.has(m.id) ? { ...m, cobro: cobroGuardado.get(m.id) } : m))
        // Y con un insumo o una receta.
        const insumoGuardado = new Map(traidos.filter((m) => m.insumo).map((m) => [m.id, m.insumo]))
        prev = prev.map((m) => (insumoGuardado.has(m.id) ? { ...m, insumo: insumoGuardado.get(m.id) } : m))
        const recetaGuardada = new Map(traidos.filter((m) => m.receta).map((m) => [m.id, m.receta]))
        prev = prev.map((m) => (recetaGuardada.has(m.id) ? { ...m, receta: recetaGuardada.get(m.id) } : m))
        // Los anteriores van arriba; sin repetir los que ya están.
        const ids = new Set(prev.map((m) => m.id))
        const nuevos = traidos.filter((m) => !ids.has(m.id))
        // Al reabrir, lo nuevo (por ejemplo, desde otra pestaña) va al final.
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

  // Mide la pantalla y dónde termina el panel lateral (cambia al abrirlo o cerrarlo).
  useEffect(() => {
    try {
      setMovido(leerPosicionGuardada(localStorage.getItem(CLAVE_POSICION)))
    } catch {
      // sin almacenamiento: arranca en la posición inicial
    }
    const contenido = document.getElementById(ID_CONTENIDO_PRINCIPAL)
    const medir = () => {
      setPantalla({ ancho: window.innerWidth, alto: window.innerHeight })
      setBordeContenido(contenido ? contenido.getBoundingClientRect().left : 0)
    }
    medir()
    setListo(true)
    window.addEventListener("resize", medir)
    const observador = contenido && typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null
    if (contenido) observador?.observe(contenido)
    return () => {
      window.removeEventListener("resize", medir)
      observador?.disconnect()
    }
  }, [])

  const boton = ajustarBoton(movido ?? posicionInicialBoton(bordeContenido), pantalla)
  const panel = posicionPanel(boton, pantalla)

  // Arrastrar: si el dedo o el mouse se mueve poco, cuenta como un toque (abre o cierra).
  const alApretar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    arrastreRef.current = { x: e.clientX, y: e.clientY, origen: boton, movio: false }
  }
  const alMover = (e: React.PointerEvent<HTMLButtonElement>) => {
    const a = arrastreRef.current
    if (!a) return
    const dx = e.clientX - a.x
    const dy = e.clientY - a.y
    if (!a.movio && Math.hypot(dx, dy) < UMBRAL_ARRASTRE_IA) return
    a.movio = true
    setMovido(ajustarBoton({ x: a.origen.x + dx, y: a.origen.y + dy }, pantalla))
  }
  const alSoltar = () => {
    const a = arrastreRef.current
    arrastreRef.current = null
    if (!a) return
    recienArrastradoRef.current = a.movio
    if (a.movio) {
      setMovido((p) => {
        try {
          if (p) localStorage.setItem(CLAVE_POSICION, JSON.stringify(p))
        } catch {
          // sin almacenamiento: la posición dura hasta recargar
        }
        return p
      })
    }
  }

  // Cada vez que se abre, trae lo último.
  useEffect(() => {
    if (abierto) cargarHistorial()
  }, [abierto, cargarHistorial])

  // Soporte cambia de chat: se vacía la pantalla y se carga el elegido.
  const elegirChat = (nombre: string) => {
    verDeRef.current = nombre
    cargadoRef.current = false
    setCargado(false)
    setMensajes([])
    setHayMas(false)
    cargarHistorial()
  }

  const enviar = async () => {
    const pregunta = input.trim()
    if (!pregunta || enviando || !propio) return
    const id = nuevoId()
    const pendiente: MensajeChat = { id, rol: "user", contenido: pregunta, perfil: perfilId, fecha: new Date().toISOString() }
    // La IA recibe los últimos mensajes de la charla (sin los errores locales).
    const contexto = [...mensajes.filter((m) => !m.error), pendiente]
      .slice(-20)
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
            contenido:
              String(data.text ?? "") +
              (data.gastoSinGuardar
                ? "\n\nOjo: no pude dejar listo el botón para cargar el gasto porque el chat no se guardó. Cargalo desde \"Cargar gastos\" en Inicio."
                : "") +
              (data.cobroSinGuardar
                ? "\n\nOjo: no pude dejar listo el botón para cobrar porque el chat no se guardó. Cobralo desde Cobrar cuota."
                : "") +
              (data.insumoSinGuardar
                ? "\n\nOjo: no pude dejar listo el botón para cargar el insumo porque el chat no se guardó. Cargalo desde Almacén."
                : "") +
              (data.recetaSinGuardar
                ? "\n\nOjo: no pude dejar listo el botón para cargar la receta porque el chat no se guardó. Cargala desde Recetario."
                : ""),
            acciones: accionesValidas(data.acciones),
            tarjetas: tarjetasValidas(data.tarjetas),
            tablas: tablasValidas(data.tablas),
            gasto: propuestaGastoValida(data.gasto),
            cobro: propuestaCobroValida(data.cobro),
            insumo: propuestaInsumoValida(data.insumo),
            receta: propuestaRecetaValida(data.receta),
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
          style={{ left: panel.x, top: panel.y, width: panel.ancho, height: panel.alto }}
          className="fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-[#2d5a3d]/30 bg-[#f5f0e8] shadow-2xl"
        >
          <div className="flex items-center gap-2 bg-[#2d5a3d] px-4 py-2.5 text-[#f5f0e8]">
            <Sparkles className="h-4 w-4 text-[#d4a533]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Asistente IA</p>
              {chats.length > 1 ? (
                <select
                  value={usuario}
                  onChange={(e) => elegirChat(e.target.value)}
                  disabled={cargandoHistorial || enviando}
                  className="mt-0.5 max-w-full rounded bg-white/10 px-1 py-0.5 text-[11px] text-[#f5f0e8] outline-none"
                  aria-label="Elegir de quién es el chat"
                >
                  {chats.map((c) => (
                    <option key={c} value={c} className="text-gray-900">
                      {c === "Soporte" ? "Mi chat (Soporte)" : `Chat de ${c}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="truncate text-[11px] leading-tight text-[#f5f0e8]/70">
                  {usuario ? `Chat de ${usuario}` : "Tu chat"}
                </p>
              )}
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
                El historial todavía no se está guardando: falta preparar su tabla en la base. El chat responde igual.
              </p>
            )}
            {cargandoHistorial && mensajes.length === 0 && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversación...
              </div>
            )}
            {cargado && mensajes.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500">
                {propio
                  ? 'Preguntale cómo usar el sistema o por un evento, por ejemplo: "¿cuánto debe el evento del 6/10?"'
                  : `${usuario} todavía no usó el asistente.`}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {mensajes.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.rol === "user"
                      ? "self-end max-w-[85%]"
                      : (m.tarjetas && m.tarjetas.length > 0) || (m.tablas && m.tablas.length > 0) || m.gasto || m.cobro || m.insumo || m.receta
                        ? "self-stretch"
                        : "self-start max-w-[90%]"
                  }
                >
                  {m.rol === "user" && m.fecha && (
                    <p className="mb-0.5 text-right text-[10px] text-gray-500">{horaCorta(m.fecha)}</p>
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
                  {m.gasto && (
                    <div className="mt-1.5">
                      <TarjetaGastoChatIA
                        gasto={m.gasto}
                        mensajeId={m.id}
                        propio={propio}
                        onResuelto={(g) =>
                          setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, gasto: g } : x)))
                        }
                        onIr={() => {
                          if (window.innerWidth < 640) setAbierto(false)
                        }}
                      />
                    </div>
                  )}
                  {m.cobro && (
                    <div className="mt-1.5">
                      <TarjetaCobroChatIA
                        cobro={m.cobro}
                        mensajeId={m.id}
                        propio={propio}
                        onResuelto={(c) =>
                          setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, cobro: c } : x)))
                        }
                        onIr={() => {
                          if (window.innerWidth < 640) setAbierto(false)
                        }}
                      />
                    </div>
                  )}
                  {m.tablas && m.tablas.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {m.tablas.map((t, i) => (
                        <TablaEventosChatIA key={`${t.desde}-${t.hasta}-${i}`} tabla={t} />
                      ))}
                    </div>
                  )}
                  {m.insumo && (
                    <div className="mt-1.5">
                      <TarjetaInsumoChatIA
                        insumo={m.insumo}
                        mensajeId={m.id}
                        propio={propio}
                        onResuelto={(i) =>
                          setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, insumo: i } : x)))
                        }
                        onIr={() => {
                          if (window.innerWidth < 640) setAbierto(false)
                        }}
                      />
                    </div>
                  )}
                  {m.receta && (
                    <div className="mt-1.5">
                      <TarjetaRecetaChatIA
                        receta={m.receta}
                        mensajeId={m.id}
                        propio={propio}
                        onResuelto={(r) =>
                          setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, receta: r } : x)))
                        }
                        onIr={() => {
                          if (window.innerWidth < 640) setAbierto(false)
                        }}
                      />
                    </div>
                  )}
                  {m.tarjetas && m.tarjetas.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {m.tarjetas.map((t) => (
                        <TarjetaEventoChatIA
                          key={t.id}
                          t={t}
                          // En el celular el chat tapa la pantalla: se cierra al ir.
                          onIr={() => {
                            if (window.innerWidth < 640) setAbierto(false)
                          }}
                        />
                      ))}
                    </div>
                  )}
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

          {!propio ? (
            <p className="border-t border-[#2d5a3d]/15 bg-white px-3 py-2.5 text-center text-xs text-gray-500">
              Estás viendo el chat de {usuario}: solo lectura.
            </p>
          ) : (
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
          )}
        </div>
      )}

      {/* z-[35]: por encima de las pantallas, pero debajo del panel lateral del celular cuando se abre. */}
      <button
        type="button"
        onPointerDown={alApretar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClick={() => {
          // Después de arrastrar no se abre ni se cierra.
          if (recienArrastradoRef.current) {
            recienArrastradoRef.current = false
            return
          }
          setAbierto((a) => !a)
        }}
        style={{ left: boton.x, top: boton.y, touchAction: "none", visibility: listo ? "visible" : "hidden" }}
        className="fixed z-[35] flex h-12 w-12 cursor-grab select-none items-center justify-center rounded-full bg-[#2d5a3d] text-[#d4a533] shadow-lg ring-2 ring-[#d4a533]/40 transition-colors hover:bg-[#3a6f4e] active:cursor-grabbing"
        aria-label={abierto ? "Cerrar el asistente con IA" : "Abrir el asistente con IA"}
        aria-expanded={abierto}
        title="Asistente IA (se puede arrastrar)"
      >
        {abierto ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>
    </div>
  )
}
