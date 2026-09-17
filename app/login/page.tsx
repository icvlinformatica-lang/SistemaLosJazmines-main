"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, LogIn } from "lucide-react"
import { PERFILES, useProfile, tieneAccesoRapido, olvidarAccesosRapidos, type Perfil } from "@/lib/profile-context"

// Nota: los íconos de perfil (perfil.icon) son componentes de lucide-react
// definidos junto con cada perfil en lib/profile-context.tsx.

// Perfiles que primero preguntan quién ingresa antes de pedir el PIN o usar
// el acceso rápido. Cada perfil listado aquí muestra un paso extra con un
// botón por nombre; todos comparten el mismo PIN del perfil.
const NOMBRES_POR_PERFIL: Record<string, string[]> = {
  administracion: ["Diego", "Leila", "Ricky"],
  cobro: ["Aylin", "Salón"],
}

export default function LoginPage() {
  const router = useRouter()
  const { seleccionarPerfil, seleccionarPerfilRapido } = useProfile()

  const [pinsGuardados, setPinsGuardados] = useState<Record<string, boolean>>({})
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  // Sección "Evento" plegable, abierta por defecto. No se persiste entre
  // sesiones (se reabre siempre al recargar el login).
  const [eventoAbierto, setEventoAbierto] = useState(true)

  // Para los perfiles listados en NOMBRES_POR_PERFIL: primero se elige quién
  // ingresa y recién después se pide el PIN. Todos usan el mismo PIN del perfil.
  const [quienIngresa, setQuienIngresa] = useState<string | null>(null)

  // Nombre de la tile bajo el mouse: tooltip individual por perfil, solo
  // desktop (mouseenter/mouseleave no dispara en touch, así que en mobile
  // el tap sigue seleccionando directo, sin tooltip intermedio).
  const [tileHover, setTileHover] = useState<string | null>(null)

  // La columna de tiles (Gestión + Evento) oculta su scrollbar nativa (ver
  // DESIGN.md, regla 4) y en su lugar muestra flechas propias arriba/abajo
  // solo cuando hay más contenido para ese lado.
  const tilesScrollRef = useRef<HTMLDivElement>(null)
  const [puedeScrollArriba, setPuedeScrollArriba] = useState(false)
  const [puedeScrollAbajo, setPuedeScrollAbajo] = useState(false)

  const actualizarIndicadoresScroll = () => {
    const el = tilesScrollRef.current
    if (!el) return
    setPuedeScrollArriba(el.scrollTop > 4)
    setPuedeScrollAbajo(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }

  // Scroll suave: mueve ~70% del alto visible por click (una "página"
  // cómoda, no un salto chico y brusco) usando el scroll nativo del
  // navegador con animación (más prolijo y confiable que animarlo a mano).
  const scrollearTiles = (direccion: 1 | -1) => {
    const el = tilesScrollRef.current
    if (!el) return
    const distancia = el.clientHeight * 0.7
    const destino = Math.max(0, Math.min(el.scrollTop + direccion * distancia, el.scrollHeight - el.clientHeight))
    el.scrollTo({ top: destino, behavior: "smooth" })
  }

  useEffect(() => {
    actualizarIndicadoresScroll()
    window.addEventListener("resize", actualizarIndicadoresScroll)
    return () => window.removeEventListener("resize", actualizarIndicadoresScroll)
  }, [eventoAbierto])

  useEffect(() => {
    const guardados: Record<string, boolean> = {}
    PERFILES.forEach((p) => {
      guardados[p.id] = tieneAccesoRapido(p.id)
    })
    setPinsGuardados(guardados)
  }, [])

  const handleCardClick = async (id: string) => {
    // Perfiles con selección de usuario: preguntar quién ingresa antes de
    // pedir el PIN o usar el acceso rápido.
    if (NOMBRES_POR_PERFIL[id] && !quienIngresa) {
      setPerfilSeleccionado(id)
      setPinInput("")
      setError("")
      return
    }
    if (!NOMBRES_POR_PERFIL[id]) {
      setQuienIngresa(null)
      if (id === "soporte") {
        // Soporte también deja registro con su nombre en la actividad
        document.cookie = `lj_usuario=${encodeURIComponent("Soporte")}; path=/; max-age=${60 * 60 * 24 * 30}`
      } else {
        // Limpiar la atribución de actividad si entra otro perfil
        document.cookie = "lj_usuario=; path=/; max-age=0"
      }
    }
    if (pinsGuardados[id]) {
      setCargando(true)
      const ok = await seleccionarPerfilRapido(id)
      setCargando(false)
      if (ok) {
        router.push("/")
      } else {
        // Token vencido: pedir PIN
        setPinsGuardados((prev) => ({ ...prev, [id]: false }))
        setPerfilSeleccionado(id)
        setPinInput("")
        setError("")
      }
    } else {
      setPerfilSeleccionado(id)
      setPinInput("")
      setError("")
    }
  }

  // Elegir quién ingresa dentro de un perfil con selección de usuario (ver
  // NOMBRES_POR_PERFIL). Se guarda quién ingresó y luego sigue el flujo
  // normal (acceso rápido o PIN) para ese perfil.
  const handleElegirQuien = async (perfilId: string, nombre: string) => {
    setQuienIngresa(nombre)
    try {
      sessionStorage.setItem("admin_usuario", nombre)
    } catch {}
    // Cookie que el servidor lee para atribuir cada registro de actividad
    // a la persona que ingresó. Dura 30 días.
    document.cookie = `lj_usuario=${encodeURIComponent(nombre)}; path=/; max-age=${60 * 60 * 24 * 30}`
    if (pinsGuardados[perfilId]) {
      setCargando(true)
      const ok = await seleccionarPerfilRapido(perfilId)
      setCargando(false)
      if (ok) {
        router.push("/")
      } else {
        setPinsGuardados((prev) => ({ ...prev, [perfilId]: false }))
        setPinInput("")
        setError("")
      }
    }
  }

  const handleIngresar = async () => {
    if (!perfilSeleccionado || cargando) return
    setCargando(true)
    const ok = await seleccionarPerfil(perfilSeleccionado, pinInput)
    setCargando(false)
    if (ok) {
      router.push("/")
    } else {
      setError("PIN incorrecto")
    }
  }

  const handleOlvidarPins = () => {
    olvidarAccesosRapidos()
    setPinsGuardados({})
    setPerfilSeleccionado(null)
    setPinInput("")
    setError("")
    setQuienIngresa(null)
  }

  // Tocar el fondo (fuera de las tiles y del panel): cierra el panel de
  // "¿Quién ingresa?"/PIN si había uno abierto.
  const handleFondoClick = () => {
    if (perfilSeleccionado || quienIngresa) {
      setPerfilSeleccionado(null)
      setPinInput("")
      setError("")
      setQuienIngresa(null)
    }
  }

  const perfilActual = PERFILES.find((p) => p.id === perfilSeleccionado)
  const perfilesGestion = PERFILES.filter((p) => p.categoria === "gestion")
  const perfilesEvento = PERFILES.filter((p) => p.categoria === "evento")

  // El paso "¿Quién ingresa?"/PIN vive en un panel aparte, debajo de toda la
  // grilla (ver más abajo), para que ninguna tile cambie nunca de tamaño.
  const nombresPerfilActual = perfilActual ? NOMBRES_POR_PERFIL[perfilActual.id] : undefined
  const tieneSeleccionUsuarioActual = !!nombresPerfilActual
  const mostrarQuienPanel = !!perfilActual && tieneSeleccionUsuarioActual && !quienIngresa
  const esSeleccionadoPanel =
    !!perfilActual && !pinsGuardados[perfilActual.id] && (!tieneSeleccionUsuarioActual || !!quienIngresa)

  // Tile cuadrada y compacta, de tamaño FIJO en px (no 1fr — si no, en
  // pantallas anchas la tile se estira y el ícono queda perdido en el
  // medio). Sin texto ni panel adentro: solo el círculo de ícono, el ring
  // de "tile activa" (el panel de detalle vive aparte) y, en desktop, un
  // tooltip individual con el nombre al pasar el mouse.
  const renderPerfilCard = (perfil: Perfil) => {
    const pinGuardado = pinsGuardados[perfil.id]
    const esDorado = perfil.id === "cobro"
    const esActiva = perfilSeleccionado === perfil.id

    return (
      <button
        key={perfil.id}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          handleCardClick(perfil.id)
        }}
        onMouseEnter={() => setTileHover(perfil.id)}
        onMouseLeave={() => setTileHover((v) => (v === perfil.id ? null : v))}
        aria-label={perfil.nombre}
        className={`relative w-[88px] h-[88px] mb-[10px] rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center p-2 focus:outline-none ${
          esDorado
            ? "bg-gradient-to-b from-[#fdf6e3] to-[#f3e2a9] border border-[#d4af37]"
            : "bg-white"
        } ${esActiva ? (esDorado ? "ring-2 ring-[#c9a227]" : "ring-2 ring-[#1a3a2a]") : ""}`}
      >
        <div
          className="relative w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95 shadow"
          style={{ backgroundColor: esDorado ? "#ffffff" : perfil.color }}
        >
          <perfil.icon
            className="w-7 h-7"
            style={{ color: esDorado ? perfil.color : perfil.iconColor }}
          />
          {pinGuardado && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {tileHover === perfil.id && (
          <div className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg bg-[#1a3a2a] text-white text-xs px-2.5 py-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            {perfil.nombre}
          </div>
        )}
      </button>
    )
  }

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      onClick={handleFondoClick}
    >
      {/* Fondo: foto propia del login/selector de perfiles */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/background-perfiles.png")' }}
      />
      <div
        className="absolute inset-0 bg-cover bg-top bg-no-repeat md:hidden"
        style={{ backgroundImage: 'url("/background-perfiles-mobile.png")' }}
      />
      {/* Oscurecer un poco para que el texto y las tarjetas se lean bien */}
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 h-full flex flex-col items-center overflow-hidden px-6 py-6">

      {/* Header: altura fija, no se recorta nunca */}
      <div className="shrink-0 mb-6 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">Los Jazmines</h1>
        <p className="text-white/60 text-sm mt-1 tracking-widest uppercase">Sistema</p>
      </div>

      {/* Ocupa el resto del alto disponible (flex-1 min-h-0). Mobile (una
          columna, con flex `order`): el panel va arriba, empujando la
          grilla hacia abajo. Desktop (md+, grid de 2 columnas + fila
          minmax(0,1fr) para acotar la altura de la fila al contenedor):
          grilla a la izquierda, panel fijo a la derecha — la columna
          derecha existe siempre (con placeholder si no hay perfil
          elegido) para que el layout no salte de 1 a 2 columnas. Ningún
          nivel tiene overflow-x: si algo se desborda a lo ancho es un bug
          de layout, no algo para tapar con scroll horizontal. */}
      <div
        className="w-full max-w-[560px] md:max-w-3xl mx-auto flex-1 min-h-0 flex flex-col gap-6 md:gap-8 md:grid md:grid-cols-[1fr_320px] md:grid-rows-[minmax(0,1fr)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Columna/bloque del panel de "¿Quién ingresa?"/PIN: altura
            acotada a su contenido (md:self-start), nunca scroll propio.
            md:pt-[46px]: en desktop la columna de la izquierda arranca con
            el botón de scroll "arriba" (que reserva su alto aunque esté
            invisible) antes del label "Gestión" — este padding replica esa
            misma altura para que la tarjeta de PIN arranque a la altura
            del label, no más arriba. */}
        <div className="order-1 md:order-2 shrink-0 md:self-start md:pt-[46px]">
          {perfilActual && (mostrarQuienPanel || esSeleccionadoPanel) ? (
            <div
              className={`w-full rounded-2xl shadow-lg p-5 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
                perfilActual.id === "cobro"
                  ? "bg-gradient-to-b from-[#fdf6e3] to-[#f3e2a9] border border-[#d4af37]"
                  : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shadow shrink-0"
                  style={{ backgroundColor: perfilActual.id === "cobro" ? "#ffffff" : perfilActual.color }}
                >
                  <perfilActual.icon
                    className="w-5 h-5"
                    style={{ color: perfilActual.id === "cobro" ? perfilActual.color : perfilActual.iconColor }}
                  />
                </div>
                <p className="text-[#1a3a2a] font-semibold text-sm">{perfilActual.nombre}</p>
              </div>

              {/* Paso previo para perfiles con selección de usuario: elegir
                  quién ingresa. Los nombres se apilan de a pares por fila;
                  si sobra uno solo al final, ocupa el ancho completo. Esto
                  evita que los botones corten texto sin importar cuántos
                  nombres tenga el perfil. */}
              {mostrarQuienPanel && nombresPerfilActual && (
                <div className="w-full flex flex-col items-center gap-2">
                  <p className="text-xs font-semibold text-[#1a3a2a] text-center">{"¿Quién ingresa?"}</p>
                  <div className="w-full flex flex-col gap-2">
                    {Array.from({ length: Math.ceil(nombresPerfilActual.length / 2) }).map((_, filaIdx) => {
                      const nombresFila = nombresPerfilActual.slice(filaIdx * 2, filaIdx * 2 + 2)
                      return (
                        <div key={filaIdx} className="w-full flex gap-2">
                          {nombresFila.map((nombre) => (
                            <button
                              key={nombre}
                              type="button"
                              onClick={() => handleElegirQuien(perfilActual.id, nombre)}
                              disabled={cargando}
                              className="flex-1 rounded-lg px-2 py-2 text-sm font-semibold text-[#1a3a2a] border border-[#1a3a2a]/30 hover:bg-[#1a3a2a] hover:text-white transition-colors disabled:opacity-60"
                            >
                              {nombre}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                  {cargando && <p className="text-xs text-gray-400">Verificando...</p>}
                </div>
              )}

              {/* Input PIN */}
              {esSeleccionadoPanel && (
                <div className="w-full flex flex-col items-center gap-2">
                  {tieneSeleccionUsuarioActual && quienIngresa && (
                    <p className="text-xs text-gray-500">
                      Ingresa: <span className="font-semibold text-[#1a3a2a]">{quienIngresa}</span>
                    </p>
                  )}
                  <input
                    type="password"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, ""))
                      setError("")
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleIngresar()}
                    placeholder="PIN"
                    autoFocus
                    className="w-full text-center rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-[#1a3a2a] focus:ring-1 focus:ring-[#1a3a2a] tracking-widest text-[#1a3a2a] placeholder-gray-300 transition-colors"
                  />
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  <button
                    type="button"
                    onClick={handleIngresar}
                    disabled={cargando}
                    className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-white bg-[#1a3a2a] hover:bg-[#25503c] transition-colors disabled:opacity-60"
                  >
                    {cargando ? "Verificando..." : "Ingresar"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center gap-2 h-full min-h-[200px] rounded-2xl shadow-lg bg-white text-center px-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#2f8f5b] shadow">
                <LogIn className="w-5 h-5 text-white" />
              </div>
              <p className="text-[#1a3a2a] font-semibold text-sm">Bienvenido</p>
              <p className="text-gray-500 text-xs">Elegí un perfil para ingresar</p>
            </div>
          )}
        </div>

        {/* Columna/bloque de la grilla de perfiles: Gestión + Evento. Única
            parte de la pantalla con scroll propio (vertical, nunca
            horizontal) — si Gestión + Evento no entran en el alto
            disponible, scrollea acá adentro y no la página entera. Sin
            scrollbar nativa (DESIGN.md, regla 4): en su lugar, botones
            propios arriba/abajo, POR FUERA de la tarjeta con scroll, que
            la scrollean al apretarlos (siempre ocupan su lugar para que
            el alto de la tarjeta no salte; se atenúan cuando no hay más
            para ver en esa dirección). */}
        <div className="order-2 md:order-1 flex flex-col flex-1 min-h-0">
          <button
            type="button"
            onClick={() => scrollearTiles(-1)}
            disabled={!puedeScrollArriba}
            tabIndex={puedeScrollArriba ? 0 : -1}
            aria-hidden={!puedeScrollArriba}
            aria-label="Ver perfiles anteriores"
            className={`shrink-0 flex justify-center py-1 transition-opacity ${
              puedeScrollArriba ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[#2f8f5b] shadow">
              <ChevronUp className="w-3.5 h-3.5 text-white" />
            </span>
          </button>
          <div
            ref={tilesScrollRef}
            onScroll={actualizarIndicadoresScroll}
            className="no-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1"
          >
            {/* Sección Gestión: siempre visible */}
            <div>
              <p className="inline-block bg-white text-black text-xs font-semibold tracking-widest uppercase rounded-full px-2.5 py-1 mb-3">
                Gestión
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,88px))] justify-center gap-5">
                {perfilesGestion.map(renderPerfilCard)}
              </div>
            </div>

            {/* Sección Evento: plegable, abierta por defecto */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <p className="inline-block bg-white text-black text-xs font-semibold tracking-widest uppercase rounded-full px-2.5 py-1">
                  Evento
                </p>
                <button
                  type="button"
                  onClick={() => setEventoAbierto((v) => !v)}
                  className="text-white/50 hover:text-white/80 transition-colors"
                  aria-label={eventoAbierto ? "Plegar Evento" : "Desplegar Evento"}
                >
                  {eventoAbierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
              {eventoAbierto && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,88px))] justify-center gap-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {perfilesEvento.map(renderPerfilCard)}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollearTiles(1)}
            disabled={!puedeScrollAbajo}
            tabIndex={puedeScrollAbajo ? 0 : -1}
            aria-hidden={!puedeScrollAbajo}
            aria-label="Ver más perfiles"
            className={`shrink-0 flex justify-center py-1 transition-opacity ${
              puedeScrollAbajo ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[#2f8f5b] shadow">
              <ChevronDown className="w-3.5 h-3.5 text-white" />
            </span>
          </button>
        </div>
      </div>

      {/* Pie - solo si hay al menos un PIN guardado. shrink-0: altura fija,
          nunca se recorta ni empuja el resto fuera de la pantalla. */}
      {Object.values(pinsGuardados).some(Boolean) && (
        <div className="shrink-0 mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleOlvidarPins}
            className="text-white/30 text-xs hover:text-white/60 transition-colors"
          >
            Olvidar todos los PINs
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
