"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PERFILES, useProfile, tieneAccesoRapido, olvidarAccesosRapidos } from "@/lib/profile-context"

export default function LoginPage() {
  const router = useRouter()
  const { seleccionarPerfil, seleccionarPerfilRapido } = useProfile()

  const [pinsGuardados, setPinsGuardados] = useState<Record<string, boolean>>({})
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const guardados: Record<string, boolean> = {}
    PERFILES.forEach((p) => {
      guardados[p.id] = tieneAccesoRapido(p.id)
    })
    setPinsGuardados(guardados)
  }, [])

  const handleCardClick = async (id: string) => {
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
  }

  const perfilActual = PERFILES.find((p) => p.id === perfilSeleccionado)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-[#1a3a2a]">

      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">Los Jazmines</h1>
        <p className="text-white/60 text-sm mt-1 tracking-widest uppercase">Sistema</p>
      </div>

      {/* Grid de perfiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 w-full max-w-2xl">
        {PERFILES.map((perfil) => {
          const pinGuardado = pinsGuardados[perfil.id]
          const esSeleccionado = perfilSeleccionado === perfil.id && !pinGuardado
          const esDorado = perfil.id === "cobro"

          return (
            <div
              key={perfil.id}
              className={`flex flex-col items-center rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 px-4 pt-6 pb-5 gap-3 ${
                esDorado
                  ? "bg-gradient-to-b from-[#fdf6e3] to-[#f3e2a9] border border-[#d4af37]"
                  : "bg-white"
              } ${esSeleccionado ? (esDorado ? "ring-2 ring-[#c9a227]" : "ring-2 ring-[#1a3a2a]") : ""}`}
            >
              {/* Circulo con emoji */}
              <button
                type="button"
                onClick={() => handleCardClick(perfil.id)}
                className="group relative flex flex-col items-center gap-3 w-full focus:outline-none"
              >
                <div
                  className="relative w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-transform duration-200 group-hover:scale-105 group-active:scale-95 shadow"
                  style={{ backgroundColor: perfil.color }}
                >
                  <span role="img" aria-label={perfil.nombre}>{perfil.emoji}</span>
                  {pinGuardado && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                <span className="text-[#1a3a2a] text-sm font-bold text-center leading-tight">{perfil.nombre}</span>

                {pinGuardado && (
                  <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 -mt-1">
                    Acceso rapido
                  </span>
                )}
              </button>

              {/* Input PIN inline si seleccionado */}
              {esSeleccionado && (
                <div className="w-full flex flex-col items-center gap-2 mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
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
          )
        })}
      </div>

      {/* Pie - solo si hay al menos un PIN guardado */}
      {Object.values(pinsGuardados).some(Boolean) && (
        <div className="mt-12">
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
  )
}
